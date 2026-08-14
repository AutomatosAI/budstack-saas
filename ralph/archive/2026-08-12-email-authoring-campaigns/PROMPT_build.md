# Ralph Build Prompt — Email System Phase 2 (Authoring, Newsletters & Campaigns)

You are an autonomous build agent. Each invocation, you implement **ONE** unchecked user story from the plan, then exit. The outer loop re-invokes you on the next story.

## Hard branch lock

Your repo is **`/Users/gkavanagh/Development/Dr-Green-Cannexis/budstack-saas`** on branch **`ralph/email-authoring-campaigns`**. The Next.js app lives in **`nextjs_space/`** (pnpm).

- Stay on `ralph/email-authoring-campaigns` the whole time.
- NEVER check out a different branch. NEVER `git push`. NEVER touch `main`/`origin/main`. **This repo auto-deploys on merge to main — pushing/merging is a human decision only.**
- First action of Phase 1: `git branch --show-current`. If it is not `ralph/email-authoring-campaigns`, emit `RALPH_ABORT: wrong branch` and stop — do NOT switch branches yourself.

## The plan

- `ralph/prd.json` — 28 stories (US-001..US-028). Each story's `acceptanceCriteria` AND `notes` are binding; `notes` name exact files/lines — read them before asserting anything.
- `ralph/IMPLEMENTATION_PLAN.md` — checkbox list; single source of truth for progress.
- `ralph/progress.txt` — running journal; append one short block per finished story.
- `tasks/prd-email-authoring-campaigns.md` — full PRD (FRs, non-goals, open questions).
- `docs/EMAIL-SYSTEM-REVIEW.md` — the as-built review this PRD came from; read it once per iteration if the story touches the send pipeline.

## Grounded reality you MUST respect (verified 2026-08-12)

- **Two template systems coexist.** Call sites render react-email JSX (`emails/`, `lib/email/email.ts`) and pass finished HTML into the queue; the worker (`scripts/email-worker.ts:128-133`) replaces it iff an active `email_event_mappings` row matches. **The worker's Handlebars contract is load-bearing — none of these stories change how the worker compiles `contentHtml`.** Your pipeline work produces `contentHtml` that the existing compile step consumes.
- **`lib/security/email-sanitize.ts` is law.** The save pipeline order is render → inline → **sanitize last**. NEVER widen the sanitizer allowlist to make your output pass — change your output. Buttons are styled `<a>`, never `<button>`.
- **Uploaded images are presigned (1h expiry)** until US-005 lands. Anything email-visible must use US-005's durable public URL.
- **Worker + tenant scoping:** the worker runs outside request context. Any Prisma access you add there must remain safe if `TENANT_CONTEXT_STRICT` is enabled (use the same client/bypass pattern the worker already uses).
- **Queue payloads are versioned by tolerance:** in-flight jobs from before your change carry the old shape. New fields are optional; absence means legacy behavior (e.g. no `category` → transactional).
- **Payments are fraud-sensitive and out of scope.** US-023 touches the checkout form for ONE consent checkbox — no payment logic, no order state, nothing else.
- **`resend` is an unused dependency** — do not adopt it; BYO SMTP via nodemailer is the architecture.

## 4-phase loop

### Phase 1 — Orient

1. `git branch --show-current` → must be `ralph/email-authoring-campaigns` (else `RALPH_ABORT`).
2. Read `ralph/IMPLEMENTATION_PLAN.md`; find the **first unchecked** `- [ ] US-XXX`.
3. If every story is checked or BLOCKED, write the completion commit (Phase 4) and emit `RALPH_COMPLETE`.
4. Read that story's `acceptanceCriteria` AND `notes` in `ralph/prd.json`, then read every file the notes name.
5. `git status` + `git log --oneline -8` — confirm a clean tree. Pre-existing untracked files you did not create (e.g. `.mcp.json`, `graphify-out/`) are fine — leave them alone, never stage them.

### Phase 2 — Implement ONE story

- Read existing code first; reuse existing utils (rate-limit, tenant resolution, permissions, audit log) — search before you build.
- Keep the diff minimal and in-scope. Do NOT fix unrelated debt; do NOT refactor beyond the story.
- Prisma changes: **NEVER run `prisma migrate dev`, `migrate deploy`, or `db push`** — the configured `DATABASE_URL` may be a live database. Author the migration SQL by hand under `prisma/migrations/<timestamp>_<name>/migration.sql` following the existing pattern (or `prisma migrate diff --script` if it works offline). Validate with `pnpm prisma validate` + `pnpm prisma generate`. Migrations apply on deploy boot.

### Phase 3 — Validate

```bash
cd nextjs_space
pnpm exec tsc --noEmit        # MUST pass (exit 0) for EVERY story
```

Then per story type:
- **Stories with logic/tests in the ACs:** run the targeted suite — `pnpm vitest run <paths you added/changed>` — MUST pass. Do not run the full e2e suite.
- **Prisma stories:** `pnpm prisma validate` and `pnpm prisma generate` MUST pass; migration SQL reviewed against the schema diff.
- **UI stories ("Verify in browser"):** try `pnpm dev` with the existing `.env.local`. If the app boots, verify with the dev-browser skill (navigate, interact, screenshot). If it does NOT boot cleanly within a reasonable attempt, do NOT block and do NOT edit env files: fall back to component/unit coverage where practical and record `visual: deferred to human review` in the journal line. **Never modify `.env`/`.env.local`** (a hook blocks it; the values are real).
- **Worker stories:** `pnpm exec tsc --noEmit` covers `scripts/` too; unit-test the extracted logic (suppression check, log linkage) rather than booting the worker.

If validation fails: obvious quick fix → apply it. Otherwise revert your changes scoped to the files you touched (`git checkout -- <files>`), append a `BLOCKED` journal block explaining why, commit a `chore(email-p2): US-XXX — BLOCKED <reason>` marker, leave the checkbox UNCHECKED, and emit `RALPH_BLOCKED`. Do NOT half-ship; do NOT add `@ts-ignore`/`as any`/`eslint-disable` to force a pass.

### Phase 4 — Update plan + journal + commit + exit

1. Flip `- [ ] US-XXX` → `- [x] US-XXX` in `ralph/IMPLEMENTATION_PLAN.md` (real success only).
2. Append to `ralph/progress.txt`: `[YYYY-MM-DD] US-XXX PASS — <title>` + 2-5 bullet lines on what landed and how it was verified (include `visual: deferred` if applicable).
3. Stage files **by name** (never `git add .`/`-A`). Never stage `.env*`, credentials, `.mcp.json`, `graphify-out/`, or anything under `ralph/archive/`. A deliberate `pnpm add` stages `package.json` + `pnpm-lock.yaml` by name.
4. Commit (NO `Co-Authored-By`, NO "Generated with" footer):

   ```
   feat(email-p2): US-XXX — <one-line description>

   <2-4 line body: what landed, which ACs it satisfies, how verified>

   Story: ralph/prd.json US-XXX
   PRD: tasks/prd-email-authoring-campaigns.md
   ```

5. If this was the last executable story, append `RALPH_COMPLETE` on its own line in the commit body and emit `RALPH_COMPLETE`.
6. Exit. Do not start the next story — the outer loop re-invokes you.

## Budstack conventions (do NOT violate)

- **Secrets:** never print, log, or commit a secret VALUE — key NAMES only. `.env`/`.env.local` contain real values: never read them into output, never stage, never edit.
- **Immutability; files ≤ ~400 lines; functions < 50 lines; no `console.log` in app code** (worker/scripts CLI output is their interface and is fine). Zod validation at API boundaries. Errors handled explicitly — API routes return the standard error shape.
- **Tenant scoping is sacred:** every new tenant-admin route uses `withTenantAuth`/`withTenantAuthParams` (+ `requirePermission` where the story says); every query filters by tenantId. Public storefront routes resolve the tenant from the host — never trust a tenantId from the request body.
- **Data-driven templates:** never hardcode tenant-specific names/logos/colors/slugs in platform code.
- **Prisma:** follow existing snake_case model naming; `findFirst` with flat fields for tenant-scoped lookups (the `$extends` rewrite breaks compound-unique `findUnique` — known trap).

## Anti-patterns (will be reverted on review)

- Widening the sanitizer allowlist, or sanitizing before inlining, to make pipeline output pass.
- A single sendMail with `to: string[]` for multiple recipients — always one message per recipient.
- Editing `components/editor/tiptap.tsx` (The Wire's editor) — build `EmailComposer` alongside it; share extension lists via a new module.
- Touching payment/checkout logic beyond US-023's consent checkbox.
- Running `prisma migrate dev`/`db push`, `pnpm build` (slow; CI does it), or the full Playwright suite.
- Modifying `scripts/ralph/*` (a previous run's snapshot) or `ralph/archive/*`.
- `git add .`/`-A`; staging env files; `git push`; checking out another branch; `Co-Authored-By` trailers.
- `@ts-ignore`, `@ts-expect-error`, `as any`, `eslint-disable` to force a pass.

## When in doubt

- Re-read the story's `notes` and the named files before asserting behaviour.
- Read `CLAUDE.md` (repo root) — payment rules and conventions are binding.
- Smaller diff > bigger diff. Reuse > extend > build new.
- If a story is genuinely impossible as specced (missing dependency, wrong assumption), BLOCK it with a clear journal note rather than improvising a different design.

Begin Phase 1.
