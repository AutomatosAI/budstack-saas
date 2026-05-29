# PRD-216 — CI/CD Security Gates (test gate, Dependabot, CodeQL, secret scan, SBOM, build-time lint, grep gates)

> **Status:** Proposed
> **Phase:** R5 — Customer Readiness
> **Severity:** HIGH _(the platform processes payments + PHI with **no automated test gate, no dependency-vulnerability automation, no static security analysis, no secret scanning, and no SBOM**. Each is a standard line in an enterprise security questionnaire. This PRD also re-runs the other PRDs' grep gates on every PR so fixed findings cannot silently regress.)_
> **Module(s) touched:** `.github/workflows/ci.yml`, new `.github/dependabot.yml`, new `.github/workflows/codeql.yml`, new `.github/workflows/secret-scan.yml`, new `.github/workflows/sbom.yml` (or steps folded into `ci.yml`), `nextjs_space/next.config.js`, `nextjs_space/package.json` (test + coverage scripts)
> **Depends on:** PRD-207 (Vitest + Playwright harness — the test gate wires the suites PRD-207 builds) — **strict for the test gate AC**. The grep-gate ACs reference PRD-200 and PRD-202.
> **Blocks:** Confident merging on a payment/PHI platform; the "how is your pipeline secured?" questionnaire section. Supports PRD-207 (coverage threshold lands with the gate).
> **Owner:** Gerard + Claude. Security sign-off: Gerard's security advisor.
> **Last updated:** 2026-05-29

---

## 1. Problem

**Correction first (the first pass got this wrong):** the 2026-05-29 review claimed "CI only gates on `tsc`; ESLint is disabled". That is **false**. The live `.github/workflows/ci.yml` runs **three gating steps** — `npx tsc --noEmit` (typecheck), `pnpm lint`, and `pnpm build` (with stub env vars) — on every PR and push to `main`. **Lint IS enforced in CI.** The `eslint.ignoreDuringBuilds: true` in `next.config.js:12` only suppresses lint during `next build`; it does **not** disable the separate `pnpm lint` CI step. So lint is not the gap.

The **real** gaps in the pipeline are:

1. **No test step at all (HIGH — the actual CI gap).** `ci.yml` runs typecheck + lint + build and then stops. There is **no `pnpm test` / `vitest` / `playwright` invocation anywhere in CI.** On a platform handling payments and KYC/PHI, code merges to `main` with zero automated test execution. (PRD-207 builds the test suites; this PRD is what *runs* them in CI and fails the build when they fail.)
2. **No Dependabot config.** `.github/dependabot.yml` is **absent**. Dependency advisories (the same Next.js HIGH DoS/SSRF advisories PRD-200 addresses) are found only by manual `pnpm audit`, ad hoc. Nothing opens update PRs or flags new CVEs.
3. **No CodeQL / static security analysis.** No `codeql.yml`; the only workflow is `ci.yml`. No automated detection of injection, XSS sinks (like the `legacyCss` issue in PRD-200), or taint flows on each PR.
4. **No secret scanning.** No gitleaks/trufflehog workflow. Given PRD-200's `env.windows-dev` local secret-spill and the master `ENCRYPTION_KEY`, a committed secret would not be caught by CI. (The file was never committed — verified in PRD-200 — but nothing *enforces* that going forward.)
5. **No SBOM generation.** No software bill of materials produced on build. Enterprise procurement increasingly requires a CycloneDX/SPDX SBOM; we generate none.
6. **`eslint.ignoreDuringBuilds: true` (MINOR).** `next.config.js:12` suppresses lint during `next build`. Since CI already lints separately, this is low-impact — but flipping it to `false` makes `next build` itself catch lint, closing the gap for local/Railway builds that don't run the CI `pnpm lint` step. (`typescript.ignoreBuildErrors` is already correctly `false` at `:15`.)
7. **The other PRDs' grep gates aren't enforced.** PRD-200 defines "no `error.message` in API response bodies" + "no unwrapped CSS `dangerouslySetInnerHTML`"; PRD-202 defines "no `enterWith(`/`setTenantContext(`". These are written as ACs but nothing runs them per-PR, so a fixed finding can silently regress. This PRD wires them as CI grep gates.

This PRD adds a **test gate** (wiring PRD-207's suites + a coverage threshold), **Dependabot**, **CodeQL**, a **secret scanner**, **SBOM** generation, flips build-time lint on, and centralises the cross-PRD **grep gates** — all on the existing, correct typecheck+lint+build baseline.

## 2. Users / personas

| Role | How they benefit |
|---|---|
| **Every developer** | A PR cannot merge with failing tests, a known-vulnerable dependency, a leaked secret, or a regressed security grep gate |
| **Gerard / security** | Dependabot + CodeQL + secret scan + SBOM cover the standard "secure SDLC" questionnaire items |
| **Enterprise customer's vendor-risk team** | Can be shown the pipeline gates + an SBOM artifact |
| **Future maintainer** | Fixed findings (error leaks, `enterWith`, CSS sinks) stay fixed — the gate catches regressions |

## 3. User stories

- As a **developer**, when I open a PR, CI runs the unit + integration tests and the build fails if any test fails or coverage drops below threshold.
- As **security**, a newly-disclosed dependency CVE opens a Dependabot PR automatically, and CodeQL flags an injection sink before it merges.
- As a **reviewer**, if someone reintroduces `error.message` in a response body or `enterWith(`, the CI grep gate fails the PR.
- As **procurement**, I can download the SBOM artifact from the build.

## 4. Acceptance criteria

**Test gate (the real gap):**

- [ ] **AC-1** `ci.yml` gains a **test step** running PRD-207's suites: `pnpm test` (Vitest unit + integration via testcontainers) and the Playwright E2E suite (or a tagged critical-path subset for PR speed, full suite on `main`). A failing test fails the pipeline.
- [ ] **AC-1a** A **coverage threshold** is enforced: **80% baseline** project-wide, **95% on security-critical modules** (`lib/tenant-context.ts`, `lib/with-tenant-context.ts`, `lib/db.ts` middleware, `lib/css-utils.ts`, `lib/api-error.ts`, `lib/logger.ts`, `lib/redact.ts`, `lib/gdpr/erasure.ts`). The build fails below threshold. Coverage config lives with the Vitest setup from PRD-207.
- [ ] **AC-1b** Test execution gets the same stub env vars the build step already uses (`DATABASE_URL`, Clerk stubs, `ENCRYPTION_KEY`, etc.); integration tests provision their own Postgres via testcontainers.

**Dependabot:**

- [ ] **AC-2** `.github/dependabot.yml` is added: `package-ecosystem: npm` rooted at `nextjs_space/` (pnpm), plus `github-actions` ecosystem for the workflows. Weekly schedule, grouped minor/patch updates, security updates enabled. Open-PR limit set so it doesn't flood.

**CodeQL:**

- [ ] **AC-3** `.github/workflows/codeql.yml` runs the CodeQL `javascript-typescript` analysis on PRs to `main` + a weekly schedule, with the `security-and-quality` query suite. Results surface in the repo's Security tab; HIGH/CRITICAL alerts block (or are triaged before) merge.

**Secret scanning:**

- [ ] **AC-4** A secret-scan workflow (gitleaks or trufflehog) runs on every PR and scans the diff (and, on schedule, full history). A detected secret fails the PR. A `.gitleaks.toml` allow-list covers known false positives (e.g. the stub keys in `ci.yml`).

**SBOM:**

- [ ] **AC-5** An SBOM (CycloneDX via `@cyclonedx/cyclonedx-npm`, or `syft`) is generated on build and uploaded as a CI artifact (and attached to releases). Format: CycloneDX JSON. Documented so procurement knows where to find it.

**Build-time lint (minor):**

- [ ] **AC-6** `next.config.js:12` `eslint.ignoreDuringBuilds` is set to **`false`** so `next build` also enforces lint (defence-in-depth; CI already runs `pnpm lint` separately). `typescript.ignoreBuildErrors` stays `false` (already correct at `:15`). If flipping it surfaces a backlog of lint errors that would block the build, fix them or scope the rule set — recorded in §13 OQ-2.

**Cross-PRD grep gates (regression guards):**

- [ ] **AC-7** A CI grep-gate step (script in `scripts/ci/grep-gates.sh`, invoked from `ci.yml`) enforces, failing the build on any hit:
  - **PRD-200:** no `error.message` / `err.message` inside a `NextResponse.json(...)`/`Response.json(...)` argument across `app/api/**`; no `dangerouslySetInnerHTML` passing a `*Css`/`*css*` variable not wrapped in `sanitizeCss(...)`.
  - **PRD-202:** zero `enterWith(` and zero `setTenantContext(` anywhere in the codebase.
  - **PRD-215/213:** no known PII field name (`email`, `body.email`, `clerkUser.email`, `firstName`, `phone`, `address`, `drGreenResponse`) interpolated into a raw `console.*`/`logger.*` message.
- [ ] **AC-7a** Each gate has a clear failure message naming the offending file:line and the owning PRD, so a contributor knows why it failed and where the rule is documented.
- [ ] **AC-7b** The advisory **docs-lint** from PRD-214 (no reintroduced `next-auth`/`abacus`/banned sales claims) runs as a **non-blocking** warning step.

## 4.1 Design framework conformance

CI/CD-only PRD; no UI surface and no application code change beyond the `next.config.js` flag.

- [x] No UI — N/A
- [x] No template-specific values added to platform code

## 5. Scope

**In scope:** add the CI test gate + coverage threshold (wiring PRD-207); `dependabot.yml`; `codeql.yml`; secret-scan workflow; SBOM generation; flip build-time lint to enforce; centralised cross-PRD grep gates + advisory docs-lint.

**Out of scope:**
- **Writing** the tests themselves → **PRD-207** (this PRD runs them).
- The dependency **bump** for the current Next.js advisories → **PRD-200** (Dependabot here automates *future* detection).
- The `legacyCss`/`error.message` **fixes** → **PRD-200** (the grep gates here prevent *regression*).
- The `enterWith`/`setTenantContext` **removal** → **PRD-202** (the grep gate here enforces it stays removed).
- Container image scanning / runtime security → follow-up (Railway-hosted; revisit if we containerise more explicitly).

## 6. Non-functional requirements

| NFR | Requirement |
|---|---|
| Pipeline speed | PR runs stay reasonable — Playwright runs a tagged critical-path subset on PR, full suite on `main`; CodeQL on a sensible cadence; caches reused |
| Reliability | No flaky gate: testcontainers + deterministic seeds; grep gates are exact-match scripts, not heuristics |
| Security coverage | Dependabot + CodeQL + secret scan + SBOM together satisfy the standard secure-SDLC questionnaire items |
| Reproducibility | All gates run on the existing pinned toolchain (Node 20, pnpm 9, `--frozen-lockfile`) |
| Developer ergonomics | Gate failures name the file:line + owning PRD; gates are runnable locally |

## 7. Success metrics

- CI runs tests on 100% of PRs; build fails on any test failure (previously: tests never ran).
- Coverage gate active at 80% / 95% security-critical.
- Dependabot open-PR count > 0 within the first week (it finds existing drift).
- CodeQL + secret-scan workflows green and visible in the Security tab.
- SBOM artifact present on every build.
- 0 regressions of the PRD-200/202 findings (grep gates green; a deliberate reintroduction in a test branch fails the gate).

## 8. API surface

None — CI/CD configuration only.

## 9. Data model changes

None.

## 10. Events emitted / consumed

None at runtime. CI events: Dependabot PRs, CodeQL alerts, secret-scan failures, SBOM artifacts.

## 11. UI / UX

None. (Surfaces appear in GitHub's Actions + Security tabs and PR checks.)

## 12. Test plan

**Meta-tests (the gates verify themselves):**
- **Grep-gate self-test:** a fixture branch reintroduces `error.message` in a response, an `enterWith(`, an unwrapped CSS sink, and a PII `console.log`; assert the grep-gate script exits non-zero with the right message for each (red proof the gate works).
- **Test-gate proof:** a deliberately failing unit test fails the pipeline; a coverage drop below threshold fails the pipeline.
- **Secret-scan proof:** a fake high-entropy secret in a fixture commit trips gitleaks (then is removed); the `ci.yml` stub keys do **not** trip it (allow-list works).
- **Dependabot/CodeQL/SBOM:** verified by their presence + a green run on a trial PR; SBOM artifact downloaded and validated as CycloneDX JSON.

**Unit/Integration/E2E:** owned by **PRD-207**; this PRD asserts they *run in CI* and gate merges.

**Coverage target:** the gate itself enforces 80% baseline / 95% security-critical (AC-1a). The grep-gate script + workflow YAML get a smoke test in the meta-tests above.

## 13. Open questions

- [ ] **OQ-1** Playwright in CI — full suite per PR (slower, thorough) vs tagged critical-path subset on PR + full on `main`? Owner: Gerard. Resolution: subset on PR (auth, checkout, cross-tenant-isolation, GDPR-erasure specs), full on `main` + nightly.
- [ ] **OQ-2** Does flipping `eslint.ignoreDuringBuilds: false` surface a lint backlog that blocks `next build`? Owner: Claude. Resolution: run it on a worktree first; fix or scope the rules before merging the flag (CI lint already passes, so the delta should be small).
- [ ] **OQ-3** Secret scanner — gitleaks vs trufflehog? Owner: Gerard. Resolution: gitleaks (fast, simple `.gitleaks.toml` allow-list, good GitHub Action). Add trufflehog later if verified-secret detection is wanted.
- [ ] **OQ-4** CodeQL HIGH/CRITICAL alerts — hard-block merge, or block-after-triage to avoid first-run noise? Owner: Gerard + security. Resolution: warn for the first run to baseline, then hard-block new HIGH/CRITICAL introduced by a PR.
- [ ] **OQ-5** Where should the coverage config + thresholds live — `vitest.config.ts` (PRD-207) or a CI-only override? Owner: Claude. Resolution: in `vitest.config.ts` so local + CI agree; CI just runs `--coverage`.

## 14. Dependencies

**Strict:**
- **PRD-207** — the Vitest + Playwright suites + coverage setup must exist for the test gate to wire them. Until then, this PRD can land Dependabot, CodeQL, secret scan, SBOM, build-time lint, and the grep gates; the **test gate** AC waits on PRD-207 (or starts as a non-blocking job that becomes blocking when the suites land).

**Soft:**
- **PRD-200** — defines the `error.message` + CSS-sink grep gates this PRD enforces; lands the Next.js bump Dependabot then watches.
- **PRD-202** — defines the `enterWith`/`setTenantContext` grep gate.
- **PRD-215/213** — define the PII-in-logs grep gate.
- **PRD-214** — supplies the advisory docs-lint patterns.

## 15. Estimated effort

- **Test gate + coverage threshold wired into `ci.yml` (with PRD-207 suites):** 5 hours
- **`dependabot.yml` (npm + github-actions, grouped):** 2 hours
- **`codeql.yml` (javascript-typescript, security-and-quality):** 3 hours
- **Secret-scan workflow + `.gitleaks.toml` allow-list:** 3 hours
- **SBOM generation (CycloneDX) + artifact upload:** 3 hours
- **`eslint.ignoreDuringBuilds: false` flip + fix any surfaced lint:** 2 hours
- **`scripts/ci/grep-gates.sh` (PRD-200/202/215 gates) + docs-lint + self-tests:** 5 hours
- **Total:** ≈ 23 hours (≈ 3 days for 1 dev + Claude pair)

## 16. References

- Existing CI (verified 2026-05-29): `.github/workflows/ci.yml` — job "Typecheck · Lint · Build" runs `npx tsc --noEmit`, **`pnpm lint`** (separate gating step — lint **is** enforced), and `pnpm build` with stub env (`DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_BASE_DOMAIN`, `NEXTAUTH_SECRET`, `ENCRYPTION_KEY`). **No test step.** Only `ci.yml` exists in `.github/workflows/`.
- Absent (verified): `.github/dependabot.yml`, any `codeql*.yml`, any secret-scan workflow, any SBOM step. No `vitest`/`jest` in `package.json`; only `@playwright/test ^1.56.1` + `test:e2e` scripts (no `test` script).
- `nextjs_space/next.config.js:11-15` — `eslint.ignoreDuringBuilds: true` (suppresses lint in `next build` only, not CI), `typescript.ignoreBuildErrors: false` (already correct)
- Standards: [GitHub CodeQL](https://docs.github.com/en/code-security/code-scanning), [Dependabot](https://docs.github.com/en/code-security/dependabot), [gitleaks](https://github.com/gitleaks/gitleaks), [CycloneDX](https://cyclonedx.org/), [OWASP CI/CD Security](https://owasp.org/www-project-top-10-ci-cd-security-risks/)
- Cross-PRD: PRD-207 (test suites), PRD-200 (error/CSS grep gates + Next.js advisories), PRD-202 (`enterWith` grep gate), PRD-215/213 (PII-in-logs grep gate), PRD-214 (docs-lint)
- 2026-05-29 review: "No CI test gate; no Dependabot config"; "No CodeQL or secret-scan workflow"; "No SBOM generation"; "No build-time lint enforcement" _(corrected: lint **is** enforced as a separate CI step — the real gap is the missing test step)_

## 17. Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-05-29 | Claude (with Gerard) | Initial draft from 2026-05-29 review. |
| 0.2 | 2026-05-29 | Claude (Opus 4.8) | **Corrected the first-pass error**: read `.github/workflows/ci.yml` and confirmed `pnpm lint` is a separate gating step (lint IS in CI; `ignoreDuringBuilds` only affects `next build`). Reframed the real gap as the **missing test step**. Verified absence of `dependabot.yml`/CodeQL/secret-scan/SBOM and of any Vitest/`test` script (only Playwright). Added the cross-PRD grep gates (PRD-200/202/215) + advisory docs-lint (PRD-214) as regression guards, with self-tests. |
