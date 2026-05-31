# Ralph Build Prompt — PRD-206 S3 Signed URL Tenant Scoping

You are an autonomous build agent. Each invocation, you implement **ONE** unchecked user story from the plan, then exit. The outer loop re-invokes you on the next story.

## Hard branch lock (this IS a worktree)

Your repo is the worktree **`/Users/gkavanagh/Development/HealingBuds/budstack-saas-prd-206`** on branch **`ralph/prd-206-s3-tenant-scoping`**. The Next.js app lives in **`nextjs_space/`** (pnpm). node_modules is already installed in this worktree.

- This is a dedicated git worktree. Stay on branch `ralph/prd-206-s3-tenant-scoping` the whole time.
- NEVER check out a different branch. NEVER `git push`. NEVER touch `main` / `origin/main` or any sibling worktree (budstack-saas, budstack-saas-prd-216, budstack-PRD-211).
- First action of every iteration: run `git branch --show-current`. If it is not `ralph/prd-206-s3-tenant-scoping`, abort immediately by emitting `RALPH_ABORT: wrong branch` — do NOT switch branches yourself.
- All edits, reads, and commits happen in this worktree on this branch.

## The PRD

- `scripts/ralph/prd.json` — 13 user stories (US-001..US-013), with `acceptanceCriteria` AND `notes`. Both are binding.
- `scripts/ralph/IMPLEMENTATION_PLAN.md` — the checkbox list; single source of truth for progress.
- `scripts/ralph/progress.txt` — running journal; append one short block per finished story.
- `docs/PRDS/REMEDIATION/PRD-206-s3-signed-url-tenant-scoping.md` — full PRD context (17 sections, AC-1..AC-5, open questions, references with exact line numbers).

## What this PRD is

PRD-206 moves the tenant-prefix assertion **into the S3 helper layer** so every signed URL / upload is checked against the caller's `tenants/{tenantId}/` prefix before issuance. Today:

- `getFileUrl(key)` (`lib/s3.ts:60`) signs **any** key — no caller-tenant check.
- `uploadFile` (`lib/s3.ts:28`) trusts a caller-supplied `tenantPrefix`.
- Two upload routes guard with a **bypassable substring** `.includes('tenants/{id}/')` check (`tenant-admin/upload/route.ts:51`, `branding/upload/route.ts:67`).
- `signS3Path` (`app/store/preview/[templateSlug]/page.tsx:72`) has an **absolute-path passthrough** that signs `tenants/<other>/...` verbatim.

The fix: a strict path-segment-prefix guard in a new `lib/s3-tenant-guard.ts`, enforced inside `getFileUrl` + `uploadFile`, with an explicit audited super-admin bypass; remove the route substring checks; close the preview passthrough.

It is phased and dependency-ordered:

- **Phase 1 — US-001..010 (autonomous, node-only):** Vitest scaffold + the guard + its bypass-string proof + helper enforcement + the 4 named call-site migrations + unit tests. No Docker, no Clerk, no network.
- **Phase 2 — US-011, US-012 (REQUIRES Docker):** testcontainers Postgres 17 + S3-mock integration tests.
- **Phase 3 — US-013 (BLOCKED on a human decision):** Playwright cross-tenant E2E. PRD-207 **OQ-1 (Clerk test-auth approach) is Owner: Gerard and unresolved.**

## THE #1 CONSTRAINT — backward-compatible signatures

`getFileUrl` has **~20 callers** and `uploadFile` has **~15 callers** across the app (storefront, learn, marketplace, onboarding, tenant-admin, super-admin). Verify with:

```bash
cd nextjs_space && grep -rn "getFileUrl\|uploadFile" --include="*.ts" --include="*.tsx" app lib | grep -v "export async function"
```

- **DO NOT make the new tenant-scope argument required.** Add it as a backward-compatible union that ALSO accepts the legacy `contentTypeHint?: string` (and `undefined`) form. If you break the signature, typecheck fails across ~20 files and the story cannot pass.
- This PRD migrates **ONLY the 4 named security call sites** (US-006 upload + branding/upload routes, US-007 preview-image route, US-008 super-admin route, US-009 preview signS3Path). Leave the other ~16 callers on the legacy form — migrating all callers to enforce "zero unscoped calls" is **PRD-216's** CI-gate job, explicitly OUT OF SCOPE here.

## Story gating — read this before picking a story

### Stories you MAY execute autonomously

- **US-001..US-010** — Phase 1. Pure node/Vitest/typecheck. No Docker, no Clerk, no network. Run them. (US-009 has a best-effort browser verify — see its notes; if you cannot drive the preview route locally, say so in progress.txt rather than claiming success.)

### Stories gated on Docker — check first, then BLOCK if no daemon

- **US-011, US-012** need a running Docker daemon for testcontainers.
- Before implementing either, run: `docker info >/dev/null 2>&1`.
  - If it **fails** (no daemon): do NOT implement. Commit `chore(prd-206): US-XXX — BLOCKED-DOCKER (no Docker daemon for testcontainers)`, leave the plan checkbox UNCHECKED, append a progress note, and emit `RALPH_BLOCKED`. Exit.
  - If it **succeeds**: implement normally. Postgres major MUST be **17** to match production. Never replace the real DB with a mock to dodge the gate.

### Stories gated on a human decision — BLOCK, do not guess

- **US-013** depends on PRD-207 **OQ-1**: how Playwright authenticates against Clerk in test. That decision is **Gerard's and is unresolved.**
- Do NOT invent a Clerk test-auth shim, do NOT seed a fake Clerk session, do NOT disable auth. Commit `chore(prd-206): US-013 — BLOCKED-NEEDS-AUTH-DECISION (PRD-207 OQ-1, owner Gerard)`, leave the checkbox UNCHECKED, append a progress note, and emit `RALPH_BLOCKED`. Exit.

## 4-phase loop

### Phase 1 — Orient

1. `git branch --show-current` → must be `ralph/prd-206-s3-tenant-scoping` (else `RALPH_ABORT`).
2. Read `scripts/ralph/IMPLEMENTATION_PLAN.md`. Find the **first unchecked** `- [ ] US-XXX`.
3. If every story is either checked or BLOCKED (nothing left to execute), write the completion commit (Phase 4) and emit `RALPH_COMPLETE`.
4. If the next unchecked story is in a BLOCKED gate above (Docker down, or OQ-1), follow that gate's instructions — commit the BLOCKED marker and emit `RALPH_BLOCKED`.
5. Read that story's `acceptanceCriteria` AND `notes` in `scripts/ralph/prd.json`.
6. `git status` and `git log --oneline -8` to confirm a clean tree and recent history.

### Phase 2 — Implement ONE story

- Read existing code first. Grep/Glob aggressively. The story `notes` name exact files and line numbers — read those files before asserting anything about their behaviour.
- Work inside `nextjs_space/` for all app/test code. Run pnpm from there (`cd nextjs_space && pnpm …`).
- Keep the diff minimal and in-scope. Do not refactor unrelated code, do not "improve" things the story didn't ask for.
- Honour budstack conventions (next section). They are not optional.

### Phase 3 — Validate

From `nextjs_space/`:

```bash
cd nextjs_space
pnpm test                # unit stories (vitest run) — Phase 1
pnpm exec tsc --noEmit   # typecheck — MUST pass for EVERY story
```

- Every story's final AC is "Typecheck passes" → `pnpm exec tsc --noEmit` must exit 0. Confirm the ~16 un-migrated callers still compile.
- Unit stories (US-001, US-003, US-010) must make `pnpm test` green.
- Integration stories (US-011/012), only if Docker is up: `pnpm test:int` green against the real container.
- If validation fails:
  - Obvious quick fix → apply it.
  - Otherwise revert your changes scoped to the files you touched and commit a `BLOCKED:`-prefixed marker. Do NOT half-ship, do NOT add `// @ts-ignore` / `as any` to force a pass.

### Phase 4 — Update plan + journal + commit + exit

1. Edit `scripts/ralph/IMPLEMENTATION_PLAN.md`: flip `- [ ] US-XXX` → `- [x] US-XXX` for the finished story (only on real success, never for a BLOCKED marker).
2. Append a short block to `scripts/ralph/progress.txt`: `US-XXX <title> — DONE <date>` + 1-2 lines on what landed and any follow-up.
3. Stage files **by name** (never `git add .` / `git add -A`). Stage only what you touched. NEVER stage `.env`, `.env.local`, or real credentials. `.env.test` (throwaway test values only) IS committed. `package.json` / `pnpm-lock.yaml` changes from `pnpm add` ARE staged by name.
4. Commit (NO `Co-Authored-By`, NO "Generated with" footer — attribution is disabled globally):

   ```
   feat(prd-206): US-XXX — <one-line description>

   <2-4 line body: what landed and which AC it satisfies>

   Story: scripts/ralph/prd.json US-XXX
   PRD: docs/PRDS/REMEDIATION/PRD-206-s3-signed-url-tenant-scoping.md
   ```

5. If this was the **last executable** story (all remaining are BLOCKED or done), use this body instead and append `RALPH_COMPLETE` on its own line:

   ```
   feat(prd-206): US-XXX — <description>; PRD-206 Phase 1 complete (Phase 2 BLOCKED-DOCKER, Phase 3 BLOCKED-NEEDS-AUTH-DECISION)

   <body>

   RALPH_COMPLETE
   ```

6. Exit. Do not start the next story — the outer loop re-invokes you.

## Budstack conventions (do NOT violate)

- **Strict prefix, never substring:** the guard is a path-SEGMENT prefix match on `tenants/{tenantId}/`. The bug being fixed is exactly a substring `.includes` check — do not reintroduce one.
- **Account for folderPrefix:** S3 keys may be prefixed with the `folderPrefix` from `getBucketConfig()` (e.g. `development/`). The guard takes it as an argument; callers pass it.
- **Error envelope:** throw `new ApiError(message, 403)` from `@/lib/api-error` (class signature: `constructor(message, status=500, safeForClient=true)`). `apiError()` passes ApiError messages through.
- **Secrets:** NEVER print, log, or commit a real secret VALUE. All real keys live in Railway. `.env.test` contains ONLY throwaway deterministic test values. Tests load `.env.test` ONLY — NEVER the real `.env`/`.env.local`/Railway vars.
- **Data-driven templates:** NEVER hardcode template-specific values (names, logos, colours, slugs, paths) in platform OR test code. S3 is the source of truth. The guard keys off `tenantId` + the prefix convention only.
- **Module-boundary mocks OK, DB mocks NOT:** US-010 may `vi.mock` `@/lib/aws-config` + the presigner (module boundaries). Integration tests (US-011/012) hit a REAL Postgres via testcontainers — never a DB mock.
- **Immutability:** return new objects; never mutate inputs in place.
- **No `console.log` in production code.** A structured `console.warn` for the `s3.cross_tenant_sign` audit line is acceptable (PRD-215 will formalise it). Test files may log.
- **File/function size:** files < 800 lines, functions < 50 lines. Many small files > few large files.

## Anti-patterns (will be reverted on review)

- Making the getFileUrl/uploadFile scope argument REQUIRED and breaking the ~16 un-migrated callers' typecheck.
- Migrating call sites beyond the 4 named ones (that is PRD-216's job).
- Reintroducing a substring `.includes` tenant check anywhere.
- Committing or echoing a real secret value; reading the real `.env`/Railway vars in a test.
- Hardcoding a template name/logo/colour/slug/path in platform or test code.
- Replacing a real integration DB with a mock to dodge the Docker requirement.
- Inventing a Clerk test-auth shim for US-013 instead of marking BLOCKED-NEEDS-AUTH-DECISION.
- Adding `// @ts-ignore`, `@ts-expect-error`, or `as any` to make typecheck pass.
- `git add .` / `git add -A`; staging `.env`/credentials; committing with a `Co-Authored-By` trailer.
- `git push`, checking out another branch, or anything that touches `main` or a sibling worktree.

## When in doubt

- Re-read the story's `notes` field and the named source files (with line numbers) before asserting behaviour.
- Read the repo root `CLAUDE.md` and project memory for budstack rules.
- Smaller diff > bigger diff. Search before you build.
- If a story needs Docker and there is none, or needs the OQ-1 auth decision, BLOCK cleanly — never guess your way past a gate.

Begin Phase 1.
