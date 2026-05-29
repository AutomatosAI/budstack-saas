# PRD-202 — Tenant Context Concurrency Fix — Implementation Plan

Single source of truth for ralph progress. The agent flips `- [ ]` → `- [x]` only on real success (never for a BLOCKED marker). Stories execute top-to-bottom in priority order.

Worktree: `/Users/gkavanagh/Development/HealingBuds/budstack-saas-prd-202` · Branch: `ralph/prd-202-tenant-context-concurrency` · Base: `main` @ af77b24 · App: `nextjs_space/` · Source PRD: `docs/PRDS/REMEDIATION/PRD-202-tenant-context-concurrency-fix.md`

The bug: `lib/tenant-context.ts` binds tenant via the **deprecated `enterWith()`**, which has no scope boundary and persists across the microtask queue of Railway's persistent, multi-request Node process → a concurrent request can observe another tenant's id → the Prisma `$use` middleware (`lib/db.ts:112`) then silently reads/writes the **wrong tenant's** data. The safe `runWithTenantContext()` exists in the same file but has **zero callers**. This PRD separates tenant *resolution* from context *binding* and binds with `runWithTenantContext()` at the request boundary.

---

## Phase 1 — Core refactor + node-only unit proof (AUTONOMOUS, no Docker/Clerk)

- [x] US-001 — Vitest unit harness scaffold (idempotent) so tenant-context tests can run
- [x] US-002 — Additive tenant-context API: `runWithTenantContextAsync` + `hasTenantContext` (AC-1, keep `setTenantContext` for now) + unit suite
- [x] US-003 — Concurrency unit proof: `runWithTenantContext` isolates / `enterWith` leaks (node-only AC-7 proof)
- [x] US-004 — `withTenantContext` request wrapper `lib/with-tenant-context.ts` (AC-3) + unit suite (incl. concurrent-bleed test)
- [x] US-005 — Harden Prisma middleware: `TenantContextMissingError` + allow-list + `bypassTenantScope` + flagged throw (AC-6/AC-6a) + pure-helper unit suite
- [ ] US-006 — Pilot-wrap storefront Server Component `app/store/[slug]/layout.tsx` (AC-5)
- [ ] US-007 — Pilot-wrap one tenant-scoped API route via `withTenantContext` (AC-4)
- [ ] US-008 — Refactor `lib/tenant.ts` resolvers to return-not-set; remove the 11 `setTenantContext` side-effects (AC-2)
- [ ] US-009 — Remove `setTenantContext`/`enterWith` from `lib/tenant-context.ts` (AC-1 complete)

## Phase 2 — Integration tests (REQUIRES Docker daemon)

> Gate: run `docker info` first. If no daemon → BLOCKED-DOCKER, emit RALPH_BLOCKED, leave unchecked.

- [ ] US-010 — Integration: tenant-isolation concurrency proof (testcontainers) — Docker-gated (AC-7)  _(BLOCKED-DOCKER if no daemon)_
- [ ] US-011 — Integration: prisma-middleware-throws (testcontainers) — Docker-gated (AC-6)  _(BLOCKED-DOCKER if no daemon)_

## Phase 3 — Playwright E2E (BLOCKED on PRD-207 OQ-1, owner Gerard)

> Gate: Clerk test-auth approach is undecided. Do NOT invent a shim → BLOCKED-NEEDS-AUTH-DECISION, emit RALPH_BLOCKED, leave unchecked.

- [ ] US-012 — E2E: cross-tenant-no-leak (Playwright) — auth-gated  _(BLOCKED-NEEDS-AUTH-DECISION)_

---

## Expected autonomous outcome on this dev box

Docker is DOWN here, so the loop is expected to complete **Phase 1 (US-001..009)** autonomously, then halt with `RALPH_BLOCKED` at **US-010** (BLOCKED-DOCKER). **Phase 3 (US-012)** stays BLOCKED-NEEDS-AUTH-DECISION pending Gerard's Clerk test-auth call (PRD-207 OQ-1). That is the correct, clean stopping point — the safe context primitive (`runWithTenantContext`/`runWithTenantContextAsync`), the node-only concurrency proof, the request wrapper, the hardened fail-loud middleware, the return-not-set resolver refactor, the deletion of the unsafe `enterWith` API, and the two pilot wraps all land; the real-DB concurrency proof and the cross-tenant E2E wait for the human.

## Hard constraints (see PRD §4–§6 for the full set)

- `getTenantContext()` signature/behaviour is UNCHANGED (AC-1). Only the binding side is touched.
- `runWithTenantContext(null, fn)` (explicit null) is LEGAL for system/super-admin/webhook/cron queries; an **implicit** unbound context on a tenant-scoped model is the loud failure (AC-6a). Distinguish via `hasTenantContext()` (store presence), never by `tenantId === null` alone.
- Do NOT wrap all ~96 API routes or all tenant-scoped Server Components here — that mass migration is delivered transitively via PRD-203's `withTenantAuth`. This PRD ships the **primitive + hardened middleware + two pilots** only (AC-3/AC-4/AC-5 proven, not exhaustively applied).
- Strict throw is behind a flag (default OFF in prod) so not-yet-wrapped routes keep working through the PRD-203 migration window (OQ-3 warn-then-throw).
- The AC-1a "zero `enterWith`/`setTenantContext` references" **CI** gate is PRD-216, not this PRD (local grep check only here).
- No `// @ts-ignore` / `as any` to force typecheck. Immutable updates. No `console.log` in prod code (structured `console.warn` for the `security.tenant_context_missing` audit event is acceptable). Tests load `.env.test` only.
