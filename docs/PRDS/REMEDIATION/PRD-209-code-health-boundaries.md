# PRD-209 — Code Health & Boundaries (monster-file split, `lib/` reorg, ESLint gate)

> **Status:** Proposed
> **Phase:** R3 — Code Quality & Testing
> **Severity:** **MEDIUM** _(not a security hole — but 14 files breach the 800-line ceiling, `lib/` is a flat 57-file dumping ground, mock data ships in a super-admin page, and error boilerplate is copy-pasted across ~89 routes. This is the maintainability tax that makes every other PRD slower and riskier to land.)_
> **Module(s) touched:** the 14 >800-LOC files (largest: `app/tenant-admin/analytics/page.tsx`, `app/api/webhooks/drgreen/status/route.ts`), `lib/` (reorg into feature folders), `app/super-admin/audit-logs/page.tsx` + `components/admin/ActivityTimeline.tsx` (mock-data removal), a new `lib/constants.ts` (centralised magic numbers), `.eslintrc` / `eslint.config.*` (gates), repo-root `.github/workflows/ci.yml` (lint gate already runs — extend it)
> **Depends on:** **PRD-207** (test foundation — splitting a 1088-line file without tests is how regressions ship). Soft-coupled to **PRD-200** (`apiError()` rollout) and **PRD-216** (CI gate wiring).
> **Blocks:** Nothing hard, but every future refactor and the component-test expansion deferred by PRD-207 OQ-3 are cheaper once the monster files are split.
> **Owner:** Gerard + Claude.
> **Last updated:** 2026-05-29

---

## 1. Problem

The codebase works, but its structure has drifted past the global file/function-size and organisation rules (`~/.claude/rules/common/coding-style.md`: many small files, 200–400 typical, **800 max**; functions < 50 lines). Six concrete, verified problems:

1. **14 files exceed 800 LOC — the first pass under-counted as 5.** A real measurement (`find app lib components \( -name '*.ts' -o -name '*.tsx' \) | xargs wc -l | awk '$1>800'`) returns **14 files**, not 5. The measured list (descending):

   | LOC | File |
   |---|---|
   | 1088 | `app/tenant-admin/analytics/page.tsx` |
   | 1008 | `lib/i18n/translations.ts` |
   | 1004 | `components/shop/ClientOnboarding.tsx` |
   | 964 | `app/tenant-admin/branding/tabs/content-tab.tsx` |
   | 934 | `app/tenant-admin/orders/orders-table.tsx` |
   | 930 | `app/tenant-admin/products/products-table.tsx` |
   | 902 | `app/tenant-admin/branding/branding-form.tsx` |
   | 891 | `lib/section-schemas.ts` |
   | 871 | `app/store/[slug]/products/page.tsx` |
   | 857 | `app/api/webhooks/drgreen/status/route.ts` |
   | 835 | `app/super-admin/analytics/page.tsx` |
   | 808 | `app/store/[slug]/checkout/page.tsx` |
   | 804 | `app/store/[slug]/products/[id]/page.tsx` |
   | 803 | `app/super-admin/tenants/tenants-table.tsx` |

   _Correction to the first-pass review:_ it named `app/api/consultation/submit/route.ts` as a 545-line offender — verified at **545 LOC, which is under the 800 ceiling**, so it is **not** on this list (it is a separate concern for PRD-204/215, not a monster file). The genuine over-800 set is the 14 above. `lib/i18n/translations.ts` (1008) and `lib/section-schemas.ts` (891) are large-but-mostly-data; the split strategy differs for data vs logic (see §5).

2. **`lib/` is a flat 57-file top level with almost no domain grouping.** `ls lib/*.ts | wc -l` = **57** (the first pass said "60+"; the measured figure is 57 `.ts` files plus 5 existing sub-dirs — `admin/`, `data/`, `hooks/`, `i18n/`, `types/`). Dr Green clients, encryption, S3, rate-limit, tenant resolution, webhook verify, marketplace services, and template utils all sit side by side at the top level. There is no `lib/tenant/`, `lib/drgreen/`, `lib/storage/`, or `lib/security/` grouping, so discovery and ownership are poor and import cycles are easy to create.

3. **Mock data is imported into a super-admin page.** `app/super-admin/audit-logs/page.tsx:5` imports `generateMockEvents` from `@/lib/mock-data`, and `components/admin/ActivityTimeline.tsx:16` does the same. A super-admin **audit-log** view backed by *fabricated* events is worse than an empty one — it presents fiction as an audit record. (This is also why PRD-207's super-admin E2E asserts the page renders **real** audit rows.)

4. **Error-response boilerplate is copy-pasted across the API surface.** _Note: the first-pass review's "19 routes hand-roll `FAILURE_STATUS`" could **not be verified** — there is **no `FAILURE_STATUS` symbol anywhere** in the codebase (grep returns nothing)._ The **real, verified** pattern is hand-rolled `return NextResponse.json({ error: "…" }, { status: 500 })` (and 400/404 variants) duplicated across **~85 route files**, while only **33 of 107** routes import the existing `lib/api-error.ts` helper (27 of them call `apiError()` directly). So the finding holds in substance (massive duplicated error boilerplate; an envelope helper exists but is used by a minority of routes) — the specific token name in the review was wrong.

5. **Magic numbers are scattered, not centralised.** Verified examples: scrypt cost `N: 16384, r: 8, p: 1` inline at `lib/encryption.ts:24`; ZIP caps (`500 MB` / `50 MB` / `100 MB`) at `lib/template-utils.ts:10-13`; upload caps (`10 MB` / `100 MB`) at `lib/upload-validation.ts:26-27`; rate-limit windows in `lib/rate-limit.ts`. Each lives next to its use with no shared constants module, so the body cap in one place and the rate window in another drift independently and are untestable as a policy.

6. **Mixed package-manager history; standardise on pnpm.** `nextjs_space/pnpm-lock.yaml` is present (~491 KB) and there is **no `yarn.lock` and no `package-lock.json`** in the app dir, and **no `packageManager` field** in `package.json`. The review's "yarn lockfile gone, pnpm-lock present" is consistent with what is on disk — the cleanup is to make pnpm **explicit and enforced** (a `packageManager` field + a CI guard) so a contributor can't reintroduce a second lockfile.

None of this is a vulnerability, but together it is the friction that makes the security/isolation PRDs slower to land and easier to regress. This PRD pays the structural debt down: split the 14 monster files behind the PRD-207 net, give `lib/` a domain layout, delete the mock-data sink, centralise the error envelope and the magic numbers, and lock the ESLint + package-manager gates.

## 2. Users / personas

| Role | How they benefit |
|---|---|
| **Developers** | Find code by domain (`lib/drgreen/…`) instead of scanning a 57-file flat list; edit a 200-line module instead of a 1088-line page |
| **Reviewers** | A PR touches small, focused files — diffs are reviewable |
| **Gerard** | The super-admin audit page shows real events, not fabricated ones; ESLint + pnpm gates stop drift |
| **Every other PRD** | Lands against smaller, testable units; error handling is one helper, not 89 copies |

## 3. User stories

- As a **developer**, when I open `app/tenant-admin/analytics/page.tsx`, it is a thin composition of extracted chart/section components, each under the 800-line ceiling and unit-testable.
- As a **developer**, when I need the Dr Green client or the encryption helper, I find them under `lib/drgreen/` and `lib/security/`, not buried in a flat top-level list.
- As **Gerard**, the super-admin audit-log page renders real audit rows; `generateMockEvents` is gone from production paths.
- As an **API author**, I return errors via one `apiError()` envelope, and the body cap / rate window / scrypt cost I rely on come from `lib/constants.ts`, not an inline literal.
- As a **maintainer**, CI fails a PR that adds a second lockfile or a new >800-LOC file.

## 4. Acceptance criteria

**Monster-file split (behind the PRD-207 net):**

- [ ] **AC-1** All **14** files >800 LOC are brought under the ceiling (target ≤ 400 typical, 800 hard max) by extracting cohesive units — sub-components, hooks, server helpers, mappers — into focused files. The split is **behaviour-preserving**, guarded by tests written first (PRD-207) for the routes/pages touched.
- [ ] **AC-1a** The two largest **logic** files are split first as the proof pattern: `app/tenant-admin/analytics/page.tsx` (1088 → page shell + extracted chart/section components + a data-loading hook) and `app/api/webhooks/drgreen/status/route.ts` (857 → handler + extracted status-transition + persistence + mapping helpers, reusing the PRD-207 webhook test seed).
- [ ] **AC-1b** **Data-heavy** files (`lib/i18n/translations.ts` 1008, `lib/section-schemas.ts` 891) are split by domain (per-locale / per-section modules with a barrel), **not** force-fit to an arbitrary line count — the rule is cohesion, and a 900-line data map is split where it has natural seams.
- [ ] **AC-1c** A CI lint rule (AC-7) fails any **new** file > 800 LOC so the count cannot climb back to 14.

**`lib/` domain reorg:**

- [ ] **AC-2** The flat top-level `lib/` is reorganised into feature/domain folders — e.g. `lib/drgreen/` (`doctor-green-api`, `drgreen-api-client`, `drgreen-cart`, `drgreen-client-cart`, `drgreen-orders`, `dr-green-mapping`, `drgreen-webhook-verify`), `lib/tenant/` (`tenant`, `tenant-config`, `tenant-context`, `tenant-utils`, `resolve-tenant-id`, `tenant-template-upload-service`), `lib/storage/` (`s3`, `aws-config`, `upload-validation`), `lib/security/` (`encryption`, `origin-check`, `rate-limit`, `redact`, `svg-sanitize`, `css-utils`, `email-sanitize`), `lib/templates/` (`template-registry`, `template-utils`, `section-registry`, `section-schemas`, `section-align`, `blank-template-defaults`), `lib/email/`, `lib/integrations/` (`namecheap-api`, `railway-api`, `webhook`). Final taxonomy agreed in §13.
- [ ] **AC-2a** Moves use path-only refactors (re-exports/barrels where needed to stage the change); imports updated repo-wide; `tsc --noEmit` and `pnpm lint` stay green. **No behaviour change** — this is pure relocation. `lib/template-registry.ts` stays auto-generated (do not hand-edit; its generator path is updated to the new location).
- [ ] **AC-2b** No import cycles introduced (an ESLint `import/no-cycle` rule, AC-7, enforces this).

**Mock-data removal:**

- [ ] **AC-3** `app/super-admin/audit-logs/page.tsx` reads **real** `audit_logs` rows (via the Prisma audit reader), not `generateMockEvents`. The import at `:5` is removed.
- [ ] **AC-3a** `components/admin/ActivityTimeline.tsx:16` no longer imports `generateMockEvents`; it takes events via props/a real query. `lib/mock-data.ts` is deleted (or moved under `tests/fixtures/` if any test genuinely needs it) so no production path imports mock data.
- [ ] **AC-3b** A grep gate (CI, PRD-216) asserts **zero** imports of `lib/mock-data` / `generateMockEvents` from `app/**` or `components/**`.

**Error-envelope consolidation:**

- [ ] **AC-4** The ~89 routes hand-rolling `NextResponse.json({ error }, { status })` are migrated to the existing `apiError()` / `apiValidationError()` envelope in `lib/api-error.ts` (the same rollout PRD-200 AC-5 starts for the *leaky* error subset — this PRD finishes it across the remaining routes). One envelope, consistent `{ success, error: { code } }` shape, detail logged server-side only.
- [ ] **AC-4a** _Correction recorded:_ the review's "19 routes hand-roll `FAILURE_STATUS`" is superseded — **no `FAILURE_STATUS` symbol exists**; the real target is the `NextResponse.json({ error }, …)` duplication across ~85 routes vs the 33 already importing `lib/api-error.ts`. A grep gate asserts no new hand-rolled error object is added outside the helper.

**Magic-number centralisation:**

- [ ] **AC-5** A `lib/constants.ts` (or `lib/config/limits.ts`) centralises the scattered policy numbers — scrypt `{ N, r, p }` (from `lib/encryption.ts:24`), ZIP caps (`lib/template-utils.ts:10-13`), upload caps (`lib/upload-validation.ts:26-27`), rate-limit windows (`lib/rate-limit.ts`), and request body caps. Each constant is named, documented with units, and imported at its use sites. Security-sensitive constants (scrypt cost) are covered by a test asserting the value (PRD-207).

**ESLint + package-manager gates:**

- [ ] **AC-6** `next.config.js` `eslint.ignoreDuringBuilds` is addressed by **PRD-216** (build-time lint); this PRD adds the **rules**: `max-lines` (800), `import/no-cycle`, `no-restricted-imports` for `lib/mock-data`, and the `no-console` rule (per the global no-`console.log`-in-prod rule). CI `pnpm lint` already runs (repo-root `ci.yml`) and gates — these rules make it enforce the boundaries above.
- [ ] **AC-7** pnpm is made explicit: a `"packageManager": "pnpm@<version>"` field is added to `package.json`, and a CI guard fails the build if a `yarn.lock` or `package-lock.json` reappears alongside `pnpm-lock.yaml`. `engines` documents the Node + pnpm range.

## 4.1 Design framework conformance

The monster-file splits are **behaviour- and pixel-preserving** refactors of existing UI (analytics, branding, orders/products tables, storefront pages) — no new tokens, primitives, or layouts. The mock-data removal changes the super-admin audit page's *data source*, not its design-system chrome (it already uses `bs-table`/`font-mono` per the existing design-system spec). The data-driven-template rule is honoured: no template-specific value is introduced; `lib/templates/` relocation keeps S3 as source of truth.

- [x] No new tokens / primitives — refactor only
- [x] Existing UI unchanged — splits preserve render (verified by PRD-207 E2E + manual diff)
- [x] Data-driven template rule respected — no hardcoded template values added during `lib/templates/` reorg

## 5. Scope

**In scope:** split all 14 >800-LOC files (logic files decomposed; data files split by natural seam); reorganise the flat `lib/` top level into domain folders without behaviour change; remove `generateMockEvents` from the super-admin audit page + `ActivityTimeline` and delete/relocate `lib/mock-data.ts`; migrate hand-rolled error responses to `apiError()`; centralise magic numbers into `lib/constants.ts`; add ESLint boundary rules + an explicit pnpm `packageManager` field and a lockfile guard.

**Out of scope:**
- Flipping `eslint.ignoreDuringBuilds: false` at build time → **PRD-216** (this PRD supplies the rules CI lint runs).
- The full `apiError()` rollout for the **security-leaky** error subset → **PRD-200 AC-5** started it; this PRD extends it to the remaining boilerplate routes.
- The `consultation/submit/route.ts` (545 LOC) decomposition — it is **under** the ceiling, so it is not a monster-file target here (its PHI-logging concern is PRD-215, validation is PRD-204).
- Schema/`tenant.settings` typing → **PRD-208**.
- New features of any kind.

## 6. Non-functional requirements

| NFR | Requirement |
|---|---|
| Behaviour preservation | Splits and `lib/` moves change no runtime behaviour; tests (PRD-207) green before and after each |
| File size | No file > 800 LOC after this PRD; lint rule prevents regression |
| No cycles | `import/no-cycle` passes across the reorganised `lib/` |
| Build hygiene | `tsc --noEmit` + `pnpm lint` green at every commit; one lockfile only |
| No prod mock data | No `app/**`/`components/**` path imports `lib/mock-data` |
| Reviewability | Each monster-file split lands as its own reviewable PR, not one mega-diff |

## 7. Success metrics

- Files > 800 LOC: **14 → 0** (measured by the same `wc -l` command; CI lint keeps it at 0).
- `lib/` top-level loose `.ts` files: **57 → a small set** (only truly cross-cutting utilities remain at top level; the rest live in domain folders).
- Imports of `lib/mock-data` / `generateMockEvents` from `app`/`components`: **2 → 0** (CI grep gate).
- Routes hand-rolling `NextResponse.json({ error }, …)`: down from ~89 toward the `apiError()` helper; new hand-rolled errors blocked by gate.
- Magic numbers (scrypt cost, ZIP/upload caps, rate windows) sourced from `lib/constants.ts`, not inline literals.
- One lockfile (`pnpm-lock.yaml`); CI fails if a second appears; `packageManager` field present.

## 8. API surface

No external API change. Internal: error responses standardise on `apiError()`; `lib/*` import paths change (a one-time, mechanical, repo-wide update). The auto-generated `lib/template-registry.ts` keeps its contract; only its location/generator path may move.

## 9. Data model changes

None. (Schema hardening is PRD-208.)

## 10. Events emitted / consumed

None (refactor + lint). The error-envelope migration routes error *logging* through the existing server-side path; structured logging is PRD-215.

## 11. UI / UX

No visible change. The analytics/branding/orders/products/storefront pages render identically post-split; the super-admin audit page swaps fabricated events for real ones (a correctness improvement, not a redesign).

## 12. Test plan

**Unit (Vitest — PRD-207):**
- `constants.test.ts` — asserts the security-sensitive constants (scrypt `N=16384,r=8,p=1`; body/upload/ZIP caps) match their intended policy values, so a careless edit is caught.
- Tests for each helper extracted from a monster file (e.g. the Dr Green status-transition + mapping helpers pulled out of `webhooks/drgreen/status/route.ts`).

**Integration (testcontainers Postgres — PRD-207):**
- `audit-logs-page.integration.test.ts` — the super-admin audit reader returns **real** rows; no `generateMockEvents` path is reachable.
- Re-run the webhook-status integration test (PRD-207 seed) against the **split** handler to prove behaviour is preserved.

**E2E (Playwright — PRD-207):**
- The super-admin E2E (PRD-207 AC-7) asserts the audit page shows real data — this PRD's AC-3 is what makes it pass.
- The storefront-order and analytics-page renders are visually unchanged after the splits.

**Grep / lint gates (CI, PRD-216):**
- `max-lines` 800 (AC-1c), `import/no-cycle` (AC-2b), `no-restricted-imports` for `lib/mock-data` (AC-3b), lockfile guard (AC-7).

**Coverage target:** 80% on newly extracted **logic** helpers (especially anything pulled out of the Dr Green webhook handler). Pure relocation (AC-2) and data-file splits (AC-1b) are covered by the unchanged existing tests + the behaviour-preservation E2E.

## 13. Open questions

- [ ] **OQ-1** Final `lib/` taxonomy — confirm the folder set (`drgreen`, `tenant`, `storage`, `security`, `templates`, `email`, `integrations`) and what legitimately stays top-level (e.g. `db.ts`, `utils.ts`, `api-error.ts`). Owner: Gerard + Claude. Resolution: agree the tree before moving; do moves domain-by-domain, each its own PR.
- [ ] **OQ-2** Split monster files **before** or **interleaved with** the `lib/` reorg? Owner: Claude. Resolution: reorg `lib/` first (mechanical, low-risk), then split files, so extracted helpers land directly into their final domain folder.
- [ ] **OQ-3** Delete `lib/mock-data.ts` outright, or relocate under `tests/fixtures/`? Owner: Gerard. Resolution: delete if no test needs it; relocate to `tests/fixtures/` only if a Playwright/Vitest fixture genuinely uses it — never importable from `app/**`.
- [ ] **OQ-4** Should the `apiError()` migration of the remaining ~89 routes be **this** PRD or folded into PRD-200's rollout? Owner: Gerard. Resolution: PRD-200 does the security-leaky subset (its AC-5); this PRD finishes the long tail so the two don't double-touch the same files — sequence PRD-200 first.
- [ ] **OQ-5** `data`-file split granularity for `lib/i18n/translations.ts` — per-locale files, or per-namespace? Owner: Claude. Resolution: per-locale barrel (`lib/i18n/<locale>/index.ts`) so adding a language is additive.

## 14. Dependencies

**Strict:**
- **PRD-207** — splitting a 1088-line page and a 857-line webhook handler without tests is the regression-generator this suite exists to avoid; the test net must exist first.

**Soft:**
- **PRD-200** — owns the `apiError()` rollout for the leaky-error subset; this PRD extends it (sequence 200 first, OQ-4).
- **PRD-216** — wires the build-time lint flip (`ignoreDuringBuilds: false`) and runs the grep/lint gates this PRD defines.
- **PRD-208** — independent (schema), but both touch the data layer; land them on the same shared test net.

## 15. Estimated effort

- **`lib/` domain reorg (moves + import updates + cycle check):** 8 hours
- **Split the 14 monster files (logic decomposition + data-file seams), each behind tests:** 18 hours
- **Mock-data removal (audit page + ActivityTimeline + delete/relocate `mock-data.ts`):** 3 hours
- **`apiError()` migration of remaining hand-rolled routes:** 6 hours
- **`lib/constants.ts` centralisation + constant tests:** 3 hours
- **ESLint boundary rules + pnpm `packageManager` + lockfile guard:** 3 hours
- **Total:** ≈ 41 hours (≈ 5 days for 1 dev + Claude pair)

## 16. References

- Measured monster-file list (descending LOC, verified via `find app lib components \( -name '*.ts' -o -name '*.tsx' \) | xargs wc -l | awk '$1>800'`): `app/tenant-admin/analytics/page.tsx` (1088), `lib/i18n/translations.ts` (1008), `components/shop/ClientOnboarding.tsx` (1004), `app/tenant-admin/branding/tabs/content-tab.tsx` (964), `app/tenant-admin/orders/orders-table.tsx` (934), `app/tenant-admin/products/products-table.tsx` (930), `app/tenant-admin/branding/branding-form.tsx` (902), `lib/section-schemas.ts` (891), `app/store/[slug]/products/page.tsx` (871), `app/api/webhooks/drgreen/status/route.ts` (857), `app/super-admin/analytics/page.tsx` (835), `app/store/[slug]/checkout/page.tsx` (808), `app/store/[slug]/products/[id]/page.tsx` (804), `app/super-admin/tenants/tenants-table.tsx` (803)
- Mock data: `app/super-admin/audit-logs/page.tsx:5`, `components/admin/ActivityTimeline.tsx:16` (both import `generateMockEvents` from `lib/mock-data.ts`)
- Magic numbers: `lib/encryption.ts:24` (`scryptSync(... N: 16384, r: 8, p: 1)`), `lib/template-utils.ts:10-13` (ZIP caps), `lib/upload-validation.ts:26-27` (upload caps), `lib/rate-limit.ts` (rate windows)
- Error envelope: `lib/api-error.ts` (`apiError`, `apiValidationError`) — imported by 33 routes; ~85 routes hand-roll `NextResponse.json({ error }, { status })`. **`FAILURE_STATUS` does not exist in the codebase** (review claim unverified — corrected to the real `NextResponse.json` duplication)
- Package manager: `nextjs_space/pnpm-lock.yaml` present (~491 KB); no `yarn.lock`/`package-lock.json`; no `packageManager` field in `package.json`
- Lint/CI: repo-root `.github/workflows/ci.yml` runs `pnpm lint` (gating); `next.config.js` `eslint.ignoreDuringBuilds` (PRD-216)
- Standards: `~/.claude/rules/common/coding-style.md` (many small files; 800 max; functions < 50 lines), `~/.claude/rules/typescript/coding-style.md` (no `console.log` in prod)
- Memory: `MEMORY.md` (`lib/template-registry.ts` is **auto-generated — do not edit**)
- 2026-05-29 review: "14 files >800 LOC (first pass under-counted as 5)", "60+ files at top level of lib/" (measured 57), "mock data imported into super-admin audit log page", "19 routes hand-roll FAILURE_STATUS" (unverified — see above), "magic numbers scattered", "mixed package managers"

## 17. Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-05-29 | Claude (with Gerard) | Initial draft from 2026-05-29 review. |
| 0.2 | 2026-05-29 | Claude (Opus 4.8) | Measured the real numbers: **14** files >800 LOC (not 5), full list captured; `consultation/submit/route.ts` confirmed **545 LOC → not** a monster file (removed from list); `lib/` top-level = **57** `.ts` files (not 60+); mock-data sink confirmed at `audit-logs/page.tsx:5` + `ActivityTimeline.tsx:16`. **Corrected the `FAILURE_STATUS` finding: no such symbol exists** — the real target is ~89 routes hand-rolling `NextResponse.json({ error }, …)` vs 33 on `apiError()`. Confirmed pnpm-lock present, no yarn.lock, no `packageManager` field. |
