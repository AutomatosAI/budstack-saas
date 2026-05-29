# PRD-206 — S3 Signed URL Tenant Scoping — Implementation Plan

Single source of truth for ralph progress. The agent flips `- [ ]` → `- [x]` only on real success (never for a BLOCKED marker). Stories execute top-to-bottom in priority order.

Worktree: `/Users/gkavanagh/Development/HealingBuds/budstack-saas-prd-206` · Branch: `ralph/prd-206-s3-tenant-scoping` · App: `nextjs_space/` · Source PRD: `docs/PRDS/REMEDIATION/PRD-206-s3-signed-url-tenant-scoping.md`

---

## Phase 1 — Guard + enforcement + call-site migration + unit tests (AUTONOMOUS, node-only, no Docker/Clerk)

- [x] US-001 — Vitest unit harness scaffold (idempotent) so guard tests can run
- [x] US-002 — lib/s3-tenant-guard.ts strict path-segment prefix guard + normaliser (AC-1)
- [x] US-003 — Guard bypass-string + traversal unit suite (AC-1a) — core security proof
- [x] US-004 — Enforce scope inside getFileUrl + explicit audited bypass (AC-2)
- [ ] US-005 — Enforce final-key scope inside uploadFile (AC-2a)
- [ ] US-006 — Remove bypassable substring checks in the two upload routes (AC-3)
- [ ] US-007 — Scope the tenant preview-image signing call site (AC-2)
- [ ] US-008 — Explicit audited super-admin bypass for cross-tenant template signing (AC-5)
- [ ] US-009 — Close the signS3Path absolute-path passthrough in preview (AC-4/AC-4a)
- [ ] US-010 — Unit tests for getFileUrl + uploadFile scope behaviour (AC-2/AC-2a/AC-5)

## Phase 2 — Integration tests (REQUIRES Docker daemon)

> Gate: run `docker info` first. If no daemon → BLOCKED-DOCKER, emit RALPH_BLOCKED, leave unchecked.

- [ ] US-011 — Integration: upload-scope (testcontainers) — Docker-gated (AC-2a/AC-3)  _(BLOCKED-DOCKER if no daemon)_
- [ ] US-012 — Integration: preview-sign-scope (testcontainers) — Docker-gated (AC-4)  _(BLOCKED-DOCKER if no daemon)_

## Phase 3 — Playwright E2E (BLOCKED on PRD-207 OQ-1, owner Gerard)

> Gate: Clerk test-auth approach is undecided. Do NOT invent a shim → BLOCKED-NEEDS-AUTH-DECISION, emit RALPH_BLOCKED, leave unchecked.

- [ ] US-013 — E2E: cross-tenant asset read blocked (Playwright) — auth-gated  _(BLOCKED-NEEDS-AUTH-DECISION)_

---

## Expected autonomous outcome on this dev box

Docker is DOWN here, so the loop is expected to complete **Phase 1 (US-001..010)** autonomously, then halt with `RALPH_BLOCKED` at **US-011** (BLOCKED-DOCKER). **Phase 3 (US-013)** stays BLOCKED-NEEDS-AUTH-DECISION pending Gerard's Clerk test-auth call (PRD-207 OQ-1). That is the correct, clean stopping point — the security guard, its bypass-string proof, the helper enforcement, the four migrated call sites, and the unit suites all land; the container/auth-gated tests wait for the human.

## Hard constraints (see PROMPT_build.md for the full set)

- `getFileUrl` (~20 callers) and `uploadFile` (~15 callers): scope arg is added BACKWARD-COMPATIBLY. Migrate ONLY the 4 named call sites. Do NOT break the other callers' typecheck. The "zero unscoped calls" CI gate is PRD-216, not this PRD.
- Strict path-segment prefix, NEVER substring `.includes`.
- The guard accounts for the `folderPrefix` from `getBucketConfig()` (e.g. `development/`).
- No hardcoded template-specific values (S3 is the source of truth).
