# PRD-205 — Tenant Resolution Consolidation (single canonical helper)

> **Status:** Proposed
> **Phase:** R2 — Tenant Isolation Foundation
> **Severity:** HIGH _(seven resolvers with subtly different semantics is how a cross-tenant bug hides: one path scopes by `isActive`, another doesn't; one sets ALS as a side-effect, another returns a row; a caller picks the wrong one and the divergence is invisible until it leaks. See [Pre-flight verification](./REMEDIATION-INDEX.md#pre-flight-verification--2026-05-29).)_
> **Module(s) touched:** `lib/tenant.ts`, `lib/resolve-tenant-id.ts`, `lib/auth-helper.ts`, `middleware.ts`, `app/api/webhooks/drgreen/status/route.ts`, a new canonical `lib/tenant-resolver.ts`, plus every caller of the deprecated resolvers
> **Depends on:** **PRD-202** (the canonical resolver must **return** the tenantId, not set the ALS as a side-effect — PRD-202 separates resolution from binding). Soft on **PRD-208** (schema implication of `users.email` uniqueness).
> **Blocks:** **PRD-203** (the auth wrapper + `getCurrentUser` should call the one canonical resolver). Cleaner if it lands before the PRD-203 rollout.
> **Owner:** Gerard + Claude. Security sign-off: Gerard.
> **Last updated:** 2026-05-29

---

## 1. Problem

There are **at least seven** tenant-resolution helpers in the codebase, each resolving "which tenant is this?" from a slightly different input with slightly different rules:

| # | Helper | File:line | Input | Notable semantics |
|---|---|---|---|---|
| 1 | `getCurrentTenant()` | `lib/tenant.ts:16` | request headers (`x-tenant-subdomain` / `-custom-domain` / `-slug`) | `cache()`-wrapped; filters `isActive: true`; **sets ALS** via `setTenantContext` at `:23,54,58` |
| 2 | `getCurrentTenantId()` | `lib/tenant.ts:110` | (delegates to #1) | returns id only |
| 3 | `requireTenant()` | `lib/tenant.ts:118` | (delegates to #1) | throws if null |
| 4 | `getTenantBySlug(slug)` | `lib/tenant.ts:131` | slug string | filters `isActive: true`; retries lower-cased; **does not** set ALS |
| 5 | `getTenantFromRequest(req)` | `lib/tenant.ts:159` | `Request` (parses host + `/store/{slug}` path) | re-implements host→subdomain→customDomain logic; **sets ALS** at `:179,182,200,203,222,225,229,233` |
| 6 | `resolveTenantIdFromClerkOrg(orgId, email)` | `lib/resolve-tenant-id.ts:14` | Clerk org id + email | raw `$queryRaw` on `settings->>'clerkOrgId'`, then **unscoped** `users.findFirst({ where: { email } })` fallback |
| 7 | `resolveTenant(...)` | `app/api/webhooks/drgreen/status/route.ts:143` | webhook payload | route-local; runs a DB lookup on attacker input *before* signature verify (see PRD-211) |

On top of these, **`middleware.ts` re-derives the same host→subdomain→customDomain mapping a third time** (`:50-100`) to set the `x-tenant-*` headers that #1 then reads. So the "which tenant" decision is spread across `middleware.ts`, `lib/tenant.ts` (×5), `lib/resolve-tenant-id.ts`, and a webhook route — each a place the rules can drift.

The divergences are real and dangerous:

- **`isActive` filtering is inconsistent.** #1, #4, #5 filter `isActive: true`; #6's email fallback (`resolve-tenant-id.ts:39-46`) does **not** — it returns a tenant for an *inactive* tenant via the user relation. A deactivated tenant should resolve nowhere, but one path still resolves it.
- **ALS side-effects are inconsistent and unsafe.** #1 and #5 call `setTenantContext()` (the deprecated `enterWith()` — the exact concurrency bug PRD-202 fixes), #4 does not. So *whether resolving a tenant also mutates the request's ALS depends on which helper you happened to call* — a footgun that directly feeds the PRD-202 leak.
- **The email fallback assumes one tenant per user.** #6 and `customer/profile` (PRD-203) lean on `users.email` being globally unique (`prisma/schema.prisma`: `email String @unique`) with a nullable `tenantId String?`. That schema **structurally forbids the same person existing in two tenants** — a real limitation for a white-label platform (a clinician working with two storefronts can't have two accounts on the same email) — and it is the load-bearing assumption that makes "resolve by email" *usually* return the right tenant. It is correct only by accident of the constraint.

This PRD consolidates all of this into **one canonical resolver** with one set of rules, and makes every other helper either delegate to it or be deleted.

## 2. Users / personas

| Role | How they benefit |
|---|---|
| **Every tenant** | "Which tenant" is decided in exactly one place with one rule-set — no path resolves an inactive tenant or skips a check another path applies |
| **Developer** | One function to call (`resolveTenant(input)`); no choosing between seven near-identical helpers with hidden ALS side-effects |
| **Gerard** | The single resolver is the one surface to audit and test; the `users.email` single-tenant assumption is documented and a migration path proposed |
| **Enterprise prospect** | "Tenant identity is resolved by one canonical, tested function" supports the isolation story PRD-202/203 tell |

## 3. User stories

- As a **developer**, I call `resolveTenant({ headers })` or `resolveTenant({ host, path })` and get a `{ tenantId, tenant } | null` back — I never set the ALS by accident, and binding is done explicitly at the request boundary (PRD-202).
- As an **operator**, a deactivated tenant resolves to `null` from **every** entry point, including the Clerk/email path.
- As an **auditor**, I can read one file (`lib/tenant-resolver.ts`) and one test file to understand exactly how tenant identity is established.

## 4. Acceptance criteria

**One canonical resolver:**

- [ ] **AC-1** A single `lib/tenant-resolver.ts` exports `resolveTenant(input)` where `input` is a discriminated union of the legitimate resolution sources: `{ kind: 'headers' }` (reads `x-tenant-*`), `{ kind: 'host', host, pathname }`, `{ kind: 'slug', slug }`, `{ kind: 'clerk', clerkOrgId, email }`. It returns `Promise<{ tenantId: string; tenant: Tenant } | null>`.
- [ ] **AC-1a** The canonical resolver **returns** the tenantId and **never calls `setTenantContext`/`enterWith`** (per PRD-202 — resolution is separated from binding; the request wrapper binds via `runWithTenantContext`). A grep gate asserts `lib/tenant-resolver.ts` contains no ALS-mutation call.
- [ ] **AC-1b** The resolver applies **one** consistent rule-set: `isActive: true` is enforced on **every** source (closing the #6 inactive-tenant fallback gap); slug lookups apply the existing lower-case retry; Clerk-org match is preferred over email fallback; an email that matches >1 tenant returns a typed ambiguous result (consumed by PRD-203's `getCurrentUser` as a 403), never a silent first-row pick.

**Collapse the duplicates:**

- [ ] **AC-2** The seven existing resolvers are reduced to thin delegators or removed:
  - `getCurrentTenant` / `getCurrentTenantId` / `requireTenant` call `resolveTenant({ kind: 'headers' })` (keeping their `cache()` + throw-on-null ergonomics) and **drop** their `setTenantContext` side-effect.
  - `getTenantBySlug` calls `resolveTenant({ kind: 'slug', slug })`.
  - `getTenantFromRequest` calls `resolveTenant({ kind: 'host', host, pathname })` — its bespoke host-parsing logic moves into the canonical resolver.
  - `resolveTenantIdFromClerkOrg` calls `resolveTenant({ kind: 'clerk', … })`.
  - the webhook-route-local `resolveTenant` (`drgreen/status/route.ts:143`) is replaced by the canonical one (its pre-verify DB-lookup ordering is fixed under PRD-211).
- [ ] **AC-2a** `middleware.ts` host→subdomain→customDomain derivation (`:50-100`) and the resolver share **one** host-parsing utility (e.g. `parseHostToTenantHint(host)`), so middleware and resolver cannot drift.
- [ ] **AC-2b** A grep gate asserts no remaining standalone `findFirst({ where: { subdomain … } })` / `customDomain` tenant lookups outside `lib/tenant-resolver.ts` (every tenant lookup goes through the canonical path).

**Document + plan the schema implication:**

- [ ] **AC-3** The `users.email @unique` (global) + nullable `tenantId` single-tenant-per-user assumption is **documented** in the resolver file and in the schema, with an explicit note that resolving-by-email is only safe under this constraint.
- [ ] **AC-3a** A migration path to per-tenant user uniqueness (`@@unique([email, tenantId])` instead of global `@unique`) is **specified** (not necessarily executed here) and handed to **PRD-208**, including the data-backfill and Clerk-mapping implications. This PRD does not change the schema; it records the decision.

## 4.1 Design framework conformance

No UI surface. Pure server-side resolution refactor. No template-specific values introduced — the resolver works in tenant **identity** (subdomain, customDomain, id), never template content (which stays S3-sourced per the data-driven rule).

- [x] No new tokens / primitives — N/A
- [x] Data-driven template rule respected — resolver holds no template content
- [x] No DB schema change in this PRD (schema migration deferred to PRD-208)

## 5. Scope

**In scope:** build `lib/tenant-resolver.ts` canonical `resolveTenant`; collapse the 7 existing resolvers to delegators/removals; share one host-parsing util with `middleware.ts`; enforce `isActive` + ambiguous-email handling uniformly; document the `users.email` single-tenant assumption and specify the PRD-208 migration.

**Out of scope:**
- The ALS **binding** mechanism (`runWithTenantContext`) → PRD-202. This PRD ensures the resolver **returns** the id; PRD-202 binds it.
- Auth/role enforcement + `getCurrentUser` rollout → PRD-203 (it *calls* this resolver).
- Executing the `@@unique([email, tenantId])` schema migration → PRD-208.
- Webhook pre-verify-lookup ordering fix → PRD-211 (this PRD only swaps the helper).

## 6. Non-functional requirements

| NFR | Requirement |
|---|---|
| Correctness | Every entry point resolves an inactive tenant to `null`; ambiguous email never silently picks a tenant |
| Security | Resolver has zero ALS side-effects (no `setTenantContext`); binding is explicit (PRD-202) |
| Performance | `cache()` semantics preserved for per-request header resolution; no extra DB round-trips vs. today |
| Backward compatibility | All existing callers keep their signatures (delegators); behaviour identical except the closed `isActive`/ambiguity gaps |
| Maintainability | One file + one host-parser to audit instead of 7 resolvers + middleware duplication |

## 7. Success metrics

- Distinct tenant-resolution implementations: **1** canonical + thin delegators (down from 7 + middleware duplication).
- Tenant lookups (`findFirst` on `subdomain`/`customDomain`) outside `lib/tenant-resolver.ts`: **0** (CI gate).
- `setTenantContext`/`enterWith` calls inside any resolver: **0** (shared gate with PRD-202).
- Inactive-tenant resolution via any path: **0** (test-proven).
- PRD-203's `getCurrentUser` and the auth wrappers call the single resolver: confirmed.

## 8. API surface

No external API change. Internal contract: callers receive `{ tenantId, tenant } | null` (or the existing delegator shapes). New typed result: `AmbiguousTenantResolution` (consumed by PRD-203 as 403).

## 9. Data model changes

**None in this PRD.** Decision recorded for PRD-208: migrate `users.email` from global `@unique` to `@@unique([email, tenantId])` to permit one human across multiple tenants and remove the "resolve by email is safe because email is globally unique" coupling. Backfill + Clerk-org-mapping plan specified in §13 OQ-2 and handed to PRD-208.

## 10. Events emitted / consumed

| Event | Direction | Payload | Subscribers |
|---|---|---|---|
| `tenant.resolution_ambiguous` | emit (log) | `{ source, email, candidateCount }` | logs / alert (PRD-215) — shared with PRD-203's `auth.tenant_resolution_ambiguous` |
| `tenant.resolved_inactive_blocked` | emit (log) | `{ source, tenantId }` | logs (PRD-215) — a previously-leaking path now correctly returns null |

(No event bus yet — log lines today; PRD-215 formalises them.)

## 11. UI / UX

None.

## 12. Test plan

**Unit (Vitest — PRD-207):**
- `tenant-resolver.test.ts` — each `kind`: headers/host/slug/clerk resolves the right tenant; **inactive tenant → null on every kind** (AC-1b); ambiguous email → typed ambiguous result; resolver makes **no** `setTenantContext` call (spy asserts zero).
- `parse-host.test.ts` — `parseHostToTenantHint` handles `slug.budstacks.io`, apex custom domains, `www`, localhost, ports — and middleware + resolver share it (same fixture used in both).

**Integration (testcontainers Postgres — PRD-207):**
- `tenant-resolver.integration.test.ts` — seed active + inactive tenants and a multi-tenant email collision (simulated by pre-migration data); assert active-only resolution and ambiguous handling against real Postgres.
- `resolver-delegators.integration.test.ts` — `getCurrentTenant`/`getTenantBySlug`/`getTenantFromRequest`/`resolveTenantIdFromClerkOrg` all return values consistent with the canonical resolver.

**E2E (Playwright):**
- `inactive-tenant-404.spec.ts` — a deactivated tenant's subdomain and custom domain both fail to resolve (no storefront served) from every entry path.

**Coverage target:** 95% on `lib/tenant-resolver.ts` and the shared host-parser (security-critical). 80% on the delegators.

## 13. Open questions

- [ ] **OQ-1** Should `getCurrentTenant`'s `cache()` wrapper stay (per-request memoisation) or move into the canonical resolver? Owner: Claude. Resolution: keep `cache()` on the header-source delegator (it is request-scoped and used heavily by Server Components); the canonical resolver stays cache-agnostic so it composes cleanly with PRD-202's `runWithTenantContext`.
- [ ] **OQ-2** `users.email` migration to `@@unique([email, tenantId])` — backfill strategy and Clerk-org-mapping impact. Owner: Gerard + Claude. Resolution: spec the migration (drop global unique, add composite, backfill existing single rows trivially), but **execute in PRD-208** behind a tested data migration; document the interim email-fallback assumption until then.
- [ ] **OQ-3** Apex/multi-part-TLD custom-domain parsing — the recent `fix/super-admin-domain-dns-recovery` work handles multi-part TLDs; ensure the shared `parseHostToTenantHint` reuses that logic, not a fresh implementation. Owner: Gerard. Resolution: lift the existing apex/TLD handling into the shared util.
- [ ] **OQ-4** Does the webhook route genuinely need a *tenant* before signature verification, or only after? Owner: Gerard (with PRD-211). Resolution: PRD-211 reorders verify-before-lookup; this PRD just ensures it calls the canonical resolver once that ordering is fixed.

## 14. Dependencies

**Strict:**
- **PRD-202** — the canonical resolver must return-not-bind; building it before PRD-202's resolution/binding split would re-introduce the `setTenantContext` side-effect this PRD removes.

**Blocks:**
- **PRD-203** — `getCurrentUser` + the auth wrappers should call the single canonical resolver; landing PRD-205 first means PRD-203 wires one resolver, not seven.

**Soft:**
- PRD-208 (schema hardening) — executes the `users.email` composite-unique migration this PRD specifies.
- PRD-211 (webhook hardening) — fixes the webhook resolver's verify-before-lookup ordering once it delegates to the canonical resolver.
- PRD-207 (test foundation) — Vitest + testcontainers harness.

## 15. Estimated effort

- **Build `lib/tenant-resolver.ts` canonical `resolveTenant` (4 kinds, uniform rules):** 6 hours
- **Shared `parseHostToTenantHint` + dedupe `middleware.ts`:** 4 hours
- **Collapse 7 resolvers to delegators/removals + repoint callers:** 6 hours
- **Document `users.email` assumption + specify PRD-208 migration:** 2 hours
- **Tests (unit + integration + E2E):** 6 hours
- **Total:** ≈ 24 hours (≈ 3 days for 1 dev + Claude pair)

## 16. References

- Existing code: `lib/tenant.ts:16` (`getCurrentTenant`, `setTenantContext` at `:23,54,58`), `:110` (`getCurrentTenantId`), `:118` (`requireTenant`), `:131` (`getTenantBySlug`), `:159` (`getTenantFromRequest`, `setTenantContext` at `:179,182,200,203,222,225,229,233`), `lib/resolve-tenant-id.ts:14` (`resolveTenantIdFromClerkOrg`, unscoped email fallback at `:37-47`), `app/api/webhooks/drgreen/status/route.ts:143` (route-local `resolveTenant`), `middleware.ts:50-100` (duplicate host→subdomain→customDomain derivation), `prisma/schema.prisma` (`users.email String @unique`, `tenantId String?`)
- Count (verified 2026-05-29): 7 distinct tenant-resolution helpers + middleware duplication; all `isActive`-divergent / ALS-side-effect-divergent as tabled above
- Cross-PRD: PRD-202 (resolution vs binding split — this resolver returns, never binds), PRD-203 (canonical resolver consumer), PRD-208 (executes the email-uniqueness migration), PRD-211 (webhook resolver ordering)
- Memory: `MEMORY.md` (store URL pattern, `getTenantBasePath`, middleware rewrites), `6d6a381` commit (apex / multi-part-TLD handling to reuse)
- 2026-05-29 review: finding #7 (7 resolvers with divergent semantics), `users.email` global-uniqueness single-tenant assumption

## 17. Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-05-29 | Claude (with Gerard) | Initial draft from 2026-05-29 review. |
| 0.2 | 2026-05-29 | Claude (Opus 4.8) | Verified against code: enumerated the 7 resolvers with exact `file:line` + their divergent `isActive`/ALS-side-effect semantics; confirmed `middleware.ts` re-derives host mapping; confirmed `users.email @unique` global + nullable `tenantId`; aligned with PRD-202 (return-not-bind) and PRD-203 (single consumer); deferred schema migration to PRD-208. |
