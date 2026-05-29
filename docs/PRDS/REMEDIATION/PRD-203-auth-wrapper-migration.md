# PRD-203 — Auth Wrapper Migration (`withTenantAuth`/`withSuperAdmin` rollout) + CI Gate

> **Status:** Proposed
> **Phase:** R2 — Tenant Isolation Foundation
> **Severity:** HIGH _(not an open bypass today — the Prisma `$use` middleware is the data-layer safety net — but 96 of 107 routes hand-rolling auth is procedurally fragile: each is one copy-paste slip from a missing role/tenant check, and a security questionnaire counts wrappers, not good intentions. See [Pre-flight verification](./REMEDIATION-INDEX.md#pre-flight-verification--2026-05-29).)_
> **Module(s) touched:** `lib/api-auth.ts`, `lib/auth-helper.ts`, `lib/resolve-tenant-id.ts`, every `app/api/**/route.ts` (107 files), `app/api/customer/profile/route.ts`, a new CI gate script `scripts/check-auth-wrappers.ts`, `.github/workflows/ci.yml`
> **Depends on:** **PRD-202** (the wrapper composes `runWithTenantContext` for the context-binding boundary) and **PRD-205** (the canonical tenant resolver the wrapper calls). Soft on **PRD-204** (validation runs inside the wrapped handler).
> **Blocks:** PRD-215 (ops/runbooks reference a uniform auth surface), and confident scaling past ~5 tenants.
> **Owner:** Gerard + Claude. Security sign-off: Gerard.
> **Last updated:** 2026-05-29

---

## 1. Problem

BudStacks ships **two well-built auth wrappers** that almost nobody uses. `lib/api-auth.ts` exports `withTenantAuth` (`:45`), `withTenantAuthParams` (`:76`), `withSuperAdmin` (`:118`), `withSuperAdminParams` (`:138`), and `withAuth` (`:162`). Each does the right thing: resolves the user via `getCurrentUser()`, enforces the role (`TENANT_ADMIN`/`SUPER_ADMIN`), asserts `tenantId` is present, and funnels all thrown errors through `apiError()` (so no stack trace leaks — see PRD-200 AC-5).

**The problem is reach, not design.** There are **107 route files** under `app/api/**/route.ts`. Only **11** import either wrapper (3 use `withTenantAuth`, 8 use `withSuperAdmin`). The other **~96 hand-roll the same boilerplate** — typically:

```ts
const user = await getCurrentUser();
if (!user || user.role !== "SUPER_ADMIN") {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

…copied per-route, per-method, with subtle drift. Some forget the `tenantId` presence check; some return `error.message` (PRD-200); some — like `app/api/customer/profile/route.ts` — skip the helper entirely and call Clerk's `currentUser()` directly. Every hand-rolled check is a place a future edit can silently weaken isolation, and there is **no gate** stopping a brand-new route from shipping with zero auth.

Two correctness bugs sit underneath the boilerplate problem:

1. **`getCurrentUser()` resolves the tenant by Clerk-org-then-email, with no host/request check.** `lib/auth-helper.ts:4` reads `publicMetadata.tenantId` (a Clerk **org** id) and email, then calls `resolveTenantIdFromClerkOrg(clerkOrgId, email)` (`lib/resolve-tenant-id.ts:14`). That resolver's **fallback** (`:37-47`) is a bare `prisma.users.findFirst({ where: { email } })` with **no tenant scope** — so a user whose Clerk org id doesn't match any tenant settings blob is mapped to *whatever tenant the first row with that email happens to belong to*. With `users.email` globally unique (PRD-205), one human = one row today, so it usually resolves correctly — but the contract is "trust the email, ignore the host", which is exactly the assumption that breaks the day a user exists in two tenants, or an email is reused. It also **races the Clerk `user.created` webhook**: if a request arrives before the webhook has written the user row, the email fallback returns `null` and the user is bounced even though they are legitimately authenticated.

2. **`customer/profile` is a cross-tenant email leak.** `app/api/customer/profile/route.ts:25` does `prisma.users.findFirst({ where: { email } })` with **no tenant filter at all** (and the PATCH at `:79` does the same before an `update`). Because the `users` model is in `tenantScopedModels`, the Prisma `$use` middleware *would* scope it — **but only if a tenant context is bound**, and this route never binds one (it doesn't use the wrapper, and PRD-202's throw-on-null is what will eventually catch this). Today it returns the profile of the first matching email row regardless of caller tenant.

This PRD does three things: (a) roll `withTenantAuth`/`withSuperAdmin`/`withAuth` out to **all 107 routes** (replacing the hand-rolled blocks); (b) fix `getCurrentUser`/`customer/profile` so tenant resolution is host-aware and tenant-scoped; (c) add a **CI gate** that fails the build if any route under `app/api` exports an HTTP handler that is not wrapped (with an explicit allow-list for genuinely public/webhook routes).

## 2. Users / personas

| Role | How they benefit |
|---|---|
| **Every tenant** | Every API route enforces role + tenant uniformly; no route can ship with a forgotten check |
| **Storefront customer** | `customer/profile` returns *their* profile, scoped to their tenant — never another tenant's row with the same email |
| **Developer** | Writes `export const GET = withTenantAuth(async (req, { user, tenantId }) => …)` once; cannot forget the boilerplate because CI rejects an unwrapped handler |
| **Enterprise prospect** | "Every authenticated endpoint enforces RBAC + tenant scoping, gated in CI" is a one-line, demonstrable answer |

## 3. User stories

- As a **developer**, when I add a new route under `app/api`, CI fails until I either wrap it in an auth wrapper or add it to the documented public-route allow-list — I cannot accidentally ship an open endpoint.
- As **tenant A's customer**, requesting `/api/customer/profile` returns only my tenant-A profile, even if a tenant-B user shares my email.
- As a **newly-signed-up user**, my first authenticated request does not 403 just because the Clerk `user.created` webhook is milliseconds behind.
- As an **auditor**, I can run one command (`pnpm check:auth-wrappers`) and get a list proving every route is gated.

## 4. Acceptance criteria

**Wrapper rollout:**

- [ ] **AC-1** All routes that require a tenant-admin context use `withTenantAuth` / `withTenantAuthParams`; all super-admin routes use `withSuperAdmin` / `withSuperAdminParams`; all any-logged-in-user routes use `withAuth`. The hand-rolled `getCurrentUser() + if (!user …) return 401` blocks are deleted from every migrated route.
- [ ] **AC-1a** Migrated handlers read `user`/`tenantId` from the wrapper's context arg — they do **not** re-call `getCurrentUser()` inside the body.
- [ ] **AC-1b** Per the design intent in `lib/api-auth.ts:33-44`, the wrapper composes `runWithTenantContext` (from PRD-202) so the handler — and every Prisma call it makes — runs inside one bound tenant scope. (If PRD-202 has not landed, the wrapper calls the existing context binding and a follow-up swaps it; tracked in §13 OQ-2.)

**`getCurrentUser` correctness:**

- [ ] **AC-2** `getCurrentUser()` (`lib/auth-helper.ts:4`) tenant resolution is hardened: the email-only fallback in `resolveTenantIdFromClerkOrg` (`lib/resolve-tenant-id.ts:37-47`) is **tenant-disambiguated** — when an email matches rows in more than one tenant, resolution does not silently pick the first; it prefers the Clerk-org match and, failing that, returns a typed "ambiguous" result the wrapper treats as 403 rather than guessing. (Once PRD-205 lands, `getCurrentUser` calls the single canonical resolver instead of this file.)
- [ ] **AC-2a** The Clerk `user.created` race is handled: if `getCurrentUser` finds a valid Clerk session but no DB user row yet, it returns a typed `UserNotProvisionedError` (→ 409/retryable), not a silent `null` that looks like "unauthorized". The webhook-provisioning ordering is documented.

**`customer/profile` tenant scoping:**

- [ ] **AC-3** `app/api/customer/profile/route.ts` GET + PATCH are wrapped (`withAuth` or `withTenantAuth`) and resolve the user **within the bound tenant context** — the `findFirst({ where: { email } })` at `:25` and `:79` gain a `tenantId` filter (or rely on the now-bound Prisma `$use` scoping from PRD-202). A tenant-A session can never read or mutate a tenant-B row sharing the email.
- [ ] **AC-3a** Regression test: seed two tenants with the *same* customer email; assert each session sees only its own row on GET and PATCH.

**CI gate:**

- [ ] **AC-4** A gate script `scripts/check-auth-wrappers.ts` parses every `app/api/**/route.ts`, finds each exported HTTP handler (`GET`/`POST`/`PUT`/`PATCH`/`DELETE`), and **fails** if a handler's initializer is not one of the approved wrappers (`withTenantAuth`, `withTenantAuthParams`, `withSuperAdmin`, `withSuperAdminParams`, `withAuth`) **unless** the route path is on an explicit allow-list.
- [ ] **AC-4a** The allow-list (`AUTH_PUBLIC_ROUTES`) is a small, reviewed, commented constant covering genuinely public/unauthenticated routes — e.g. `app/api/health`, `app/api/webhooks/**` (own signature verification — PRD-211), `app/api/store/[slug]/**` public storefront reads, and Clerk callback routes. Every entry has a one-line justification.
- [ ] **AC-4b** The gate runs in `.github/workflows/ci.yml` as a **separate gating step** (alongside the existing `pnpm lint`), and is exposed as `pnpm check:auth-wrappers` for local use. It exits non-zero with the offending `file → handler` list. Wired into PRD-216's CI gate suite.

**No leak regressions:**

- [ ] **AC-5** No migrated route returns `error.message` / `String(error)` in its body — all errors flow through the wrapper's `apiError()` path (consistent with PRD-200 AC-5). A grep gate confirms zero `error.message` in `NextResponse.json(...)` across `app/api/**`.

## 4.1 Design framework conformance

No UI surface — this is an API-edge refactor. No template-specific values touched.

- [x] No new tokens / primitives — N/A
- [x] Data-driven template rule respected — wrappers contain no template-specific logic
- [x] API responses use the `apiError()` envelope from `lib/api-error.ts` (note: the repo's envelope module is `lib/api-error.ts`, not `lib/api-response.ts`)

## 5. Scope

**In scope:** migrate all 107 `app/api` routes to the wrappers; delete hand-rolled auth blocks; fix `getCurrentUser` tenant disambiguation + `user.created` race; tenant-scope `customer/profile`; build the `check-auth-wrappers` CI gate + allow-list; wire it into CI.

**Out of scope:**
- The `runWithTenantContext` primitive itself → PRD-202 (this PRD *consumes* it).
- Consolidating the 7 tenant resolvers into one → PRD-205 (this PRD threads the current resolver and switches to the canonical one when it lands).
- Zod body validation inside handlers → PRD-204 (validation runs *inside* the now-wrapped handler).
- CSRF on destructive routes → PRD-201.

## 6. Non-functional requirements

| NFR | Requirement |
|---|---|
| Security | 100% of `app/api` HTTP handlers wrapped or explicitly allow-listed; CI-enforced |
| Correctness | `customer/profile` and any email-resolved route are tenant-scoped; no cross-tenant row reachable |
| Backward compatibility | Wrapped routes return identical success payloads; only the auth/error edge is unified |
| Performance | Wrapper adds one `getCurrentUser()` call already present in hand-rolled code — net neutral; ALS `.run()` overhead negligible |
| Maintainability | One auth code-path to audit instead of ~96 copies |
| Observability | All auth failures log via `apiError()` with route + correlation id |

## 7. Success metrics

- `pnpm check:auth-wrappers` → **0** unwrapped, non-allow-listed handlers (down from ~96).
- Wrapper-using route files: **107** (or 107 − allow-list count), up from 11.
- Zero `error.message` in `app/api` response bodies (shared gate with PRD-200).
- `customer/profile` cross-tenant test: 0 cross-tenant rows observed.
- New-route PRs cannot merge without a wrapper or an allow-list entry (gate proven by a deliberately-unwrapped test fixture failing CI).

## 8. API surface

No change to external request/response shapes for already-correct routes. Behavioural changes:

| Method | Path | Change |
|---|---|---|
| GET / PATCH | `/api/customer/profile` | Now tenant-scoped; cross-tenant email no longer resolves |
| (all) | `/api/**` (96 routes) | Auth + error edge unified under wrappers; success payloads unchanged |

New internal error types: `UserNotProvisionedError` (→ 409), ambiguous-tenant resolution (→ 403). Both surface to clients as generic envelopes via `apiError()` (no detail leak).

## 9. Data model changes

None. (The `users.email` global-uniqueness assumption that makes the email fallback "usually safe" is documented and addressed in PRD-205 / PRD-208.)

## 10. Events emitted / consumed

| Event | Direction | Payload | Subscribers |
|---|---|---|---|
| `auth.tenant_resolution_ambiguous` | emit (log) | `{ email, candidateTenantCount }` | logs / alert (PRD-215) — should be **zero** in steady state |
| `auth.user_not_provisioned` | emit (log) | `{ clerkUserId }` | logs (PRD-215); correlates with Clerk `user.created` webhook timing |

(No event bus yet — log lines today; PRD-215 formalises them.)

## 11. UI / UX

None. Auth failures already render as the app's existing 401/403 states; the only user-visible improvement is that a freshly-provisioned user no longer sees a spurious "unauthorized" during the webhook race.

## 12. Test plan

**Unit (Vitest — PRD-207):**
- `api-auth.test.ts` — each wrapper: rejects no-user (401), wrong-role (401), missing-tenant (403 for `withTenantAuth`); passes correct role; composes the tenant-context scope (mock `runWithTenantContext`).
- `auth-helper.test.ts` — `getCurrentUser` returns ambiguous→403 path when email matches >1 tenant; returns `UserNotProvisionedError` when session valid but no DB row.
- `resolve-tenant-id.test.ts` — Clerk-org match wins; email fallback does **not** silently pick first on multi-tenant collision.

**Integration (testcontainers Postgres — PRD-207):**
- `customer-profile.tenant-scope.integration.test.ts` — two tenants, same email; GET + PATCH each see only own row (AC-3a).
- `auth-wrapper.rollout.integration.test.ts` — spot-check a migrated tenant route (401 anon, 403 wrong tenant, 200 correct) and a migrated super-admin route.

**E2E (Playwright):**
- `customer-profile-isolation.spec.ts` — two tenant subdomains, same customer email, assert no cross-tenant profile bleed end-to-end.

**CI-gate test:**
- `check-auth-wrappers.test.ts` — a fixture route with a bare exported `GET` (not wrapped, not allow-listed) makes the gate exit non-zero; an allow-listed public route passes.

**Coverage target:** 95% on `lib/api-auth.ts`, `lib/auth-helper.ts`, `lib/resolve-tenant-id.ts`, and `scripts/check-auth-wrappers.ts` (security-critical). 80% baseline on migrated routes' new branches.

## 13. Open questions

- [ ] **OQ-1** Final shape of the public-route allow-list — which `store/[slug]` and `webhooks/**` routes are *intentionally* unauthenticated vs. signature-verified? Owner: Gerard. Resolution: enumerate from the current 107, justify each, default-deny the rest.
- [ ] **OQ-2** If PRD-202 slips, does the wrapper bind context via the interim `runWithTenantContext` or temporarily skip binding and rely on the existing `setTenantContext` path? Owner: Claude. Resolution: prefer landing PRD-202 first (it is the strict dependency); otherwise wrap with the interim primitive and re-point on PRD-202 merge.
- [ ] **OQ-3** `getCurrentUser` ambiguous-tenant → 403 vs. prompt-to-choose-org UX. Owner: Gerard. Resolution: 403 for API (safe default); org-switcher UX is a separate product item, not security.
- [ ] **OQ-4** Should the gate parse the AST (e.g. `ts-morph`) or use a robust regex? Owner: Claude. Resolution: AST via `ts-morph` for reliability — regex misses re-exports and wrapped-then-aliased handlers.

## 14. Dependencies

**Strict:**
- **PRD-202** — `withTenantAuth` must compose `runWithTenantContext`; rolling the wrapper out before the safe context boundary exists would spread the `enterWith()` bug wider.
- **PRD-205** — the canonical tenant resolver is what `getCurrentUser` should call; until it lands, this PRD hardens the existing `resolve-tenant-id.ts` fallback in place.

**Soft:**
- PRD-204 (input validation) — validation runs inside the wrapped handlers; landing them together avoids touching each route twice.
- PRD-207 (test foundation) — Vitest + testcontainers harness for the tests above.
- PRD-216 (CI gates) — hosts the `check-auth-wrappers` step alongside Dependabot/CodeQL.

## 15. Estimated effort

- **Migrate ~96 routes to wrappers (mechanical but must read each for role/tenant nuance):** 14 hours
- **`getCurrentUser` + `resolve-tenant-id` disambiguation + `user.created` race handling:** 5 hours
- **`customer/profile` tenant-scoping + test:** 3 hours
- **`check-auth-wrappers` AST gate + allow-list + CI wiring:** 6 hours
- **Unit + integration + E2E + gate tests:** 8 hours
- **Buffer for per-route surprises (custom auth, multi-role routes):** 4 hours
- **Total:** ≈ 40 hours (≈ 5 days for 1 dev + Claude pair)

## 16. References

- Existing code: `lib/api-auth.ts:45,76,118,138,162` (the five wrappers), `lib/auth-helper.ts:4` (`getCurrentUser`), `lib/resolve-tenant-id.ts:14,37-47` (Clerk-org-then-email resolution + the unscoped email fallback), `app/api/customer/profile/route.ts:25,79` (no-tenant `findFirst` on GET + PATCH)
- Counts (verified 2026-05-29): 107 `app/api/**/route.ts` files; 11 import a wrapper (3 `withTenantAuth`, 8 `withSuperAdmin`); ~96 hand-roll auth
- Error envelope: `lib/api-error.ts` (`apiError`, `apiValidationError`, `ApiError`) — **not** `lib/api-response.ts` (which does not exist in this repo)
- Standards: [OWASP Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/), [Clerk webhooks ordering](https://clerk.com/docs/integrations/webhooks/overview)
- Memory: `MEMORY.md` (Clerk auth + middleware public allowlist), `project_railway_environments.md` (persistent process)
- 2026-05-29 review: findings #5 (96/107 hand-roll auth), `getCurrentUser()` email-only + `user.created` race, `customer/profile` cross-tenant findFirst

## 17. Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-05-29 | Claude (with Gerard) | Initial draft from 2026-05-29 review. |
| 0.2 | 2026-05-29 | Claude (Opus 4.8) | Verified against code: 107 routes / 11 wrapped confirmed; wrapper line anchors (`lib/api-auth.ts:45,76,118,138,162`); `getCurrentUser` actually resolves via `resolveTenantIdFromClerkOrg` (Clerk-org-then-unscoped-email fallback), not pure email — finding refined accordingly; `customer/profile` no-tenant `findFirst` confirmed at `:25,79`; corrected envelope module to `lib/api-error.ts`. |
