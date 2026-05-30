# PRD-205 — Tenant Resolution Consolidation — Implementation Plan

Single source of truth for ralph progress. The agent flips `- [ ]` → `- [x]` only on real success (never for a BLOCKED marker). Stories execute top-to-bottom in priority order.

Worktree: `/Users/gkavanagh/Development/HealingBuds/budstack-saas-prd-205` · Branch: `ralph/prd-205-tenant-resolution-consolidation` · **Base (STACKED): `ralph/prd-202-tenant-context-concurrency` @ 9b74295** (NOT main — 205 strictly needs 202's return-not-bind split; `main` still has the unsafe `setTenantContext`) · App: `nextjs_space/` · Source PRD: `docs/PRDS/REMEDIATION/PRD-205-tenant-resolution-consolidation.md`

The problem: **seven** tenant-resolution helpers (`lib/tenant.ts` ×5, `lib/resolve-tenant-id.ts`, the webhook route-local `resolveTenant`) plus a **third** host→subdomain→customDomain derivation in `middleware.ts` — each with subtly different rules. `isActive` filtering is inconsistent (the Clerk/email fallback resolves *inactive* tenants); ALS side-effects are inconsistent (#1/#5 call the deprecated `setTenantContext`, #4 doesn't). This PRD collapses all of it into **one canonical `resolveTenant(input)`** in `lib/tenant-resolver.ts` that **returns** the tenant (never binds — PRD-202 owns binding), enforces `isActive` on every source, returns a **typed ambiguous result** for multi-tenant email instead of a silent first-row pick, and shares **one** host parser with `middleware.ts`. Every other helper becomes a thin delegator.

Merge order: **202 → 205** (205 is stacked on 202; merge 202 first and 205's PR against main then shows only the 205 diff).

---

## Phase 1 — canonical resolver + delegators + local gates (AUTONOMOUS, node-only)

- [x] US-001 — Shared host parser `lib/parse-host.ts` `parseHostToTenantHint(host)` (lift the apex / multi-part-TLD handling, OQ-3) + unit suite (AC-2a)
- [x] US-002 — Canonical `lib/tenant-resolver.ts` `resolveTenant(input)` discriminated union (`headers`/`host`/`slug`/`clerk`), uniform `isActive`, **return-not-bind**, typed `AmbiguousTenantResolution` (AC-1/AC-1a/AC-1b) + unit suite (no-`setTenantContext` spy, inactive→null per kind, ambiguous email)
- [x] US-003 — Collapse `lib/tenant.ts` (`getCurrentTenant`/`getCurrentTenantId`/`requireTenant`/`getTenantBySlug`/`getTenantFromRequest`) to thin delegators on the canonical resolver; keep `cache()`/throw ergonomics; bespoke host parsing removed in favour of the shared util (AC-2) + delegator unit tests
- [x] US-004 — `lib/resolve-tenant-id.ts` `resolveTenantIdFromClerkOrg` → delegate to `resolveTenant({ kind: 'clerk' })`; close the unscoped/inactive email fallback (AC-1b/AC-2) + unit test
- [x] US-005 — `middleware.ts` host derivation (`:50-100`) consumes the shared `parseHostToTenantHint` so middleware + resolver cannot drift (AC-2a)
- [ ] US-006 — Webhook route-local `resolveTenant` (`app/api/webhooks/drgreen/status/route.ts`) delegates to the canonical resolver (helper swap only; verify-before-lookup ordering stays for PRD-211) (AC-2)  _(RALPH_BLOCKED: BLOCKED-PRD211 — the route-local resolver resolves by Dr Green business ids (clientId/orderId/strainId) + returns the per-tenant secret; the canonical resolver has only headers/host/slug/clerk kinds and returns {tenantId,tenant}. A literal swap would 404 every webhook. PRD defers the real delegation to PRD-211's verify-before-lookup reorder (§"this PRD only swaps the helper"; "PRD-211 …once it delegates"). Webhook file left UNTOUCHED to avoid conflicting with PRD-211. See progress.txt.)_
- [x] US-007 — Document the `users.email @unique` single-tenant assumption in `lib/tenant-resolver.ts` + `prisma/schema.prisma` comment; specify the PRD-208 `@@unique([email, tenantId])` migration path — no schema change here (AC-3/AC-3a)
- [x] US-008 — Local grep gates: zero `setTenantContext`/`enterWith` in the resolver (AC-1a); zero standalone `subdomain`/`customDomain` `findFirst` tenant lookups outside `lib/tenant-resolver.ts` (AC-2b) + a success-metric check script

## Phase 2 — Integration tests (REQUIRES Docker daemon)

> Gate: run `docker info` first. If no daemon → BLOCKED-DOCKER, emit RALPH_BLOCKED, leave unchecked.

- [ ] US-009 — Integration: `tenant-resolver.integration.test.ts` (testcontainers) — seed active + inactive tenants and a multi-tenant email collision; assert active-only resolution + ambiguous handling against real Postgres — Docker-gated (AC-1b)  _(BLOCKED-DOCKER if no daemon)_
- [ ] US-010 — Integration: `resolver-delegators.integration.test.ts` (testcontainers) — every delegator returns values consistent with the canonical resolver — Docker-gated (AC-2)  _(BLOCKED-DOCKER if no daemon)_

## Phase 3 — Playwright E2E (BLOCKED on PRD-207 OQ-1, owner Gerard)

> Gate: Clerk test-auth approach is undecided. Do NOT invent a shim → BLOCKED-NEEDS-AUTH-DECISION, emit RALPH_BLOCKED, leave unchecked.

- [ ] US-011 — E2E: `inactive-tenant-404.spec.ts` (Playwright) — a deactivated tenant's subdomain AND custom domain fail to resolve (no storefront served) from every entry path — auth-gated  _(BLOCKED-NEEDS-AUTH-DECISION)_

---

## Expected autonomous outcome on this dev box

Docker is DOWN here, so the loop is expected to complete **Phase 1 (US-001..008)** autonomously, then halt with `RALPH_BLOCKED` at **US-009** (BLOCKED-DOCKER). **Phase 3 (US-011)** stays BLOCKED-NEEDS-AUTH-DECISION pending Gerard's Clerk test-auth call (PRD-207 OQ-1). That is the correct, clean stopping point — the canonical resolver, the shared host parser, the five `lib/tenant.ts` delegators, the Clerk-org delegator with the closed inactive-email gap, the de-duplicated middleware, the webhook helper swap, the documented `users.email` assumption + PRD-208 migration spec, and the local grep gates all land; the real-DB active/inactive proof and the cross-tenant E2E wait for the human.

## Hard constraints (see PRD §4–§6 for the full set)

- The canonical resolver **RETURNS** `{ tenantId, tenant } | null` (or `AmbiguousTenantResolution`) and **never** calls `setTenantContext`/`enterWith` (AC-1a). Binding stays at the request boundary via PRD-202's `runWithTenantContext`/`runWithTenantContextAsync`.
- `isActive: true` is enforced on **every** resolution kind (closing the #6 inactive-tenant email-fallback gap) (AC-1b).
- An email matching **>1** tenant returns a typed `AmbiguousTenantResolution` (consumed by PRD-203 as a 403) — **never** a silent first-row pick (AC-1b).
- All existing caller **signatures are preserved** (delegators keep their `cache()` + throw-on-null ergonomics); behaviour identical except the closed `isActive`/ambiguity gaps (NFR backward-compat).
- **No DB schema change here** — the `@@unique([email, tenantId])` migration is *specified* and handed to PRD-208 (AC-3a), not executed.
- `middleware.ts` and the resolver share **one** `parseHostToTenantHint` — reuse the existing apex / multi-part-TLD handling (OQ-3), do not re-implement.
- The AC-1a/AC-2b "zero" CI grep gates are enforced in **PRD-216**; here it is a **local** grep check only.
- No `// @ts-ignore` / `as any` to force typecheck. Immutable updates. No `console.log` in prod code (structured `console.warn` for the `tenant.resolution_ambiguous` / `tenant.resolved_inactive_blocked` audit events is acceptable). Tests load `.env.test` only.
