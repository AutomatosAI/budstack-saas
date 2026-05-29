# PRD-207 — Test Strategy Foundation (Vitest + Playwright critical paths)

> **Status:** Proposed
> **Phase:** R3 — Code Quality & Testing
> **Severity:** **CRITICAL** _(confirmed by verification — see [Pre-flight verification](./REMEDIATION-INDEX.md#pre-flight-verification--2026-05-29). Effective test coverage is **zero** on a platform that takes payments and processes KYC/medical data. This PRD is the harness every other PRD's unit + integration tests depend on.)_
> **Module(s) touched:** `package.json` (scripts + dev deps), new `vitest.config.ts`, new `vitest.setup.ts`, `tests/` (Playwright specs), new `tests/integration/` (testcontainers), new `tests/helpers/`, `playwright.config.ts`, repo-root `.github/workflows/ci.yml` (test step — wired in PRD-216)
> **Depends on:** None to begin — but the **concurrency proof test (PRD-202 AC-7)** and the unit suites named by PRD-200/201/203/204/205/206/211 all land **on this harness**, so it should ship first within R3.
> **Blocks:** PRD-208 and PRD-209 (refactoring without a safety net is the incident-generator this whole suite exists to prevent). Provides the `vitest` runner that PRD-216's CI test gate executes.
> **Owner:** Gerard + Claude. Critical-path sign-off: Gerard.
> **Last updated:** 2026-05-29

---

## 1. Problem

There is **one** test file in the repository — `tests/admin-design-system.spec.ts` — and it **auto-skips itself**. The whole suite is gated behind an env var that is unset in CI and locally:

```ts
// tests/admin-design-system.spec.ts:21-30
const AUTH_STATE = process.env.PLAYWRIGHT_AUTH_STATE;
const skipIfNoAuth = () => {
  test.skip(
    !AUTH_STATE,
    "Set PLAYWRIGHT_AUTH_STATE to authenticated storageState file to run admin design system suite",
  );
};
```

Every `describe` block calls `test.beforeEach(skipIfNoAuth)`, so with `PLAYWRIGHT_AUTH_STATE` unset (the default state on CI and a fresh checkout) **every test is skipped** and the run is green-but-empty. The file's own docstring admits it: *"If PLAYWRIGHT_AUTH_STATE is not set, tests skip cleanly so the spec is still typecheck-clean and documents the verification contract."* It is a documentation artefact, not a test.

`package.json` confirms the gap end to end:

- The only test scripts are `test:e2e`, `test:e2e:ui`, `test:e2e:headed`, `test:e2e:debug` — **all Playwright**. There is **no `test` script, no `vitest`, no `jest`** anywhere.
- `@playwright/test` is the only test framework in `devDependencies`. There is no unit-test runner, no testcontainers, no coverage tool.

The repo-root CI (`.github/workflows/ci.yml`) runs `npx tsc --noEmit` and `pnpm lint` — **and no test step at all** (PRD-216 wires one once a runner exists). So today the platform ships with:

- **0 executing unit tests.**
- **0 executing integration tests** against a real database.
- **1 E2E spec that skips itself.**

This is the single largest risk multiplier in the suite. It is not a finding in its own right so much as the reason every *other* finding is dangerous: the tenant-context concurrency leak (PRD-202), the encryption fallback (PRD-211), the auth-wrapper rollout (PRD-203) — none can be proven fixed, and none can be refactored safely, without a harness to assert behaviour. The personal rule (`~/.claude/rules/common/testing.md`) requires unit + integration (real DB) + E2E with an 80% floor and 95% on security-critical code; we are at zero.

This PRD stands up that harness:
1. **Vitest** for unit + integration, with **testcontainers Postgres** for integration (real DB, never mocks — matching the global rule).
2. **Playwright** rehabilitated for the four critical user journeys, runnable in CI without a hand-stored auth state.
3. A **coverage threshold** (80% baseline; 95% on the security-critical modules) the CI gate (PRD-216) enforces.
4. **Seed test files** for the highest-risk modules so the other PRDs have somewhere to land their tests on day one.

## 2. Users / personas

| Role | How they benefit |
|---|---|
| **Developers** | A real safety net — a failing assertion catches a regression at PR time instead of a customer finding it |
| **Gerard / reviewer** | Can merge a refactor (PRD-208/209) with evidence, not hope |
| **Every tenant** | The isolation, encryption, and webhook controls protecting their data are *proven*, not asserted by a docstring |
| **Enterprise prospect** | "What is your test coverage on payment + KYC paths?" has a real, non-zero, growing answer |
| **The other 15 PRDs** | Have a runner, a DB fixture, and a coverage gate to write tests against |

## 3. User stories

- As a **developer**, when I run `pnpm test`, real unit + integration tests execute against a throwaway Postgres container and fail loudly on a regression.
- As **Gerard**, when PRD-202 claims the tenant-context leak is fixed, I can point to a concurrency test that is red on the old code and green on the new (PRD-202 AC-7).
- As an **auditor**, I can see encryption round-trip, webhook-signature, and auth-wrapper behaviour covered by executing tests, not skipped specs.
- As a **CI gate (PRD-216)**, I can fail a PR that drops coverage below 80% (95% on security-critical modules).

## 4. Acceptance criteria

**Vitest unit harness:**

- [ ] **AC-1** `vitest` + `@vitest/coverage-v8` added to `devDependencies`. A `vitest.config.ts` configures the `node` environment for `lib/**` server code and `jsdom`/`happy-dom` for any component tests, with path aliases (`@/`) matching `tsconfig.json`.
- [ ] **AC-1a** `package.json` gains `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:cov": "vitest run --coverage"`, and `"test:int": "vitest run -c vitest.integration.config.ts"`. The existing `test:e2e*` scripts are unchanged.
- [ ] **AC-1b** A `vitest.setup.ts` loads test env (a `.env.test`, never the real `.env`) and provides global hooks; a fixed `ENCRYPTION_KEY` test value is injected so `lib/encryption.ts` round-trips deterministically.

**Testcontainers integration harness:**

- [ ] **AC-2** `@testcontainers/postgresql` added. A reusable helper `tests/helpers/with-postgres.ts` exposes `withPostgres(async (prisma) => { … })` that boots a Postgres 17 container (matching the production major — see `MEMORY.md`), runs `prisma migrate deploy` against it, returns a tenant-aware `PrismaClient`, and tears the container down on close.
- [ ] **AC-2a** Integration tests use the **real Prisma client against the container** — **no `createDbMock`-style fakes** for service/route-level tests. A lint rule (PRD-209 / PRD-216) forbids `*.integration.test.ts` from importing any DB mock.
- [ ] **AC-2b** A shared `tests/helpers/seed.ts` provides typed factories — `makeTenant()`, `makeUser()`, `makeOrder()`, `makeConsultation()` — with fixed UUIDs/dates for determinism. No inline literal seed rows in tests.

**Playwright rehabilitation:**

- [ ] **AC-3** `tests/admin-design-system.spec.ts` no longer silently skips the whole suite. A Playwright **global-setup** programmatically establishes an authenticated `storageState` (via a seeded test Clerk user or a documented test-auth shim), so the design-system contract tests **execute in CI** rather than skip. Per-test `test.skip` for genuinely absent UI (e.g. "no create trigger on this build") is retained.
- [ ] **AC-3a** `playwright.config.ts` runs against a `webServer` (`pnpm build && pnpm start`, or `next dev`) with a seeded test database, so E2E is hermetic and CI-runnable.

**Critical-path E2E coverage:**

- [ ] **AC-4** E2E spec **onboarding** `tests/e2e/onboarding.spec.ts`: create tenant → Clerk user provisioned → tenant row + S3 template copy exist → tenant storefront resolves. (Asserts the PRD-210 data-driven path: no hardcoded template values.)
- [ ] **AC-5** E2E spec **storefront order** `tests/e2e/storefront-order.spec.ts`: open tenant subdomain storefront → add product to cart → checkout → order row created and scoped to the right tenant.
- [ ] **AC-6** E2E spec **consultation / KYC submit** `tests/e2e/consultation-kyc.spec.ts`: complete the consultation questionnaire → submit KYC → assert success path and that **no PHI is echoed to the response body** (cross-ref PRD-215 redaction).
- [ ] **AC-7** E2E spec **super-admin** `tests/e2e/super-admin.spec.ts`: log in as `SUPER_ADMIN` → list tenants → open audit logs → assert the page renders **real** audit data, not `generateMockEvents` (this E2E is what proves PRD-209's mock-data removal).

**Seed unit/integration tests for the highest-risk modules (the landing pads for sibling PRDs):**

- [ ] **AC-8** `tests/integration/tenant-isolation.concurrency.test.ts` — **the PRD-202 proof test (PRD-202 AC-7) lives here.** Interleaves N requests across ≥2 tenants and asserts zero cross-tenant rows. Must be **red on the `enterWith()` baseline, green after** the `runWithTenantContext` fix. This harness is the reason PRD-202 can claim "proven".
- [ ] **AC-9** `tests/unit/encryption.test.ts` — `encrypt()`/`decrypt()` (`lib/encryption.ts:77,98`) round-trip; v2-prefix ciphertext decrypts; a tampered authTag throws; an unencrypted value is **not** silently passed through (guards the PRD-211 fallback contract).
- [ ] **AC-10** `tests/unit/drgreen-webhook-verify.test.ts` — `verifyDrGreenWebhookSignature()` (`lib/drgreen-webhook-verify.ts:36`) accepts a valid signature, rejects a tampered payload, and `validateWebhookTimestamp()` rejects a stale (>5 min) timestamp. (This is the suite PRD-211 extends when it upgrades the hash to true HMAC.)
- [ ] **AC-11** `tests/unit/api-auth.test.ts` — `withTenantAuth` / `withSuperAdmin` / `withAuth` (`lib/api-auth.ts:45,118,162`) reject unauthenticated and wrong-role callers and pass through the resolved `tenantId`. (This is the suite PRD-203's wrapper migration grows.)

**Coverage threshold:**

- [ ] **AC-12** `vitest.config.ts` sets a coverage gate: **80% lines/branches aggregate**, and **95%** on the security-critical set — `lib/tenant-context.ts`, `lib/with-tenant-context.ts` (once PRD-202 creates it), `lib/encryption.ts`, `lib/drgreen-webhook-verify.ts`, `lib/api-auth.ts`. The threshold is advisory in this PRD's first commit (report-only) then **enforced** once the seed suites land, and wired as a hard gate by PRD-216.

## 4.1 Design framework conformance

Test infrastructure only. The E2E specs validate **existing** UI surfaces (storefront, admin, super-admin); they add no new tokens or primitives. The onboarding E2E (AC-4) actively asserts the data-driven-template rule — that storefront output derives from S3 `layout.json`/`defaults.json`, with no template-specific values hardcoded in platform code.

- [x] No new tokens / primitives — N/A
- [x] Data-driven template rule **asserted** by AC-4 (onboarding E2E checks S3-sourced render)
- [x] Existing UI unchanged — E2E observes, does not modify

## 5. Scope

**In scope:** Vitest unit harness; testcontainers Postgres integration harness + `withPostgres` helper + typed factories; rehabilitate Playwright so it runs in CI; four critical-path E2E specs (onboarding, storefront order, consultation/KYC, super-admin); five seed unit/integration suites (concurrency proof, encryption, webhook verify, auth wrappers) that sibling PRDs build on; coverage thresholds (report-then-enforce).

**Out of scope:**
- The CI **test step + coverage gate wiring** in `ci.yml` → **PRD-216** (this PRD provides the runner + threshold config it executes).
- Per-PRD feature tests beyond the seed suites — each sibling PRD writes its own against this harness (PRD-200/201/203/204/205/206/208/211 each name their tests).
- Performance / load testing (k6) — not in this suite.
- Mutation testing, property-based testing — future.

## 6. Non-functional requirements

| NFR | Requirement |
|---|---|
| CI runtime | Unit suite < 60 s; integration (testcontainers) < 8 min; E2E < 15 min |
| Determinism | Fixtures seed fixed UUIDs/dates; `ENCRYPTION_KEY` test value pinned; no reliance on wall-clock or network |
| Isolation | Each integration test gets a clean container (or a truncated schema per test) — no shared mutable state |
| Real DB | Integration tests hit Postgres 17 via testcontainers — never a mock (global rule) |
| No prod secrets | Tests load `.env.test` only; never the real `.env`/Railway vars |
| Coverage | 80% aggregate; 95% on the security-critical module set (AC-12) |

## 7. Success metrics

- `pnpm test` executes **> 0** unit tests and they pass (today: 0).
- `pnpm test:int` boots a real Postgres container and runs ≥ 1 integration test (today: none).
- Playwright suite **executes** in CI with no `PLAYWRIGHT_AUTH_STATE` hand-set (today: skips entirely).
- The PRD-202 concurrency test is demonstrably **red→green** across the fix.
- Coverage report emitted; security-critical modules ≥ 95% once their seed suites land.
- Four critical journeys (onboarding, order, consultation/KYC, super-admin) covered by an executing E2E spec.

## 8. API surface

No application API change. New developer-facing scripts only: `test`, `test:watch`, `test:cov`, `test:int` (AC-1a).

## 9. Data model changes

None. Integration tests run migrations into a throwaway container; production schema is untouched. (Schema *hardening* is PRD-208, which depends on this harness.)

## 10. Events emitted / consumed

| Event | Direction | Payload | Subscribers |
|---|---|---|---|
| `ci.coverage_reported` | emit (CI) | `{ linesPct, branchesPct, criticalModulesPct }` | CI summary (PRD-216) |
| `ci.test_failed` | emit (CI) | `{ suite, failingSpec }` | PR status (PRD-216) |

(No runtime event bus — these are CI signals consumed by PRD-216.)

## 11. UI / UX

None. E2E specs drive the existing UI headlessly.

## 12. Test plan

This PRD **is** the test harness, so its "test plan" is partly self-referential — the deliverable is the ability to run the categories below.

**Unit (Vitest):**
- `encryption.test.ts` (AC-9), `drgreen-webhook-verify.test.ts` (AC-10), `api-auth.test.ts` (AC-11) — the security-critical seeds.
- A trivial `harness-smoke.test.ts` proving the runner + alias resolution + `.env.test` loading work.

**Integration (Vitest + testcontainers Postgres):**
- `tenant-isolation.concurrency.test.ts` (AC-8) — the PRD-202 proof, owned by this harness.
- A `with-postgres.smoke.test.ts` proving the container boots, migrations apply, and a factory-seeded row reads back.

**E2E (Playwright):**
- `onboarding.spec.ts`, `storefront-order.spec.ts`, `consultation-kyc.spec.ts`, `super-admin.spec.ts` (AC-4–7).
- Rehabilitated `admin-design-system.spec.ts` (AC-3) running via programmatic auth.

**Coverage target:** 80% aggregate; **95%** on `lib/tenant-context.ts`, `lib/with-tenant-context.ts`, `lib/encryption.ts`, `lib/drgreen-webhook-verify.ts`, `lib/api-auth.ts` (AC-12).

## 13. Open questions

- [ ] **OQ-1** Programmatic Clerk auth for E2E — seed a dedicated test user via Clerk's test mode, or a documented dev-only auth shim that mints a session? Owner: Gerard. Resolution: prefer Clerk testing tokens / a seeded `e2e` user with a stored `storageState` produced in global-setup, so no secret is hand-managed.
- [ ] **OQ-2** Integration DB strategy — one container per test file (clean but slower) vs one container with `TRUNCATE` between tests (faster, risk of bleed). Owner: Claude. Resolution: container-per-file for isolation suites (concurrency), shared+truncate for CRUD suites; measure against the < 8 min budget.
- [ ] **OQ-3** Component-level unit tests (React) now, or defer until the monster-file split (PRD-209) makes components testable? Owner: Gerard. Resolution: defer broad component testing to post-PRD-209; this PRD covers `lib/**` + critical-path E2E, which is where the risk is.
- [ ] **OQ-4** Where does the coverage **enforcement** flip from report-only to hard-fail — this PRD or PRD-216? Owner: Gerard. Resolution: thresholds defined here (report-only first commit), enforced by PRD-216's CI gate so the two land together.

## 14. Dependencies

**Strict:** None to begin — this is the foundation.

**Blocks:**
- **PRD-208** (schema hardening) and **PRD-209** (code health / monster-file split) — refactoring needs the safety net first.

**Soft:**
- **PRD-202** — its concurrency proof test (AC-7) lands on this harness (AC-8); ideally the two are paired so the red→green proof is real.
- **PRD-216** — wires `pnpm test` + the coverage gate into CI; this PRD supplies the runner and threshold config.
- **PRD-200/201/203/204/205/206/211** — each contributes its own unit + integration tests onto this harness; until it lands they ship grep gates + E2E and backfill units here.

## 15. Estimated effort

- **Vitest config + setup + `.env.test` + scripts:** 4 hours
- **Testcontainers `withPostgres` helper + typed factories:** 8 hours
- **Playwright rehabilitation (global-setup auth, `webServer`, seeded DB):** 6 hours
- **Four critical-path E2E specs:** 16 hours
- **Five seed unit/integration suites (concurrency proof, encryption, webhook, auth):** 16 hours
- **Coverage thresholds + report wiring:** 4 hours
- **Docs (how to run tests, write an integration test, add a factory):** 4 hours
- **Total:** ≈ 58 hours (≈ 8 days for 1 dev + Claude pair)

## 16. References

- Existing code: `tests/admin-design-system.spec.ts:21-30` (the auto-skip), `package.json:4-17` (only `test:e2e*`, no unit runner), `playwright.config.ts`, repo-root `.github/workflows/ci.yml:46,49` (runs `tsc --noEmit` + `pnpm lint`, **no test step**)
- Seed-test targets: `lib/encryption.ts:77,98` (`encrypt`/`decrypt`), `lib/drgreen-webhook-verify.ts:36,71` (`verifyDrGreenWebhookSignature`/`validateWebhookTimestamp`), `lib/api-auth.ts:45,118,162` (`withTenantAuth`/`withSuperAdmin`/`withAuth`), `lib/tenant-context.ts` (PRD-202 subject)
- Global rule: `~/.claude/rules/common/testing.md` (unit + integration-on-real-DB + E2E; 80% floor, 95% security-critical)
- External: [Vitest](https://vitest.dev/), [testcontainers-node](https://node.testcontainers.org/), [Playwright](https://playwright.dev/), [Prisma migrate deploy](https://www.prisma.io/docs/orm/prisma-migrate)
- Memory: `MEMORY.md` (Railway Postgres is **v17** — testcontainers must match the major), `project_encryption_v2_prefix.md` (v2-prefix round-trip for AC-9)
- 2026-05-29 review: finding #9 ("effective test coverage zero — 1 spec that auto-skips")

## 17. Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-05-29 | Claude (with Gerard) | Initial draft from 2026-05-29 review. |
| 0.2 | 2026-05-29 | Claude (Opus 4.8) | Verified against code: confirmed `package.json` has only `test:e2e*` (no Vitest/Jest), the lone spec auto-skips on unset `PLAYWRIGHT_AUTH_STATE`, and repo-root CI has no test step. Named real seed-test targets (`encrypt`/`decrypt`, `verifyDrGreenWebhookSignature`, `withTenantAuth`) and tied the PRD-202 concurrency proof + coverage gate (PRD-216) to this harness. |
