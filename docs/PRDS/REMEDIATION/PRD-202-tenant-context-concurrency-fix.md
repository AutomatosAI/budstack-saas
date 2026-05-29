# PRD-202 — Tenant Context Concurrency Fix (`runWithTenantContext` rollout)

> **Status:** Proposed
> **Phase:** R1 — Pre-Production Blocker
> **Severity:** **CRITICAL** _(confirmed by verification — see [Pre-flight verification](./REMEDIATION-INDEX.md#pre-flight-verification--2026-05-29). This is the single highest-leverage fix in the entire suite. Every other isolation control sits on top of this one.)_
> **Module(s) touched:** `lib/tenant-context.ts`, `lib/tenant.ts`, `lib/db.ts`, a new request wrapper `lib/with-tenant-context.ts`, every API route + every Server Component/layout that issues tenant-scoped Prisma queries
> **Depends on:** None — but it **blocks PRD-203** (the auth wrapper is the delivery vehicle for the `.run()` boundary).
> **Blocks:** PRD-203 (auth wrapper migration), and the safe onboarding of any further tenant.
> **Owner:** Gerard + Claude.
> **Last updated:** 2026-05-29

---

## 1. Problem

Tenant isolation in BudStacks is enforced **at the data layer**, automatically, by a Prisma middleware. `lib/db.ts:110-159` installs `prisma.$use(async (params, next) => { const tenantId = getTenantContext(); … })` which, for every model in `tenantScopedModels`, rewrites `findUnique`→`findFirst`, injects `tenantId` into the `where` clause on reads/updates/deletes, and stamps `tenantId` on creates. **This middleware is the primary tenant-isolation control, and it is also the safety net behind the ~96 routes that hand-roll their auth checks** (PRD-203). If it reads the wrong `tenantId`, every one of those queries silently returns or mutates another tenant's data.

The middleware's correctness depends entirely on `getTenantContext()` returning *this request's* tenant. That value comes from an `AsyncLocalStorage`, and **the way it is currently populated is unsafe under concurrency**:

```ts
// lib/tenant-context.ts
const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

/** @deprecated Use runWithTenantContext instead to avoid cross-tenant data leaks.
 *  enterWith() replaces context for the entire async scope, which is unsafe
 *  under concurrent requests sharing a microtask queue. */
export function setTenantContext(tenantId: string | null) {
  tenantContextStorage.enterWith({ tenantId });   // ← the bug
}

export function getTenantContext() {
  return tenantContextStorage.getStore()?.tenantId ?? null;
}

export function runWithTenantContext<T>(tenantId: string | null, fn: () => T): T {
  return tenantContextStorage.run({ tenantId }, fn);   // ← the safe API, currently UNUSED
}
```

`enterWith()` sets the store for the **current async execution and everything that continues from it** — it has no scope boundary and is never "popped". The safe `runWithTenantContext()` (which binds the store to a single callback and tears it down when the callback settles) **exists in the same file but has zero callers.**

`setTenantContext()` is called **11 times, all inside `lib/tenant.ts`** (lines 23, 54, 58, 179, 182, 200, 203, 222, 225, 229, 233) — the tenant-resolution helpers set the ALS as a side-effect of resolving the tenant. Because these resolvers run inside request handlers on Railway's **persistent, multi-request Node process** (not per-request isolates), an `enterWith()` from request A can persist into a microtask continuation of request B that never set its own context — or, after any `await`, a resolver's value can be observed by an interleaved request. The result is a **cross-tenant data leak / cross-tenant write**: the worst failure mode a multi-tenant medical-commerce platform can have.

**Why it has not blown up yet:** today's tenant set is small and traffic is low, so the probability of a damaging interleave is low — but it is non-zero, undetectable when it happens (it returns *plausible* wrong-tenant data, not an error), and the probability rises with every tenant and every concurrent request. The deprecation comment proves the team already knows; the fix was started (the safe function exists) and never finished.

This PRD finishes it: **separate tenant *resolution* from context *binding*, and bind the context with `runWithTenantContext()` around the request's work — never `enterWith()`.**

## 2. Users / personas

| Role | How they benefit |
|---|---|
| **Every tenant** | Their data cannot leak into, or be overwritten from, another tenant's concurrent request |
| **Customer (storefront)** | Their order/consultation/KYC data is never served to another tenant's session |
| **Gerard** | Can onboard tenant N+1 without the isolation risk growing |
| **Enterprise prospect** | The "how do you guarantee tenant isolation under load?" questionnaire item has a real, testable answer |

## 3. User stories

- As **tenant A's customer**, when tenant B's storefront is handling a burst of concurrent requests at the same instant, my data is never returned to a tenant-B request and vice-versa.
- As a **developer**, I cannot accidentally run a tenant-scoped query outside a bound context — the Prisma middleware throws if `getTenantContext()` is unexpectedly null on a tenant-scoped model.
- As an **auditor**, I can point to a concurrency test that fires interleaved multi-tenant requests and proves no cross-tenant bleed.

## 4. Acceptance criteria

**Kill the unsafe API:**

- [ ] **AC-1** `setTenantContext()` (the `enterWith()` version) is **removed** from `lib/tenant-context.ts`. The only context-binding API exported is `runWithTenantContext(tenantId, fn)` (sync) and a new `runWithTenantContextAsync(tenantId, asyncFn)` if an async variant is needed. `getTenantContext()` is unchanged.
- [ ] **AC-1a** A grep gate (CI, PRD-216) asserts **zero** references to `enterWith(` and `setTenantContext(` anywhere in the codebase after migration.

**Separate resolution from binding:**

- [ ] **AC-2** `lib/tenant.ts` resolvers (the 11 current `setTenantContext` call sites) are refactored to **return** the resolved `tenantId` (or `null`) and **no longer set ALS as a side-effect**. Resolution becomes a pure lookup; binding happens at the request boundary.
- [ ] **AC-2a** A single canonical resolver is the source of the tenantId (this dovetails with PRD-205's tenant-resolution consolidation; if PRD-205 has not landed, this PRD threads the existing resolvers' return values through unchanged).

**Bind at the request boundary:**

- [ ] **AC-3** A new higher-order wrapper `withTenantContext(handler)` in `lib/with-tenant-context.ts` resolves the tenant, then invokes `return runWithTenantContext(tenantId, () => handler(req, ctx))` so the entire handler — and every Prisma call it makes — executes inside one bound async scope.
- [ ] **AC-4** **Every API route** that issues tenant-scoped Prisma queries is wrapped (directly via `withTenantContext`, or transitively via PRD-203's `withTenantAuth`, which composes `withTenantContext`).
- [ ] **AC-5** **Every Server Component / `layout.tsx` / `page.tsx`** that issues tenant-scoped Prisma queries establishes context too — via a `runWithTenantContext` helper invoked at the top of the data-loading path (e.g. in `app/store/[slug]/layout.tsx` and tenant-admin pages). Server Components do not pass through API-route wrappers, so they are an explicit, separately-tracked surface.

**Fail loud, not silent:**

- [ ] **AC-6** The Prisma `$use` middleware (`lib/db.ts:112`) is hardened: when a `tenantScopedModels` query runs with `getTenantContext() === null`, it **throws** `TenantContextMissingError` (configurable allow-list for legitimately global/system queries) rather than silently running unscoped. This converts "silent wrong/unscoped query" into a loud, test-catchable failure.
- [ ] **AC-6a** System/cross-tenant queries that legitimately run without a tenant (super-admin, webhooks pre-resolution, cron) use an explicit `runWithTenantContext(null, …)` or a documented `bypassTenantScope()` escape hatch — never an implicit null.

**Prove it under concurrency:**

- [ ] **AC-7** A concurrency integration test (AC in §12) interleaves N requests across ≥2 tenants and asserts **zero** cross-tenant rows are ever observed. This test must fail against the current `enterWith()` implementation and pass after the fix (red→green proof the change matters).

## 4.1 Design framework conformance

No UI surface. Pure server-side isolation correctness.

- [x] No UI — N/A
- [x] No template-specific values introduced

## 5. Scope

**In scope:** remove `setTenantContext`/`enterWith`; refactor `lib/tenant.ts` resolvers to return-not-set; `withTenantContext` request wrapper; wrap all tenant-scoped API routes + Server Components; harden the Prisma middleware to throw on missing context; concurrency proof test.

**Out of scope:**
- The broader `withTenantAuth`/`withSuperAdmin` **auth** semantics (role checks, ownership) → PRD-203. This PRD delivers the **context-binding** primitive that PRD-203 composes.
- Consolidating the 7 tenant resolvers into one → PRD-205 (this PRD is compatible with either pre- or post-consolidation state).

## 6. Non-functional requirements

| NFR | Requirement |
|---|---|
| Correctness | No tenant-scoped query may execute outside a bound context (middleware throws otherwise) |
| Performance | `runWithTenantContext` overhead is negligible (ALS `.run()` is ~constant); no measurable storefront latency change |
| Concurrency | Verified safe under interleaved multi-tenant load (AC-7) |
| Backward compatibility | Behaviour identical for single-tenant/low-concurrency today; only the unsafe interleave is removed |
| Observability | `TenantContextMissingError` is logged with route + model for fast diagnosis |

## 7. Success metrics

- Zero `enterWith(`/`setTenantContext(` references post-migration (CI gate).
- AC-7 concurrency test: 0 cross-tenant observations across ≥10k interleaved ops.
- 100% of tenant-scoped Prisma call paths execute inside a `runWithTenantContext` scope (audited via the middleware's throw-on-null in test + staging).
- No latency regression > 2% on storefront p95.

## 8. API surface

No external API change. Internal contract change: route handlers and data-loading Server Components must be wrapped. New internal error: `TenantContextMissingError` (surfaces to clients as a generic 500 via `apiError`, never leaking detail — see PRD-200 AC-5).

## 9. Data model changes

None.

## 10. Events emitted / consumed

| Event | Direction | Payload | Subscribers |
|---|---|---|---|
| `security.tenant_context_missing` | emit | `{ route, model, action }` | logs / alert (PRD-215) — should be **zero** in steady state |

## 11. UI / UX

None.

## 12. Test plan

**Unit (Vitest):**
- `tenant-context.test.ts` — `runWithTenantContext` binds + tears down; nested scopes restore the outer value; `getTenantContext()` outside any scope returns null.
- `with-tenant-context.test.ts` — wrapper resolves tenant then runs handler inside the bound scope.

**Integration (testcontainers Postgres — PRD-207):**
- `tenant-isolation.concurrency.integration.test.ts` — **the proof test (AC-7).** Seed tenants A and B with distinct rows. Fire `Promise.all` of interleaved handlers for A and B (with `await`/`setTimeout(0)` yields inserted to force microtask interleave). Assert each handler only ever reads/writes its own tenant's rows across thousands of iterations. **Must be demonstrated red on the `enterWith` baseline and green after the fix.**
- `prisma-middleware-throws.integration.test.ts` — a tenant-scoped query with no bound context throws `TenantContextMissingError`; an explicit `runWithTenantContext(null, …)` on an allow-listed system query succeeds.

**E2E (Playwright):**
- `cross-tenant-no-leak.spec.ts` — two browser contexts on two tenant subdomains hammer endpoints simultaneously; assert no tenant ever sees the other's data.

**Coverage target:** 95% on `tenant-context.ts`, `with-tenant-context.ts`, and the `lib/db.ts` middleware (security-critical).

## 13. Open questions

- [ ] **OQ-1** Server Components can't be wrapped by an API-route HOF. Best ergonomics for binding context in `layout.tsx`/`page.tsx`? Owner: Gerard + Claude. Resolution: a small `await loadWithTenant(slug, async () => {…})` helper invoked at the top of each tenant-scoped server data path; lint rule flags tenant-scoped Prisma calls not inside one.
- [ ] **OQ-2** Allow-list for legitimately context-free queries (super-admin global lists, webhook pre-resolution, cron, `tenants`/`users` lookups by id). Owner: Gerard. Resolution: enumerate from `tenantScopedModels` exceptions; default-deny, explicit `bypassTenantScope`.
- [ ] **OQ-3** Should the middleware throw in production immediately, or warn-then-throw behind a flag for one release to catch stragglers? Owner: Gerard. Resolution: throw in staging from day 1; in prod, log+throw together once the AC-7 test + staging soak show zero `tenant_context_missing` events.
- [ ] **OQ-4** Async wrapper variant — do any handlers need `runWithTenantContext` to await? (ALS `.run` returns the callback's return value, so awaiting the returned promise inside the scope is fine.) Owner: Claude. Resolution: provide `runWithTenantContext<Promise<T>>` typing; document.

## 14. Dependencies

**Strict:** None to start.

**Blocks:**
- **PRD-203** — `withTenantAuth` composes `withTenantContext`; the auth wrapper cannot be rolled out safely until the `.run()` boundary exists.

**Soft:**
- PRD-205 (tenant-resolution consolidation) — cleaner if the single canonical resolver lands first, but this PRD works with the current 7-resolver state.
- PRD-207 (test foundation) — the concurrency proof test needs the Vitest + testcontainers harness.

## 15. Estimated effort

- **Core refactor (`tenant-context.ts`, `lib/tenant.ts` resolvers → return-not-set, `with-tenant-context.ts`):** 6 hours
- **Wrap all tenant-scoped API routes:** 6 hours
- **Wrap Server Components / layouts / pages (the subtle surface):** 5 hours
- **Prisma middleware throw-on-null + allow-list:** 3 hours
- **Concurrency proof test + unit + E2E:** 6 hours
- **Total:** ≈ 26 hours (≈ 3 days for 1 dev + Claude pair)

## 16. References

- Existing code: `lib/tenant-context.ts` (full file above), `lib/db.ts:110-159` (Prisma `$use` middleware; `getTenantContext()` at `:112`), `lib/tenant.ts:23,54,58,179,182,200,203,222,225,229,233` (the 11 `setTenantContext` call sites)
- Node docs: [`AsyncLocalStorage.run` vs `enterWith`](https://nodejs.org/api/async_context.html#asynclocalstoragerunstore-callback-args) — `enterWith` "transitions into the context for the remainder of the current synchronous execution and then persists … through any following asynchronous calls", which is precisely the leak vector
- Memory: `MEMORY.md` tenant-isolation notes; Railway persistent-process note (`project_railway_environments.md`)
- 2026-05-29 review: original C4 (confirmed CRITICAL)

## 17. Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-05-29 | Claude (with Gerard) | Initial draft. |
| 0.2 | 2026-05-29 | Claude (Opus 4.8) | Confirmed CRITICAL via code read (Prisma `$use` at `lib/db.ts:112` consumes `getTenantContext`; 11 `setTenantContext` callers in `lib/tenant.ts`; `runWithTenantContext` exists but unused). Added "separate resolution from binding", Server-Component surface, throw-on-null middleware, and the red→green concurrency proof test. |
