# PRD: Security Remediation — Phased Fix Plan

> **ARCHIVED 2026-05-29 — superseded foundation doc.** This May-2026 phased fix plan is the origin of the structured remediation suite ([`../PRDS/REMEDIATION/REMEDIATION-INDEX.md`](../PRDS/REMEDIATION/REMEDIATION-INDEX.md), PRD-200–216), which is now the system of record for open items. Retained for historical reference per PRD-214 OQ-1.

**Status:** In Progress
**Date Started:** 2026-05-01
**Source audit:** `docs/SECURITY_AUDIT_2026-05-01.md`
**Priority:** Critical → High → Medium → Low (per-phase)
**Strategy:** One feature branch per phase, Railway staging deploy per branch, merge to `main` only after staging gate passes.

---

## 1. Problem Statement

Full-repo security audit (2026-05-01) identified **14 CRITICAL**, 25+ HIGH, 18 MEDIUM, ~10 LOW findings, plus **67 dependency vulns** (3 critical / 23 high). Cross-tenant data leaks in 4 routes, mass-assignment via tenant settings, unsanitized tenant-authored HTML/CSS, ZIP slip in template upload, missing rate limits on public endpoints, weak CSP, and CVE-2026-41248 in Clerk middleware.

## 2. Goals

1. Close all 14 CRITICAL findings before any other work.
2. Close all 25+ HIGH findings.
3. Resolve 18 MEDIUM and ~10 LOW findings.
4. Close all 3 critical and 23 high dependency CVEs.
5. **Zero functional regressions** — every phase passes staging gate before merge.

## 3. Non-Goals

- **Next 14 → 15 migration** — deferred to a separate PRD due to scale (async cookies/headers/params, server-action API changes, image optimization changes). Track as `prd-next-15-migration.md`.
- AWS infra hardening (bucket policies, CloudFront, IAM) — out of scope.
- Railway service config changes beyond env vars.
- Clerk dashboard config (allowed redirect origins audit only — no config rewrite).

## 4. Constraints

- Production deploys from `main`. Cannot push directly to `main` mid-phase.
- Staging auto-deploys from feature branches at `budstack-saas-staging.up.railway.app`.
- Tests run via `pnpm test` and E2E via Playwright (`pnpm test:e2e`).
- Database is multi-tenant — every fix must preserve tenant isolation contract.
- Encryption uses v2 prefix (`v2:iv:authTag:ciphertext`); ENCRYPTION_KEY rotation requires migration script.

---

## Phase 0 — Stop the Bleed

**Branch:** `security/phase-0-secrets`
**Estimated effort:** half day code + ~2 hours user ops
**Risk:** HIGH (key rotation breaks DB reads if migration script wrong)
**Findings:** S1, S2

### Scope

- **S1 — `env.windows-dev` exposure**
  - Add `env.*` and `*.env` to root `.gitignore` (current pattern only matches `.env*` with leading dot).
  - Audit local file disposition: file was **never committed** (verified `git log --all -- env.windows-dev` empty). Local-only exposure.
  - **User must rotate** every secret in `env.windows-dev` (defense in depth):
    - AWS access key (`AKIA3ZLY…`) → AWS console → rotate, push new key to Railway env vars
    - `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` → Clerk dashboard → rotate
    - `DRGREEN_API_KEY`, `DRGREEN_SECRET_KEY` → DrGreen merchant console → rotate
    - `ENCRYPTION_KEY` → generate new 32+ byte secret → run migration script (below) → push to Railway
    - `NEXTAUTH_SECRET` → regenerate → push to Railway
    - `DATABASE_URL`, `REDIS_URL` → Railway proxies these via reference vars; no rotation needed unless raw URL exposed
  - Delete `env.windows-dev` from working tree after Railway env confirmed.

- **Migration script: `scripts/rotate-encryption-key.ts`**
  - Accepts `OLD_ENCRYPTION_KEY` and `NEW_ENCRYPTION_KEY` as env args.
  - Iterates: `tenants.drGreenApiKey`, `tenants.drGreenSecretKey`, `tenants.smtpPassword`, `platform_config.aws*`, `platform_config.emailServer`, `platform_config.redisUrl`, any other encrypted columns.
  - For each row: `decrypt(old) → encrypt(new) → UPDATE`.
  - Dry-run mode (default): log what would change without writing.
  - Confirm mode: actually writes. Wrapped in transaction per table.
  - Idempotent: skip rows already in new format (heuristic: try decrypt with new key first).

- **S2 — Clerk patch (deferred to Phase 8a)**
  - Listed here for completeness; the actual bump goes in Phase 8 to keep dep upgrades batched.

### Test Plan

- Run migration script in dry-run against staging DB clone (use pg_dump from Railway — see memory: `pg_dump v17 required`).
- Verify dry-run output matches expected row count.
- Run in confirm mode against staging DB clone.
- Smoke test on staging: tenant SMTP test, DrGreen webhook, branding load.
- Only then rotate in production.

### Staging Gate

- [ ] `.gitignore` updated, `env.*` matched
- [ ] Migration script tested in dry-run on staging clone
- [ ] Migration script tested in confirm mode on staging clone
- [ ] Staging app loads tenant branding, sends test SMTP, receives DrGreen webhook
- [ ] User confirms ready to rotate production secrets

### Rollback

- Restore old `ENCRYPTION_KEY` from Railway env var history; rows migrated under new key become unreadable until rolled forward again. Migration script can be re-run in reverse.

---

## Phase 1 — Cross-Tenant Data Leaks

**Branch:** `security/phase-1-cross-tenant`
**Estimated effort:** 1 day
**Risk:** LOW (pure correctness; no UX change for legitimate users)
**Findings:** C1, C2, C3, C13, H_a5

### Scope

| ID | File | Fix |
|---|---|---|
| C1 | `app/api/consultation/submit/route.ts` | Resolve tenant from `getCurrentTenant()` (host header), drop `tenantId` from body schema, drop `.passthrough()` |
| C2 | `app/api/orders/customer/route.ts` | Add `tenantId: getCurrentTenant().id` to where clause |
| C3 | `app/api/orders/route.ts` | If route is kept: restrict `clientId` override to `findFirst({where:{id, tenantId: dbUser.tenantId}})`. Investigate first whether route is dead. |
| C13 | `app/api/consultation/submit/route.ts` | Use `parseResult.data` not `rawBody`; length-cap every string field |
| H_a5 | `app/api/consultation/status/route.ts` | Add `tenantId` to email lookup |

### Test Plan

- Unit tests: each route rejects requests where body `tenantId` mismatches host-derived tenant.
- Integration test: cross-tenant attack vectors (auth as Tenant A, attempt to write/read Tenant B data) all return 403/empty.
- E2E: existing consultation submission, customer order lookup, store cart — all still pass.
- Manual: walk through Healing Buds storefront submit flow on staging.

### Staging Gate

- [ ] All affected routes covered by new unit + integration tests
- [ ] Existing E2E suite green
- [ ] Manual storefront walk-through clean
- [ ] No Sentry errors on staging for 24h after deploy

### Rollback

- Revert merge commit on `main`. Each route is independent so partial rollback also possible.

---

## Phase 2 — Public Endpoint Hardening

**Branch:** `security/phase-2-public-hardening`
**Estimated effort:** 0.5 day
**Risk:** LOW
**Findings:** C11, C12, M14

### Scope

| ID | File | Fix |
|---|---|---|
| C11 | `app/api/auth/reset-password/route.ts` | `checkRateLimit("reset:" + ip, {maxRequests:5, windowMs:60_000})`, Zod email schema, fixed-floor `await sleep(jitter)` on no-user branch |
| C12 | `app/api/signup/route.ts` | Zod schema (email, name caps), IP rate limit (10/min), tenant subdomain validation |
| M14 | `app/api/auth/reset-password/route.ts` | Constrain email lookup to current tenant when tenant context exists |

### Test Plan

- Unit: rate-limit returns 429 after threshold; Zod rejects malformed input.
- Integration: timing test confirms reset-password returns same latency for existent vs nonexistent email (±50ms).
- Manual: legitimate signup + reset flow on staging still works.

### Staging Gate

- [ ] Rate-limit verified via burst test (51 reqs from same IP → 429s after 5)
- [ ] Timing test variance < 50ms
- [ ] Legitimate signup + reset green on staging

---

## Phase 3 — Mass Assignment + Email HTML

**Branch:** `security/phase-3-mass-assignment`
**Estimated effort:** 1 day (includes DB audit)
**Risk:** MEDIUM (`tenants.settings` may have unexpected keys)
**Findings:** C4, C7, M11

### Scope

- **DB audit first:** `SELECT DISTINCT jsonb_object_keys(settings) FROM tenants;` to inventory existing keys before locking schema.
- **C4** `app/api/tenant-admin/branding/route.ts` — Zod `.strict()` schema on `settings`, whitelist keys. Reject `clerkOrgId` writes from tenant admin path entirely.
- **C7** `app/api/tenant-admin/email-templates/route.ts` + `scripts/email-worker.ts` — server-side `sanitize-html` with email-safe allowlist (no `script/iframe/form/on*/javascript:`). Preview iframe `sandbox=""`.
- **M11** `app/api/super-admin/learning/route.ts` — explicit field allowlist + length caps on FormData fields.

### Test Plan

- Unit: schema rejects unknown keys, `clerkOrgId` write returns 403.
- Integration: existing tenant settings load correctly post-audit (run audit script, ensure all keys are whitelisted).
- Email render test: malicious HTML stripped (`<script>`, `<iframe>`, `onerror=`).
- E2E: branding save + email template save flows pass.

### Staging Gate

- [ ] DB audit complete, allowlist matches existing keys
- [ ] All existing tenants' branding loads on staging
- [ ] Email worker sends sanitized email successfully
- [ ] No tenant admin can set `clerkOrgId`

---

## Phase 4 — Upload / Storage Pipeline

**Branch:** `security/phase-4-uploads`
**Estimated effort:** 2-3 days (largest blast radius)
**Risk:** MEDIUM-HIGH (template upload is critical for onboarding)
**Findings:** C5, C6, C10, H_a1, H_u1, H_u2, H_u3, H_u4, M3

### Scope

| ID | File | Fix |
|---|---|---|
| C5 | `lib/template-utils.ts` + `app/api/super-admin/templates/upload/route.ts` | Validate each `entry.entryName` resolves under `tempDir`; cap total uncompressed size (50 MB) and entry count (500); preflight `Content-Length` |
| C6 | `lib/s3.ts` + `lib/upload-validation.ts` | Sanitize SVG server-side (svg-sanitizer), OR force `Content-Disposition: attachment` + drop `.svg` from `uploadDirectoryToS3` |
| C10 | `lib/s3.ts` | Allowlist extensions in `uploadDirectoryToS3`; force attachment for non-image |
| H_a1 | `app/api/tenant-admin/branding/upload/route.ts` | Key prefix: `tenants/{tenantId}/branding/...` not `branding/{file.name}` |
| H_u1 | `app/api/tenant-admin/branding/upload/route.ts` | Use `validateUploadBuffer` (magic-byte) not `validateUpload` (header-trust) |
| H_u2 | `lib/s3.ts` + `app/store/preview/[templateSlug]/page.tsx` | `signS3Path` requires caller-tenant assertion; reject paths outside `tenants/{callerTenantId}/...` for non-super-admin |
| H_u3 | `app/api/tenant-admin/templates/upload/route.ts` | `node-fetch` with `redirect: 'manual'` + re-validate redirect target against allowlist |
| H_u4 | `lib/s3.ts:183-207` | Cap `getJsonFromS3` at 1MB; depth-limit JSON parse; whitelist `cta.url` schemes (`https:` only) |
| M3 | `lib/upload-validation.ts:53-58, 96-102` | Replace `dangerousExtensions` blocklist with `allowedExtensions` allowlist |

### Test Plan

- Unit: ZIP slip payload (`../../../etc/passwd`) rejected.
- Unit: zip-bomb (small archive, 10GB extracted) rejected via size cap.
- Unit: SVG with `<script>` rejected or sanitized.
- Unit: Cross-tenant signed URL request returns 403.
- Integration: Template upload from valid GitHub URL still succeeds.
- Integration: Branding logo upload (PNG/JPG/WebP) still succeeds.
- E2E: Onboarding flow (tenant create + template clone + custom upload) green on staging.

### Staging Gate

- [ ] All malicious payloads rejected in tests
- [ ] All legitimate upload flows pass on staging
- [ ] Preview signed URL works for own tenant, blocks cross-tenant
- [ ] No S3 file path collisions across tenants (verify with `aws s3 ls`)

---

## Phase 5 — Webhook Security

**Branch:** `security/phase-5-webhooks`
**Estimated effort:** 1 day
**Risk:** MEDIUM (third-party integration test required)
**Findings:** C14, H_a7, H_x2

### Scope

- **C14** `app/api/webhooks/drgreen/{status,crypto,fiat}/route.ts`
  - Read raw body first (`await req.text()`).
  - Reject if `body.length > 100_000` (413).
  - Verify signature against rawBody before any JSON.parse.
  - Resolve `tenantId` from the secret used to verify, not from body.
  - Lookup nonce with `{nonce, tenantId}` not `{nonce}` alone.
- **H_a7** Same files — order match with `{drGreenOrderId, tenantId}` filter.
- **H_x2** `webhooks/drgreen/status/route.ts:67-71` — change `migrationDeadline` from `'2026-12-31'` to `'2026-06-01'` (one month grace) and prepare follow-up to remove `allowUnencryptedMigration` entirely.

### Test Plan

- Replay attack: send same webhook twice → second rejected (nonce dedup).
- Signature mismatch: garbled signature → 401, no DB read.
- Body-size: 200KB body → 413.
- Cross-tenant order match: webhook from Tenant A's secret naming Tenant B's order ID → 404.
- DrGreen sandbox happy-path: order status update flows through to local order state.

### Staging Gate

- [ ] All replay/forgery tests pass
- [ ] DrGreen sandbox webhook delivery confirmed on staging
- [ ] Order status update → reflected in tenant admin UI

---

## Phase 6 — Information Disclosure / Error Sanitization

**Branch:** `security/phase-6-info-leak`
**Estimated effort:** 0.5 day
**Risk:** LOW
**Findings:** H_e1, H_e2, H_e3, H_e4, H_e5, M12, M13

### Scope

| ID | File | Fix |
|---|---|---|
| H_e1 | `app/api/health/route.ts:26-30` | Generic error message; log full error server-side |
| H_e2 | `app/api/super-admin/templates/recover-deleted/route.ts:285` | Drop `error.stack` from response |
| H_e3 | `app/api/super-admin/tenants/[id]/drgreen-keys/route.ts:43-47, 90-122` | Return only redacted indicator (`****` + last 4); never plaintext bytes |
| H_e4 | `app/api/super-admin/test-smtp/route.ts:65-92` | Generic SMTP error; log full server-side |
| H_e5 | `/api/store/[slug]/orders/submit`, `cart/add` | Generic error to anonymous customers |
| M12 | `lib/encryption.ts:108-113, 132-137` | Change `decrypt()` return type to `{value, wasFallback}`; fail closed when migration flag false |
| M13 | Multiple | Replace `console.log(...secret-bearing object...)` with structured logger that auto-redacts |

### Test Plan

- Unit: each error path returns generic message, server-side log retains detail.
- Manual: trigger DB connection failure, observe `/api/health` returns 503 with no connection string.

### Staging Gate

- [ ] All error responses scrubbed
- [ ] Server-side logs still show full diagnostics
- [ ] decrypt() type signature change compiles across callers

---

## Phase 7 — GDPR + Audit Log

**Branch:** `security/phase-7-gdpr-audit`
**Estimated effort:** 0.5 day
**Risk:** LOW (additive, no breaking changes)
**Findings:** H_a6, H_a8

### Scope

- **H_a6** `app/api/webhooks/clerk/route.ts:135` — Implement `user.deleted`:
  - Find local `users` row by `clerkUserId`
  - Anonymize or delete: `users`, `orders` (set `clientId = null`, retain order for tax records), `patient_records`, `consultation_questionnaires`, `audit_logs` author refs
  - Decision: full delete vs anonymize — confirm with legal before merging.
- **H_a8** `app/api/tenant-admin/customers/[id]/route.ts:367-376` — cap `audit_logs.metadata` at 10KB serialized; `sanitize-html` if any HTML-like content detected.

### Test Plan

- Trigger Clerk `user.deleted` webhook in dev → verify local data anonymized.
- Insert oversized metadata → truncated.

### Staging Gate

- [ ] User deletion webhook end-to-end test green
- [ ] Audit log size cap verified

---

## Phase 8 — Dependency Upgrades

**Branch:** `security/phase-8-deps` (split into sub-PRs)
**Estimated effort:** 2-3 days total
**Risk:** HIGH (breaking changes in 8b, 8c)
**Findings:** S2 + 67 dep CVEs

### 8a — Clerk Patch

**Sub-branch:** `security/phase-8a-clerk`
**Risk:** LOW (drop-in patch per advisory; no API changes)

```bash
pnpm add @clerk/nextjs@^6.39.2
```

- Re-test `middleware.ts` route protection.
- Re-test signup, signin, organization switching.

### 8b — Nodemailer 6 → 8

**Sub-branch:** `security/phase-8b-nodemailer`
**Risk:** HIGH (breaking — `addressparser` API, options shape, error types)

- Read [nodemailer migration guide](https://nodemailer.com/announcements/v8/) before editing.
- Update `scripts/email-worker.ts` and `app/api/super-admin/test-smtp/route.ts`.
- E2E: full email send flow via staging SMTP.

### 8c — Handlebars Upgrade

**Sub-branch:** `security/phase-8c-handlebars`
**Risk:** MEDIUM

- Pin to `4.7.9+`; check email-template render output unchanged.
- Consider replacing with safer alternative (e.g., `mustache` for strict templates) if migration painful.

### Out of scope here

- **Next 14 → 15** — separate PRD. Leave note in this PRD's "Non-Goals" referring to `prd-next-15-migration.md`.
- **Other transitive vulns** (`undici`, `glob`, `lodash`, etc.) — most clear via `pnpm update` after the named bumps. Run `pnpm audit --audit-level high` at end of phase; fix any remaining.

### Test Plan (whole phase)

- After each sub-bump: `pnpm install && pnpm build && pnpm test`.
- E2E: full Clerk auth flow, email send, template render.
- Staging deploy + 24h monitoring before merging next sub-bump.

### Staging Gate (per sub-phase)

- [ ] Build + test green
- [ ] No new Sentry errors on staging for 24h
- [ ] Affected user-facing flows verified (auth, email, template)

---

## Phase 9 — CSP Hardening

**Branch:** `security/phase-9-csp`
**Estimated effort:** 1-2 days
**Risk:** MEDIUM (CSP changes break inline scripts unexpectedly)
**Depends on:** Phase 8a (Clerk supports `nonce` prop in 6.39+)
**Findings:** C8, C9, H_h1, H_h2, H_h3, H_h4, M16

### Scope

- **Per-request nonce in `middleware.ts`**:
  - Generate `crypto.randomUUID()` per request
  - Inject as `X-Nonce` response header
  - Pass to layout via React server context
  - Clerk `<ClerkProvider nonce={nonce}>`
  - All `<Script nonce={nonce}>` on layouts
- **`next.config.js` CSP rewrite:**
  - Migrate `script-src 'self' 'unsafe-inline'` → `script-src 'self' 'nonce-RANDOM'`
  - Add `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`
  - Tighten `img-src https://*.amazonaws.com` → `https://budstack-uploads.s3.eu-west-1.amazonaws.com`
  - Add `report-uri` (Sentry CSP endpoint or local handler)
- **C9** `app/store/[slug]/layout.tsx:331` — wrap `legacyCss` with `sanitizeCss()`.
- **H_h4 + M16** — unify blog + the-wire + learn into shared `lib/sanitize.ts` with strict iframe allowlist (YouTube, Vimeo) + `sandbox` attr.

### Rollout Strategy (CRITICAL)

1. Deploy in **report-only mode** first: `Content-Security-Policy-Report-Only` header.
2. Wait one week, monitor reports.
3. Fix any unexpected violations.
4. Flip to enforce: `Content-Security-Policy`.

### Test Plan

- Unit: nonce generation per-request, header propagation.
- Manual: Lighthouse CSP audit on every storefront variant.
- E2E: customer flow on storefront with strict CSP doesn't break.
- Test that legacyCss with malicious payload is sanitized.

### Staging Gate

- [ ] Report-only deployed, 7 days clean reports
- [ ] All inline scripts have nonce attribute
- [ ] Storefronts render correctly across all 21 section components
- [ ] Customer checkout works end-to-end

---

## Phase 10 — Auth Pattern Unification + Remaining Findings

**Branch:** `security/phase-10-cleanup`
**Estimated effort:** 2-3 days
**Risk:** MEDIUM (touches every route)
**Findings:** M9, M2, M5, M6, M7, M8, M10, M15, M17, M18, all LOW

### Scope

- **M9** Migrate ~40 routes from raw `currentUser()` + `findFirst({where:{email}})` to `withTenantAuth` wrapper. Delete duplicated auth boilerplate.
- **M2** Super-admin `tenants` POST → Zod schema with subdomain regex + reserved-subdomain check.
- **M5** Bulk endpoints → cap `productIds: []`, `orderIds: []`, etc. at 500.
- **M6** `tenant-admin/products/bulk` → tighten rate limit from 20/min to 5/min for delete.
- **M7** UUID validation on every `[id]` path param (16 files).
- **M8** Onboarding email verification gate (Clerk verification before tenant create).
- **M10** Order lookup `where: {id, tenantId, clientId}` explicit at handler level.
- **M15** Drop `X-Frame-Options` for store; rely on `frame-ancestors` (already in CSP from Phase 9).
- **M17** Verify Clerk dashboard `allowedRedirectOrigins` is locked.
- **M18** `lib/tenant-config.ts:37-40` — fix three-part legacy ciphertext detector (observability bug).
- **All LOW**:
  - Remove `admin123` from seed scripts
  - Audit `outputFileTracingRoot` standalone bundle
  - Add Redis-down alerting
  - Extend Permissions-Policy
  - Re-enable `eslint.ignoreDuringBuilds` (set to `false`)
  - Replace `plotly.js` with basic-dist or recharts (drop `'unsafe-eval'`)
  - Migrate `node-fetch` v2 → native `fetch`
  - Email preview iframe `sandbox=""`
  - `safeHref()` for section component links

### Test Plan

- Full E2E suite green.
- Every migrated route covered by existing tenant-isolation tests.

### Staging Gate

- [ ] Full E2E suite passes on staging
- [ ] No auth regressions reported in 48h staging soak
- [ ] All findings closed in `SECURITY_AUDIT_2026-05-01.md` updated tracker

---

## Tracker

Status of each phase. Updated as we progress.

| Phase | Branch | Status | Staging deploy | Merged |
|---|---|---|---|---|
| 0 — Stop the bleed | `security/phase-0-secrets` | 🟡 In progress | — | — |
| 1 — Cross-tenant leaks | `security/phase-1-cross-tenant` | ⚪ Pending | — | — |
| 2 — Public hardening | `security/phase-2-public-hardening` | ⚪ Pending | — | — |
| 3 — Mass assignment | `security/phase-3-mass-assignment` | ⚪ Pending | — | — |
| 4 — Uploads | `security/phase-4-uploads` | ⚪ Pending | — | — |
| 5 — Webhooks | `security/phase-5-webhooks` | ⚪ Pending | — | — |
| 6 — Info leak | `security/phase-6-info-leak` | ⚪ Pending | — | — |
| 7 — GDPR | `security/phase-7-gdpr-audit` | ⚪ Pending | — | — |
| 8a — Clerk | `security/phase-8a-clerk` | ⚪ Pending | — | — |
| 8b — Nodemailer | `security/phase-8b-nodemailer` | ⚪ Pending | — | — |
| 8c — Handlebars | `security/phase-8c-handlebars` | ⚪ Pending | — | — |
| 9 — CSP | `security/phase-9-csp` | ⚪ Pending | — | — |
| 10 — Cleanup | `security/phase-10-cleanup` | ⚪ Pending | — | — |

Legend: ⚪ pending · 🟡 in progress · 🟢 staging green · ✅ merged · ❌ blocked

---

## Per-phase workflow

Every phase follows this loop:

1. `git checkout main && git pull && git checkout -b security/phase-N-name`
2. Implement scope (small commits)
3. `pnpm test && pnpm build` locally
4. `git push -u origin security/phase-N-name` → Railway auto-deploys to staging
5. Run staging gate checklist
6. Manual smoke + E2E on staging URL
7. If green for stipulated soak time → open PR to `main` → merge → next phase
8. If red → fix on branch → re-deploy → re-test → repeat

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| ENCRYPTION_KEY rotation breaks DB reads | M | H | Migration script tested in dry-run on staging clone first |
| CSP enforce mode breaks third-party scripts | M | M | Report-only mode for 7 days first |
| Nodemailer 8 breaks SMTP delivery | M | H | Test on staging SMTP before merge; rollback plan |
| Phase 4 breaks template upload | M | H | Heavy E2E coverage; canary tenant test |
| Cross-tenant fix breaks legitimate flow | L | H | Existing E2E suite must pass before merge |
| Clerk patch introduces auth regression | L | M | 24h staging soak |

