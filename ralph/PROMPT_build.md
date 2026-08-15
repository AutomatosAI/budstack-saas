# Ralph Build Prompt — Platform content and SEO

You are implementing `tasks/prd-platform-content-and-seo.md`: verify the article typography sweep, move budstacks.io's blog out of code into `platform_posts` with super-admin authoring, and give the platform its own managed SEO.

## Hard branch lock

Your repo is **`/Users/gkavanagh/Development/Dr-Green-Cannexis/budstack-saas`** on branch **`ralph/platform-content-seo`**. The Next.js app lives in **`nextjs_space/`** (pnpm).

- Stay on `ralph/platform-content-seo` the whole time.
- NEVER check out a different branch. NEVER `git push`. NEVER touch `main`/`origin/main`. **This repo auto-deploys on merge to main — pushing/merging is a human decision only.**
- First action of Phase 1: `git branch --show-current`. If it is not `ralph/platform-content-seo`, emit `RALPH_ABORT: wrong branch` and stop.

## The plan

`ralph/IMPLEMENTATION_PLAN.md` is the checklist; `ralph/prd.json` holds the acceptance criteria. 20 stories in three workstreams: A is one verification story, B moves the blog out of code (US-002 → US-012, strictly ordered), C is platform SEO (US-013 → US-020).

## Grounded reality you MUST respect (verified 2026-08-15)

- **Migrations apply themselves — IF authored correctly.** `nextjs_space/entrypoint.sh` runs `npx prisma migrate deploy` on container boot, and 40 timestamped migration directories ship that way. A loose `.sql` dropped at the top of `prisma/migrations/` is **silently ignored** — there are seven such files (`add_platform_leads.sql` and friends) and none of them has ever been applied by a deploy; that is why `platform_leads` needed manual psql. **Always author `prisma/migrations/<timestamp>_<name>/migration.sql`.** Never `migrate dev` / `db push` — `DATABASE_URL` may be live.
- **`tenantScopedModels` in `lib/db.ts` is an OPT-IN allowlist.** Platform models (`platform_posts`, `platform_seo_settings`) must stay OUT of it, exactly like `platform_leads` and `learning_resources`. Adding them breaks every apex query. This is the one place the repo-wide "new models join tenantScopedModels" convention is deliberately inverted.
- **`users` and `posts` ARE tenant-scoped.** That is why platform posts are a separate table with a denormalised author, not tenant `posts` with a null `tenantId`.
- **`app/api/platform/leads` is deliberately UNAUTHENTICATED** — its header says so, because a prospect has no account. It is the only existing `/api/platform/*` route. **Do not model the new write APIs on it.** Use `withSuperAdmin` / `withSuperAdminParams` from `lib/api-auth.ts` (~line 150); these will be the first `/api/platform/*` routes to use them.
- **The build-time Prisma mock returns `[]` for every query** (`DATABASE_URL` is a dummy), so any page reading the database needs `export const dynamic = "force-dynamic"` or it bakes an empty result into the static output.
- **The Prisma client export is any-widened**, so `findMany`/`groupBy` results make map callbacks implicit `any` → TS7006. Declare row types explicitly on every new query.
- **`getCurrentUser().id` is a Clerk id, not `users.id`.** Using it as a UUID FK throws P2003 (this broke the lekkerweed blog in #226).
- **`isPublicRoute` in `middleware.ts` is an allowlist**, and `scripts/ci/check-public-routes-allowlisted.mjs` now enforces it. Any new public page or unauthenticated handler must be added there or CI fails.
- **`@tailwindcss/typography` is NOT installed.** Every `prose-*` class is inert; `scripts/ci/check-no-inert-prose-classes.mjs` fails the build on new ones. Use `.bs-article` (platform, `app/globals.css`) or `.tenant-article` (storefront, inside `TENANT_SCOPED_CSS` in `components/tenant-theme-provider.tsx`).
- **Already built, REUSE — do not rewrite:** `lib/seo/article-json-ld.ts`, `lib/seo/breadcrumb-json-ld.ts`, `lib/seo/platform-url.ts` (`platformBaseUrl()`), `seo_redirects` (schema ~line 267), the 22 components in `components/admin/seo/`, and the tenant Wire admin (`app/tenant-admin/the-wire/`, `post-form.tsx` 473 lines / `posts-list.tsx` 224).

## Crash recovery protocol

If Phase 1 finds uncommitted tracked changes that clearly belong to the story you are about to pick (a predecessor iteration died mid-story), do NOT abort: adopt the work as a draft, verify its load-bearing claims against the real code, finish or replace it on your judgement, then journal (noting the adoption) and commit normally. Pre-existing untracked files you did not create (`.mcp.json`, `CLAUDE.md`, `graphify-out/`, `.gitignore` modifications, `nextjs_space/scripts/docs-shots/`) are ambient — leave them alone, never stage them.

## 4-phase loop

### Phase 1 — Orient
1. `git branch --show-current` → must be `ralph/platform-content-seo` (else `RALPH_ABORT`).
2. Read `ralph/IMPLEMENTATION_PLAN.md`; find the **first unchecked** `- [ ] US-XXX`.
3. If every story is checked or BLOCKED, emit `RALPH_COMPLETE`.
4. Read the story's `acceptanceCriteria` + `notes` in `ralph/prd.json`, then every file they name.
5. `git status` + `git log --oneline -8` (crash-recovery protocol above if relevant).

### Phase 2 — Implement ONE story
- Read existing code first; reuse existing utils (auth wrappers, rate-limit, audit log, S3 client, JSON-LD builders, SEO components). Search before you build.
- Minimal, in-scope diff. Adjacent debt gets FLAGGED in the journal, not fixed.
- Metadata work: `generateMetadata` must share the page's existing fetch via React `cache()` — never add a second copy of the same query.

### Phase 3 — Validate
```bash
cd nextjs_space
pnpm exec tsc --noEmit        # MUST exit 0 for EVERY story
```
- **Targeted tests** for the story (`pnpm vitest run <files>`) MUST pass, then the **full unit project** (`pnpm vitest run`) MUST pass. Cross-story regressions are yours to fix if your diff caused them, and yours to flag (BLOCKED-style journal note, never a silent skip) if pre-existing.
  - **Known pre-existing:** the CI `test:cov` job fails on per-file COVERAGE THRESHOLDS (not test failures), and flags different files run to run. 171 test files pass. If `pnpm vitest run` is green but coverage thresholds complain, that is the known state — journal it, do not chase it.
- **Prisma stories:** `pnpm prisma validate` + `pnpm prisma generate`; migration SQL diffed against `pnpm prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` conventions.
- **Both CI guards must stay green:** `pnpm check:public-routes` and `pnpm check:article-typography`.
- **UI stories:** try `pnpm dev` with the existing `.env.local` and use the **dev-browser skill** where the story asks for it. Super-admin pages are Clerk-gated — if you cannot authenticate, fall back to component/route tests and write `visual: deferred to human review` in the journal rather than claiming a check you did not do. **Never modify `.env`/`.env.local`.** Public routes (`/blog`, sitemaps) CAN be curled live — do it and record the result.
- `pnpm check:security` and `pnpm lint` (touched files) clean.

If validation fails: obvious fix → apply. Otherwise revert your files, journal a `BLOCKED` block with the reason, commit a `chore(platform): US-XXX — BLOCKED <reason>` marker, leave the checkbox unchecked, emit `RALPH_BLOCKED`. Never `@ts-ignore` / `as any` / `eslint-disable` to force a pass.

### Phase 4 — Update plan + journal + commit + exit
1. Flip the checkbox (real success only).
2. Append to `ralph/progress.txt`: `[YYYY-MM-DD] US-XXX PASS — <title>` + decision-level bullets (what landed, what was found, how verified).
3. Stage files **by name** (never `git add .` / `-A`). Never stage `.env*`, `.mcp.json`, `CLAUDE.md`, `graphify-out/`, `.gitignore`, or `ralph/archive/`.
4. Commit:
   ```
   feat(platform): US-XXX — <one-line description>

   <2-4 line body: what landed, ACs satisfied, verification>

   Story: ralph/prd.json US-XXX
   PRD: tasks/prd-platform-content-and-seo.md
   ```
5. Last executable story → append `RALPH_COMPLETE` in the body and emit it. Exit; the loop re-invokes you.

## Budstack conventions (do NOT violate)

- **Secrets:** key NAMES only, never values. `.env*` contents never appear in code, logs, tests, or journals.
- **Tenant scoping is sacred:** every tenant-admin route uses the permission wrappers; every query names tenantId; public storefront routes resolve the tenant from the HOST, never from the body. **Platform models are the documented exception — they stay out of `tenantScopedModels`.**
- **Immutability; files ≤ ~400 lines; no `console.log` in app code; Zod at every API boundary; standard error shapes.**
- **Prisma:** snake_case models; `findFirst` with flat fields for tenant-scoped lookups (compound-unique `findUnique` breaks under the `$extends` rewrite).

## Anti-patterns (will be reverted on review)

- **Shipping an unauthenticated write API** by copying the shape of `app/api/platform/leads`.
- Adding a platform model to `tenantScopedModels`.
- A loose `.sql` file at the top of `prisma/migrations/` instead of a timestamped directory — it will never run.
- Deleting the inline blog arrays (US-012) before US-010 and US-011 have both put the content in the database.
- Allowing a published post's slug to change before US-019 exists — that 404s a live URL and discards its inbound links.
- Rendering an empty blog when the database query threw — an outage must not look like "no posts".
- Writing a second JSON-LD implementation instead of reusing `lib/seo/article-json-ld.ts`.
- Adding a new `prose-*` class anywhere.
- `git push`; branch switching; staging by wildcard; touching `scripts/email-worker.ts`, payment/checkout code, or `ralph/archive/*`.

## When in doubt

- Re-read the story's notes and named files. Read repo `CLAUDE.md` and `tasks/prd-platform-content-and-seo.md`.
- Smaller diff > bigger diff. Reuse > extend > build new.
- A story impossible as specced → BLOCK with a clear journal note; never redesign silently.

Begin Phase 1.

## Run deltas (override where they conflict with the text above)

- **US-001 is a VERIFICATION story, not a build story.** It has a precondition: if `.tenant-article` is absent from `components/tenant-theme-provider.tsx`, the `feat/article-typography` PR has not been merged into this branch's base — emit `RALPH_BLOCKED` immediately rather than building anything.
- **Workstream D (rewriting the six legacy sample posts) is NOT in this run.** US-011 migrates them as-is so their URLs stay live; the editorial rewrite is a human's, against framing rules Gerard set (frame the economics, never "passive income"; no revenue promises anywhere).
- **US-019 unblocks US-007.** The editor deliberately disables published-slug edits until the auto-301 exists; when US-019 passes, re-enable it and say so in the journal.
