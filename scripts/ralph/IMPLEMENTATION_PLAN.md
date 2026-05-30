# PRD-203 — Auth Wrapper Migration — Implementation Plan

Single source of truth for ralph progress. The agent flips `- [ ]` → `- [x]` only on real success (never for a BLOCKED marker). Stories execute top-to-bottom in priority order.

Worktree: `/Users/gkavanagh/Development/HealingBuds/budstack-saas-prd-203` · Branch: `ralph/prd-203-auth-wrapper-migration` · **Base (STACKED): `ralph/prd-205-tenant-resolution-consolidation` @ 06674ce** (chain **202 → 205 → 203** — NOT main). 203 strictly needs 202's `runWithTenantContext` (the wrapper's context boundary) AND 205's canonical ambiguity-aware `resolveTenant` (what `getCurrentUser` calls). · App: `nextjs_space/` · Source PRD: `docs/PRDS/REMEDIATION/PRD-203-auth-wrapper-migration.md`

The problem: BudStacks ships **five well-built auth wrappers** in `lib/api-auth.ts` (`withTenantAuth`/`withTenantAuthParams`/`withSuperAdmin`/`withSuperAdminParams`/`withAuth`) — each resolves the user, enforces the role, asserts `tenantId`, and funnels errors through `apiError()` (no stack leak). But of **107** `app/api/**/route.ts` files, only **12** use one; the other **~95 hand-roll** `getCurrentUser() + if (!user || role !== …) return 401`, copied per-route with subtle drift (some forget the `tenantId` check, some leak `error.message`, `customer/profile` skips the helper entirely). There is **no gate** stopping a brand-new route from shipping with zero auth. Two correctness bugs sit underneath: (1) `getCurrentUser` resolves the tenant Clerk-org-then-**unscoped-email**, host-blind, and races the Clerk `user.created` webhook (returns a `null` that looks like 401); (2) `customer/profile` GET+PATCH do a no-tenant `findFirst({ where: { email } })` — a cross-tenant leak. This PRD: (a) rolls the wrappers out to all 107 routes; (b) hardens `getCurrentUser` (consume 205's ambiguous result → 403; add typed `UserNotProvisionedError` → 409) and tenant-scopes `customer/profile`; (c) adds a **ts-morph CI gate** that fails the build on any unwrapped, non-allow-listed handler.

Merge order: **202 → 205 → 203**. (Soft overlap with **204** — both edit the same route files; 204 adds Zod inside the handler, 203 wraps the auth edge. Not stacked on 204; reconcile at merge.)

Counts (verified 2026-05-30 against this worktree): **107** route files; **12** already import a wrapper; tenant-admin **43**, super-admin **33**, store **9** (public), webhooks **4** (signature-verified), plus tenant/orders/consultation/account/user/signup/shop/onboarding/health/doctor-green/customer/auth.

---

## Phase 1 — gate + correctness + wrapper rollout (AUTONOMOUS, node-only)

- [x] US-001 — Route inventory (`scripts/ralph/route-inventory.md`) + `AUTH_PUBLIC_ROUTES` allow-list constant with per-entry justification; default-deny documented; no handler bodies changed (AC-4a/OQ-1)
- [x] US-002 — `scripts/check-auth-wrappers.ts` AST gate (TS compiler API; ts-morph not installable — same AST, see journal) + `pnpm check:auth-wrappers` + 10 unit tests (unwrapped→VIOLATION, wrapped→pass, allow-listed→pass, alias/indirection/re-export); **report-only** until US-010 (AC-4/AC-4b/OQ-4)
- [x] US-003 — Harden auth wrappers to compose tenant-context binding: `withTenantAuth`/`withTenantAuthParams` bind `user.tenantId`, `withSuperAdmin`/`withSuperAdminParams` bind explicit `null` (deliberate cross-tenant system query), `withAuth` binds the host-resolved tenant + forwards Next's `{params}` — all via PRD-202's `runWithTenantContextAsync`; no route bodies change + 12 unit tests (AC-1b)
- [x] US-004 — Harden `getCurrentUser` (`lib/auth-helper.ts`): consume 205's ambiguity-aware `resolveTenant({kind:'clerk'})` → typed 403; add `UserNotProvisionedError` → 409 for the `user.created` race; remove any unscoped fallback + unit tests (AC-2/AC-2a)
- [x] US-005 — Wrap + tenant-scope `app/api/customer/profile/route.ts` GET+PATCH in `withAuth` (`:25`/`:79` no-tenant `findFirst` closed by the bound host tenant) + unit test; cross-tenant real-DB proof deferred to US-011/US-012 (AC-3)
- [x] US-006 — Migrate super-admin routes (25 of 33) → `withSuperAdmin`/`withSuperAdminParams`; delete hand-rolled blocks; read `user`/`tenantId` from context (AC-1/AC-1a)
- [ ] US-007 — Migrate tenant-admin routes **batch 1** (~half of 43) → `withTenantAuth`/`withTenantAuthParams` (AC-1/AC-1a)
- [ ] US-008 — Migrate tenant-admin routes **batch 2** (remainder) → `withTenantAuth`/`withTenantAuthParams` (AC-1/AC-1a)
- [ ] US-009 — Migrate remaining authenticated routes (tenant/orders/consultation/account/user/signup/shop/onboarding/doctor-green/customer) → `withAuth`/`withTenantAuth`; confirm store/webhooks/health on `AUTH_PUBLIC_ROUTES`; flag anything ambiguous for human review (AC-1/AC-4a)
- [ ] US-010 — Flip gate to **blocking** (0 unwrapped non-allow-listed; wrapped+allow-listed == 107) + `error.message`-leak grep gate (AC-5) + non-blocking CI step (blocking CI = PRD-216) + non-vacuousness fixture check (AC-4/AC-4b/AC-5)

## Phase 2 — Integration tests (REQUIRES Docker daemon)

> Gate: run `docker info` first. If no daemon → BLOCKED-DOCKER, emit RALPH_BLOCKED, leave unchecked. Substituting a DB mock to dodge Docker is FORBIDDEN (PRD hard constraint).

- [ ] US-011 — Integration (testcontainers): `customer-profile.tenant-scope.integration.test.ts` (two tenants, same email → each sees only own row, GET+PATCH) + `auth-wrapper.rollout.integration.test.ts` (401 anon / 403 wrong tenant / 200 correct on a migrated tenant + super-admin route) — Docker-gated (AC-3a)

## Phase 3 — Playwright E2E (BLOCKED on PRD-207 OQ-1, owner Gerard)

> Gate: Clerk test-auth approach is undecided. Do NOT invent a shim → BLOCKED-NEEDS-AUTH-DECISION, emit RALPH_BLOCKED, leave unchecked.

- [ ] US-012 — E2E: `customer-profile-isolation.spec.ts` (two tenant subdomains, same customer email, no cross-tenant profile bleed on view+edit) — auth-gated

---

## Expected autonomous outcome on this dev box

Docker is DOWN here, so the loop is expected to complete **Phase 1 (US-001..010)** autonomously, then halt with `RALPH_BLOCKED` at **US-011** (BLOCKED-DOCKER). **Phase 3 (US-012)** stays BLOCKED-NEEDS-AUTH-DECISION pending Gerard's Clerk test-auth call (PRD-207 OQ-1). That is the correct, clean stopping point — the inventory + allow-list, the ts-morph gate, the **context-binding wrappers**, the hardened `getCurrentUser`, the tenant-scoped `customer/profile`, all 107 routes wrapped-or-allow-listed, the blocking local gate + `error.message` grep gate + non-blocking CI step all land; the real-DB cross-tenant proof and the E2E wait for the human.

## Hard constraints (see PRD §4–§6 for the full set)

- **All 107** `app/api` HTTP handlers end up wrapped (`withTenantAuth`/`withTenantAuthParams`/`withSuperAdmin`/`withSuperAdminParams`/`withAuth`) **or** on the reviewed `AUTH_PUBLIC_ROUTES` allow-list (AC-1/AC-4). Default-deny: if unsure, wrap it.
- Migrated handlers read `user`/`tenantId` from the **wrapper context arg** — never re-call `getCurrentUser()` in the body (AC-1a).
- The wrappers do **not** bind tenant context today (role check only) — **US-003** makes each compose **PRD-202's `runWithTenantContextAsync`** for the bound scope (AC-1b): `withTenantAuth`→`user.tenantId`, `withSuperAdmin`→explicit `null`, `withAuth`→host-resolved tenant. Never re-introduce `setTenantContext`/`enterWith` (202 deleted them). The route migrations (US-006..009) ride on this — a handler is only safe to de-hand-roll once its wrapper binds.
- `getCurrentUser`: ambiguous email → typed **403** (never a silent first-row pick); valid Clerk session + no DB row → typed `UserNotProvisionedError` **409** (never a silent `null`) (AC-2/AC-2a).
- `customer/profile` GET+PATCH are tenant-scoped — no unscoped email `findFirst` survives (AC-3).
- **Success payloads unchanged** — only the auth + error edge is unified (NFR backward-compat). No migrated route returns `error.message`/`String(error)` in its body (AC-5).
- The gate is **AST (ts-morph)**, not regex (OQ-4) — catches re-exports / aliased handlers. Allow-list entries each carry a one-line justification.
- The blocking **CI** gate is formally enforced in **PRD-216**; here US-009 lands the **local** blocking gate + a **non-blocking** CI step (mirrors how PRD-205 left its grep gates for PRD-216).
- No `// @ts-ignore` / `as any` to force typecheck. Immutable updates. No `console.log` in prod code (structured `console.warn` for `auth.tenant_resolution_ambiguous` / `auth.user_not_provisioned` audit events is acceptable). Tests load `.env.test` only.
- Webhook routes (`app/api/webhooks/**`) are **allow-listed, not wrapped** — they do their own signature verification (PRD-211). Do not wrap them.
