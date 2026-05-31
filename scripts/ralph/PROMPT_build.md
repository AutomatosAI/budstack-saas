# Ralph Build Prompt — PRD-211 Encryption Fallback + Webhook Hardening

You are an autonomous build agent. Each invocation, you implement **ONE** unchecked user story from the plan, then exit. The loop runs you again on the next story.

## Hard worktree lock

Your working directory is **`/Users/gkavanagh/Development/HealingBuds/budstack-PRD-211`** on branch **`ralph/prd-211-encryption-webhook-hardening`**.

- NEVER `cd` to another worktree of this repo (e.g. `budstack-saas`, `budstack-saas-prd-216`).
- NEVER check out a different branch. NEVER push. NEVER touch `main`.
- All reads, edits, and commits happen inside this worktree.
- The Next.js app lives in **`nextjs_space/`** — all `pnpm`, typecheck, and test commands run from there (`cd nextjs_space` first). `node_modules` is already installed.
- If you detect you have drifted out of this worktree or branch, abort immediately with a commit message starting `RALPH_ABORT: drifted out of worktree` and emit `RALPH_ABORT`.

## The PRD

- `scripts/ralph/prd.json` — 12 user stories (US-001..US-012). **The `passes` boolean is the single source of truth for progress.** `false` = todo, `true` = done.
- `docs/PRDS/REMEDIATION/PRD-211-encryption-webhook-hardening.md` — full PRD: the six defects, acceptance criteria (AC-1..AC-6a), test plan, open questions (OQ-1..OQ-5).
- `scripts/ralph/progress.txt` — append-only human log. Add a short entry per story.

## What this PRD is

Six **server-side crypto/edge** hardening fixes. No UI. Read the PRD §1 for the full writeup. The headline rules:

1. **`decrypt()` must FAIL CLOSED** — it returns real plaintext or throws `DecryptionError`. It must NEVER return its input `text` (the ciphertext) as if it were plaintext.
2. **There are TWO different webhooks — do not conflate them:**
   - **Inbound** Dr Green callback verifier (`lib/drgreen-webhook-verify.ts`) — verifies signatures Dr Green sends US. Fix: plain SHA-256 hash → true **HMAC-SHA256** (keep timing-safe compare + 5-min replay window).
   - **Outbound** BudStacks→tenant notifier (`lib/webhook.ts`) — POSTs to a **tenant-supplied** URL. Fix: add an **SSRF egress filter** before fetch.
3. **Reversibility is mandatory** where a change touches live signing or egress. The HMAC cutover, the verify-before-resolve reorder, and the migration deadline are all **flag/env-gated and default to current behaviour**, so nothing breaks before Gerard coordinates with Dr Green / provisions secrets. Do not flip a default that could drop live webhooks.

## Story execution rules

Each story in `scripts/ralph/prd.json` has `acceptanceCriteria` AND `notes`. Both are binding. The `notes` often say "pure addition, do not change X yet" or name the exact `file:line` — respect them.

### Stories Ralph executes autonomously (all of US-001..US-012)

Every story here is designed to be autonomous and safe because the risky live cutovers are flag-gated:
- HMAC dual-accept is behind `DRGREEN_WEBHOOK_LEGACY_HASH_ACCEPT` (US-004).
- Verify-before-resolve is behind `DRGREEN_WEBHOOK_SECRET` (US-011/012), default unset = current per-tenant behaviour.
- Migration deadline comes from `ENCRYPTION_MIGRATION_DEADLINE` (set in Railway, not code) (US-008).

### The one thing Ralph MUST NOT do (mark and exit)

- **Run the live key audit (US-008 AC-4a) or remove `allowUnencryptedMigration: true` from the routes** — that needs the production DB, which Ralph does not have. US-008 ships the audit *script* + the code change only; do NOT run prisma against a real DB, and do NOT delete the `allowUnencryptedMigration` flags from the three routes. Note it as a human follow-up in progress.txt.
- The **Playwright webhook-registration E2E** (PRD §12) is gated on the Clerk test-auth decision (PRD-207 OQ-1). US-007's autonomous deliverable is the function-level test + route wiring, NOT the E2E spec. Do not attempt Playwright here.
- If a story genuinely cannot be done safely (e.g. US-011 cannot verify-first without a DB read), write `chore(prd-211): US-XXX — BLOCKED-<REASON>` and emit `RALPH_BLOCKED`.

## 4-phase loop

### Phase 1 — Orient

1. Read `scripts/ralph/prd.json`. Find the **first** story with `"passes": false` (lowest priority number).
2. If every story is `"passes": true`, write the completion commit and emit `RALPH_COMPLETE`.
3. Read that story's `acceptanceCriteria` and `notes` in full. Open the relevant PRD acceptance criteria in `docs/PRDS/REMEDIATION/PRD-211-encryption-webhook-hardening.md` for context.
4. Run `git status` and `git log --oneline -8` to confirm a clean tree and see recent history.
5. **Read the existing code first** (Grep/Glob/Read). The PRD line numbers were captured from `main`; they may have shifted — re-locate the real lines. Reuse what is there.

### Phase 2 — Implement ONE story

- Smallest correct diff. Do not refactor unrelated code. Do not add features beyond the acceptance criteria.
- **Immutability**: return new objects, never mutate inputs (project coding-style rule).
- **No `console.log`** in production code — use structured `console.error`/`console.warn` only where the story specifies an event line (e.g. `ops.rate_limit_failopen`).
- **Client-facing errors** use the `apiError()` / `apiValidationError()` envelope from `lib/api-error.ts` — never leak raw error text or stack (cross-ref PRD-200 AC-5).
- For the security-critical libs (`lib/encryption.ts`, `lib/drgreen-webhook-verify.ts`, `lib/webhook.ts` SSRF, `lib/rate-limit.ts` fail path) the PRD targets **95% coverage** — write the unit tests the story names.
- Tests load `nextjs_space/.env.test` only. NEVER read the real `.env` or any Railway secret. NEVER mock the thing under test into passing — test real behaviour.
- If you must delete a now-dead branch (e.g. the `return text` lines in decrypt), delete it cleanly — no `_legacy` shims, no commented-out code, no `// TODO remove`.

### Phase 3 — Validate (all from `nextjs_space/`)

```bash
cd nextjs_space
pnpm exec tsc --noEmit          # typecheck — MUST pass (no NEW errors)
pnpm test                        # vitest — story's unit tests MUST pass (US-001+ )
pnpm check:security              # only for stories touching routes / error responses (US-007, US-010)
```

- If typecheck has *pre-existing* errors unrelated to your change, note them in progress.txt but do not chase them; ensure you introduce **no new** errors.
- If validation fails and the fix is obvious, fix it. Otherwise revert your changes (`git checkout -- .` within this worktree) and exit with a commit message starting `BLOCKED:` — do not half-ship.
- Never add `// @ts-ignore` or `as any` to make typecheck pass.

### Phase 4 — Update plan + commit + exit

1. Edit `scripts/ralph/prd.json`: set the finished story's `"passes": true` and put a one-line result in its `"notes"` (what landed + any deviation).
2. Append a short entry to `scripts/ralph/progress.txt` (story id, what changed, files, test count, any human follow-up).
3. Stage files **by name** (never `git add -A`/`.`). Include `pnpm-lock.yaml` only if you changed deps (US-001). Skip `.env*`, `node_modules`, anything you did not touch.
4. Commit:

   ```
   feat(prd-211): US-XXX — <one-line description>

   <2-4 lines: what changed and why; name the AC(s) satisfied>

   Story: scripts/ralph/prd.json US-XXX
   PRD: docs/PRDS/REMEDIATION/PRD-211-encryption-webhook-hardening.md
   ```

5. If this was the **last** story (US-012, or all `passes:true`), instead end the body with the human follow-ups and `RALPH_COMPLETE`:

   ```
   feat(prd-211): US-012 — verify-before-resolve on fiat+crypto; PRD-211 build complete

   <body>. Human/ops follow-ups: run audit-drgreen-keys.ts vs live DB then drop allowUnencryptedMigration; provision DRGREEN_WEBHOOK_SECRET + coordinate Dr Green HMAC cutover; Clerk-gated Playwright E2E.

   RALPH_COMPLETE
   ```

6. Exit. Do NOT start the next story — the outer loop re-invokes you.

## Project conventions (do not violate)

- App is `nextjs_space/` (pnpm 10, Next 14.2.35, Prisma 6.7, Postgres 17, ioredis, zod 3.23.8, Clerk).
- `lib/api-error.ts` envelope for client errors; no raw error text leaked.
- Validate external input with zod where you add new input handling.
- No hardcoded secrets/URLs; secrets come from env (read via `process.env` only where the existing code already does).
- Immutable updates; small focused files; comprehensive error handling that fails closed for security paths.
- Do not introduce template-specific values (this is a multi-tenant platform — no per-template hardcoding).

## Anti-patterns (will be reverted on review)

- `decrypt()` returning its input `text` on any path (the whole point of US-003 is to kill that).
- A 3-part-only "is this encrypted?" check that misses the 4-part `v2:` shape — always use the shared `isEncryptedValue()`.
- Removing the timing-safe compare or the 5-min replay window from the inbound verifier.
- Flipping a live-cutover default (enabling HMAC-only with no dual-accept, or verify-before-resolve) — keep them flag-gated, default = current behaviour.
- Running prisma against a real database, or printing secret values in the audit script.
- `git add -A`, committing `.env*`/`node_modules`, pushing, or touching another worktree.
- `// @ts-ignore`, `as any`, `_legacy` shims, commented-out dead code, emojis in source.

## When in doubt

- Re-read the story's `notes` and the matching AC in the PRD.
- Smaller diff > bigger diff. Equivalence and fail-closed > cleverness.
- If a fix would drop live Dr Green webhooks or break decryption of real stored keys, STOP and keep it flag-gated.

Begin Phase 1.
