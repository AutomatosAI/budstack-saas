# PRD-207 — Test Strategy Foundation — Implementation Plan

Single source of truth for ralph progress. The agent flips `- [ ]` → `- [x]` only on real success (never for a BLOCKED marker). Stories execute top-to-bottom in priority order.

Branch: `ralph/prd-207-test-harness` · App: `nextjs_space/` · Source PRD: `docs/PRDS/REMEDIATION/PRD-207-test-strategy-foundation.md`

---

## Phase 1 — Vitest unit harness + security suites (AUTONOMOUS, node-only, no Docker/Clerk)

- [ ] US-001 — Vitest unit harness scaffold (config, setup, .env.test, scripts)
- [ ] US-002 — Encryption round-trip + tamper unit tests (AC-9)
- [ ] US-003 — Dr Green webhook signature + timestamp unit tests (AC-10)
- [ ] US-004 — API auth wrapper unit tests (AC-11)
- [ ] US-005 — sanitizeCss unit tests — closes PRD-200 AC-3a
- [ ] US-006 — Coverage thresholds (report-only) for the security-critical set (AC-12)

## Phase 2 — Testcontainers Postgres 17 integration (REQUIRES Docker daemon)

> Gate: run `docker info` first. If no daemon → BLOCKED-DOCKER, emit RALPH_BLOCKED, leave unchecked.

- [ ] US-007 — Testcontainers Postgres harness + withPostgres helper (AC-2)  _(BLOCKED-DOCKER if no daemon)_
- [ ] US-008 — withPostgres smoke integration test (AC-2)  _(BLOCKED-DOCKER if no daemon)_
- [ ] US-009 — Typed seed factories (AC-2b)  _(BLOCKED-DOCKER for runtime check)_
- [ ] US-010 — Tenant-isolation concurrency proof (AC-8 / PRD-202 AC-7)  _(BLOCKED-DOCKER if no daemon)_

## Phase 3 — Playwright E2E (BLOCKED on PRD-207 OQ-1, owner Gerard)

> Gate: Clerk test-auth approach is undecided. Do NOT invent a shim → BLOCKED-NEEDS-AUTH-DECISION, emit RALPH_BLOCKED, leave unchecked.

- [ ] US-011 — Playwright rehab: programmatic auth so suite stops skipping (AC-3/AC-3a)  _(BLOCKED-NEEDS-AUTH-DECISION)_
- [ ] US-012 — E2E: onboarding critical path (AC-4)  _(depends on US-011)_
- [ ] US-013 — E2E: storefront order critical path (AC-5)  _(depends on US-011)_
- [ ] US-014 — E2E: consultation / KYC submit, no PHI echo (AC-6)  _(depends on US-011)_
- [ ] US-015 — E2E: super-admin renders real audit data (AC-7)  _(depends on US-011)_

---

## Expected autonomous outcome on this dev box

No Docker daemon + OQ-1 unresolved → ralph completes **US-001..006**, then halts cleanly as **RALPH_BLOCKED** at US-007 (BLOCKED-DOCKER). Phase 2 unblocks when Docker is started; Phase 3 unblocks when Gerard resolves OQ-1 (Clerk test-auth).
