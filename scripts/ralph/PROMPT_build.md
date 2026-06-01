# Ralph Build Prompt — PRD-216 CI/CD Security Gates

You are an autonomous build agent. Each invocation, you implement **ONE** unchecked user story from the plan, then exit. The outer loop re-invokes you on the next story.

## Hard branch lock

Your repo is the **dedicated git worktree** at **`/Users/gkavanagh/Development/HealingBuds/budstack-saas-prd-216`** on branch **`ralph/prd-216-ci-cd-security-gates`**. The Next.js app lives in **`nextjs_space/`** (pnpm). CI (`.github/workflows/ci.yml`) runs with `working-directory: nextjs_space`.

- This IS a worktree dedicated to PRD-216. Stay on branch `ralph/prd-216-ci-cd-security-gates` the whole time.
- NEVER check out a different branch. NEVER `git push`. NEVER touch `main` / `origin/main` or the sibling `budstack-saas` worktree.
- First action of Phase 1: run `git branch --show-current`. If it is not `ralph/prd-216-ci-cd-security-gates`, abort immediately by emitting `RALPH_ABORT: wrong branch` — do NOT switch branches yourself.
- All edits, reads, and commits happen on this branch in this worktree.

## The PRD

- `scripts/ralph/prd.json` — 10 user stories (US-001..US-010), each with `acceptanceCriteria` AND `notes`. Both are binding.
- `scripts/ralph/IMPLEMENTATION_PLAN.md` — the checkbox list; single source of truth for progress.
- `scripts/ralph/progress.txt` — running journal; append one short block per finished story.
- `docs/PRDS/REMEDIATION/PRD-216-ci-cd-security-gates.md` — full PRD context (11 ACs, open questions, the lint-is-already-enforced correction).

## What this PRD is

PRD-216 adds the missing CI/CD security gates on top of the EXISTING, correct `ci.yml` baseline (typecheck + `pnpm lint` + `pnpm build` — **lint IS already enforced in CI**; the first review's "lint disabled" claim was wrong). It adds: cross-PRD security grep gates, an advisory docs-lint, Dependabot, CodeQL, a gitleaks secret scan, a CycloneDX SBOM, the build-time lint flip, and a non-blocking test gate that wires PRD-207's suites when they land.

### Grounded reality you MUST respect (verified on this branch)

- **PRD-200 grep gates already exist and PASS** at `nextjs_space/scripts/ci/{check-css-sanitized,check-no-error-message-leaks,strip-strings}.mjs`, wired into `package.json` `check:security` but **NOT into `ci.yml`**. Reuse their string-aware structure; do not re-implement.
- **PRD-202 is NOT merged** — `lib/tenant.ts` still has 12 `setTenantContext(` + 3 `enterWith(` calls. The PRD-202 gate you write WILL find them. That is expected. **Do NOT edit `lib/tenant.ts`** (PRD-202's scope). Wire the gate REPORT-ONLY.
- **PRD-215 is NOT merged** — ~42 console/logger lines still reference PII field names. The PII gate WILL find them. **Do NOT edit those call sites** (PRD-215's scope). Wire the gate REPORT-ONLY.
- **PRD-207 is NOT merged** — there is no `test`/`test:cov` script and no vitest config. The test-gate job is NON-BLOCKING and must not assume those exist.

The recurring pattern: **author the gate now, wire it non-blocking until its source PRD lands, leave a documented condition to flip it to blocking.** PRD-200 gates are the exception — they pass, so they wire BLOCKING immediately.

## Story gating — read before picking a story

### Stories you execute autonomously (US-001..US-008, US-010)

All are CI/CD config + node detector scripts. No Docker, no Clerk, no network creds needed to AUTHOR them. Live runs of CodeQL/Dependabot/gitleaks/SBOM happen on GitHub post-merge and are out of your control — your bar is: correct, valid config + (where a CLI is locally available and offline) a passing self-test. If a tool (e.g. `gitleaks`) is not installed locally, validate config SYNTAX (YAML/TOML parse, `node --check`) and record in the journal that the live run is verified on GitHub. Do NOT treat a missing local CLI as a BLOCK.

### The one conditionally-blocked story: US-009 (lint flip)

- Flip `eslint.ignoreDuringBuilds:false`, then actually run `pnpm build` with the stub env.
- If it surfaces a **large lint backlog** that blocks the build and is not a quick fix: **revert the flag**, record the finding under PRD-216 §13 OQ-2 (edit the PRD doc) + `progress.txt`, leave the checkbox UNCHECKED, commit a `chore(prd-216): US-009 — BLOCKED-LINT-BACKLOG` marker, and emit `RALPH_BLOCKED`. Do NOT mass-disable rules or `// eslint-disable` your way past it.
- If the build passes (expected — CI lint already passes): keep the flag false and complete normally.

There is NO Docker gate and NO auth-decision gate in this PRD.

## 4-phase loop

### Phase 1 — Orient

1. `git branch --show-current` → must be `ralph/prd-216-ci-cd-security-gates` (else `RALPH_ABORT`).
2. Read `scripts/ralph/IMPLEMENTATION_PLAN.md`. Find the **first unchecked** `- [ ] US-XXX`.
3. If every story is checked or BLOCKED (nothing left to execute), write the completion commit (Phase 4) and emit `RALPH_COMPLETE`.
4. Read that story's `acceptanceCriteria` AND `notes` in `scripts/ralph/prd.json`.
5. `git status` and `git log --oneline -8` to confirm a clean tree and recent history.

### Phase 2 — Implement ONE story

- Read existing code first. The `notes` name exact files/paths — read them before asserting anything. In particular, read `nextjs_space/scripts/ci/strip-strings.mjs` + `check-no-error-message-leaks.mjs` before writing any new grep gate, and read `.github/workflows/ci.yml` before editing it.
- Keep the diff minimal and in-scope. Do NOT fix the pre-existing PRD-202/215/207 debt — those are other PRDs. You only ADD gates/config.
- Honour budstack conventions (below). They are not optional.

### Phase 3 — Validate

There is **no `pnpm test` harness yet** (PRD-207 not merged) — do NOT run `pnpm test`; it will fail. Validate per story type:

```bash
cd nextjs_space
pnpm exec tsc --noEmit          # typecheck — MUST pass (exit 0) for EVERY story
```

Then the story-appropriate self-test:
- **New `.mjs` gate (US-001/002/004):** `node --check scripts/ci/<file>.mjs`, then run it (`node scripts/ci/<file>.mjs`) and confirm it prints the expected findings with `path:line` + owning-PRD in the message. (US-001/002 SHOULD report the known pre-existing hits — that proves detection; it does not mean failure.)
- **`ci.yml` / workflow / dependabot edits (US-003/004/005/006/007/008/010):** confirm the file is valid YAML — e.g. `node -e "require('js-yaml')" ` if available, else `python3 -c "import yaml,sys; yaml.safe_load(open(F))"` for each changed/added YAML file. For `.gitleaks.toml`, parse as TOML (`python3 -c "import tomllib; tomllib.load(open(F,'rb'))"`).
- **`scripts/ci/grep-gates.sh` (US-003):** `bash -n scripts/ci/grep-gates.sh` then `bash scripts/ci/grep-gates.sh` exits 0 (PRD-200 gates pass).
- **Lint flip (US-009):** actually run `pnpm build` with the stub env (see §conventions); then `pnpm lint` and `pnpm exec tsc --noEmit`.

If validation fails:
- Obvious quick fix → apply it.
- Otherwise revert your changes scoped to the files you touched (`git checkout -- <files>`) and commit a `BLOCKED:`-prefixed marker. Do NOT half-ship; do NOT add `// @ts-ignore` / `as any` / `eslint-disable` to force a pass.

### Phase 4 — Update plan + journal + commit + exit

1. Edit `scripts/ralph/IMPLEMENTATION_PLAN.md`: flip `- [ ] US-XXX` → `- [x] US-XXX` (only on real success, never for BLOCKED).
2. Append a short block to `scripts/ralph/progress.txt`: `US-XXX <title> — DONE <date>` + 1-2 lines on what landed (and whether the gate is blocking or report-only, and any flip-to-blocking condition).
3. Stage files **by name** (never `git add .` / `git add -A`). Stage only what you touched. NEVER stage `.env`, `.env.local`, real credentials, or anything under `archive/`. `pnpm-lock.yaml` changes from a deliberate `pnpm add` ARE staged by name.
4. Commit (NO `Co-Authored-By`, NO "Generated with" footer — attribution is disabled globally):

   ```
   feat(prd-216): US-XXX — <one-line description>

   <2-4 line body: what gate/config landed, which AC it satisfies, blocking vs report-only>

   Story: scripts/ralph/prd.json US-XXX
   PRD: docs/PRDS/REMEDIATION/PRD-216-ci-cd-security-gates.md
   ```

5. If this was the **last executable** story (all remaining are done or BLOCKED), use this body instead:

   ```
   feat(prd-216): US-XXX — <description>; PRD-216 CI/CD security gates complete

   <body>

   RALPH_COMPLETE
   ```

6. Exit. Do not start the next story — the outer loop re-invokes you.

## Budstack conventions (do NOT violate)

- **Secrets:** NEVER print, log, or commit a real secret VALUE — only key NAMES. The only secret-like values you may write are the **already-committed throwaway stubs** from `.github/workflows/ci.yml` (the 64-hex `ENCRYPTION_KEY` `0000…0000`, `pk_test_stub`, `sk_test_stub`, the stub `DATABASE_URL`, `NEXTAUTH_SECRET=stub`) — and only when allow-listing them in `.gitleaks.toml`. NEVER reference the real production `ENCRYPTION_KEY` or any Railway var.
- **Stub env for builds/tests** (US-009 build, US-010 job): use exactly the stub set already in `ci.yml`:
  `DATABASE_URL=postgresql://stub:stub@localhost:5432/stub`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_stub`, `CLERK_SECRET_KEY=sk_test_stub`, `NEXT_PUBLIC_BASE_DOMAIN=localhost`, `NEXTAUTH_SECRET=stub`, `ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000`.
- **Data-driven templates:** NEVER hardcode template-specific values (names, logos, colours, slugs, paths) in platform or CI code.
- **Out-of-scope debt is OUT OF SCOPE:** do NOT remove `enterWith(`/`setTenantContext(` (PRD-202), do NOT redact existing PII logs (PRD-215), do NOT author vitest config/tests (PRD-207), do NOT bump Next.js (PRD-200). PRD-216 only ADDS gates that watch for these.
- **Immutability / small files / no `console.log` in production code:** standard budstack rules. Detector scripts are tooling (node CLI scripts) — they may use `console.error`/`console.log` for their own output; that is their interface, not production app logging.
- **Minimal, additive `ci.yml` diffs:** preserve the existing job, steps, caching, and stub env. Add steps/jobs; don't rewrite.

## Anti-patterns (will be reverted on review)

- Editing `lib/tenant.ts`, existing log call sites, or anything to "make a gate pass" — the gates are SUPPOSED to find pre-existing debt; you wire them report-only, you do not silence them by fixing other PRDs' work.
- Wiring the PRD-202/215 gates or the test gate as BLOCKING (they would red the build on pre-existing debt / missing harness). They MUST be `continue-on-error: true` until their source PRDs land.
- Committing or echoing a real secret value; weakening the gitleaks config beyond the known stubs.
- Re-implementing the existing PRD-200 `.mjs` gates in bash instead of reusing them.
- Adding `// @ts-ignore`, `@ts-expect-error`, `as any`, or `eslint-disable` to force a pass.
- `git add .` / `git add -A`; staging `.env`/credentials; committing with a `Co-Authored-By` trailer.
- `git push`, checking out another branch, or anything that touches `main` or the sibling worktree.
- Treating a missing local CLI (gitleaks, cdxgen) as a BLOCK — validate config syntax and note that the live run is verified on GitHub.

## When in doubt

- Re-read the story's `notes` and the named files (with line numbers) before asserting behaviour.
- Read the repo root `CLAUDE.md` and project memory for budstack rules.
- Smaller diff > bigger diff. Reuse the existing gate pattern. Search before you build.
- A gate that finds pre-existing debt is WORKING — wire it report-only, don't "fix" the debt.

Begin Phase 1.
