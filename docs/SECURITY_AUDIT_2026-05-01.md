# BudStack SaaS — Security Audit Report

**Date:** 2026-05-01
**Scope:** `/Users/gkavanagh/Development/HealingBuds/budstack-saas` (full main branch)
**Method:** 5 parallel domain-focused agents (secrets/encryption, auth/tenant isolation, API input validation, uploads/S3/SSRF, XSS/CSP/headers) + `pnpm audit`

**Headline:** **14 standalone CRITICALs**, 25+ HIGH, 18 MEDIUM, ~10 LOW. **67 dependency vulns** (3 critical / 23 high / 36 moderate / 5 low). Auth boundaries are mostly correct but several surfaces leak data across tenants, and tenant-authored content (CSS, HTML emails, templates) is rendered without sanitization in places where CSP gives no help (`script-src 'unsafe-inline'`).

---

## 🚨 Stop-the-bleed (do today)

### S1. `env.windows-dev` at repo root contains live secrets and is **not** gitignored

**File:** `/Users/gkavanagh/Development/HealingBuds/budstack-saas/env.windows-dev` (79 lines, 24 secrets including `AWS_ACCESS_KEY_ID=AKIA3ZLY…`, `CLERK_SECRET_KEY=sk_test_…`, `ENCRYPTION_KEY`, `NEXTAUTH_SECRET`, `DATABASE_URL`, `DRGREEN_API_KEY/SECRET_KEY`, `REDIS_URL`).

The repo `.gitignore` only matches `.env*` patterns (leading dot). `git check-ignore -v env.windows-dev` returns empty — confirmed not ignored. One `git add .` from the repo root commits the lot.

**Fix (in this order):**
1. `echo "env.*" >> .gitignore && echo "*.env" >> .gitignore && git add .gitignore && git commit`
2. **Rotate every secret in the file** — assume disclosure. Includes: AWS access key (Railway prod key per memory), Clerk secret + publishable, DrGreen API/secret, ENCRYPTION_KEY, NEXTAUTH_SECRET, DATABASE_URL, REDIS_URL.
3. **After rotating ENCRYPTION_KEY**, every encrypted DB row (`tenants.drGreenApiKey/SecretKey`, `platform_config.aws*/emailServer/redisUrl`, tenant SMTP passwords) needs re-encryption — current code throws `DecryptionError` against a stale key.
4. Delete the file from your working tree once `nextjs_space/.env.local` is populated.

### S2. `@clerk/nextjs@6.38.2` is vulnerable to CVE-2026-41248 (CVSS 9.1, middleware bypass)

Patched in `6.39.2`. Your `middleware.ts` uses the safe `if (!isPublicRoute(req))` pattern per the advisory, so the bypass surface is reduced — but **still upgrade**:

```bash
pnpm add @clerk/nextjs@^6.39.2
```

Pin same time:
- `next@14.2.x` → `15.5.10+` (5 CVEs incl. DoS via image optimizer, HTTP request deserialization)
- `nodemailer@6.10.1` → `8.0.4+` (DoS + SMTP injection + misrouting)
- `handlebars` (used in email worker) — 3 CVEs cluster around it; upgrade or replace.

---

## CRITICAL — exploitable from the public internet

| # | Issue | File:line | Impact |
|---|---|---|---|
| **C1** | **Cross-tenant Patient creation** — `/api/consultation/submit` accepts `tenantId` from request body (`z.object({ tenantId: z.string() }).passthrough()`); attaches Patient + Questionnaire + PII to whatever tenant the attacker names. | `app/api/consultation/submit/route.ts:22, 132, 162-216` | Anonymous attacker pollutes any tenant's CRM with fake prescriptions/PII. **Fix:** resolve tenant from `getCurrentTenant()` (host header), not body. Drop `.passthrough()`. |
| **C2** | **Cross-tenant customer order disclosure** — `/api/orders/customer` filters only by email, no `tenantId`. | `app/api/orders/customer/route.ts:23-39` | A customer who shops across multiple tenants gets back the union; reveals competitor relationships, prescription items, prices. **Fix:** add `tenantId: getCurrentTenant().id` to where clause. |
| **C3** | **clientId spoofing in legacy `/api/orders`** — TENANT_ADMIN can override `clientId` to any user UUID, including users in other tenants. | `app/api/orders/route.ts:94-105` | Fraudulent prescription orders dispensed under another patient's identity. **Fix:** restrict override to `prisma.users.findFirst({where:{id, tenantId: dbUser.tenantId}})`. The route may be deprecated — confirm and remove. |
| **C4** | **Mass-assignment → cross-tenant `clerkOrgId` write** — `/api/tenant-admin/branding` takes `settings` JSON.parse and dumps the whole object into `tenants.settings` with no schema. A tenant admin can set their `settings.clerkOrgId` to *another tenant's* org. The super-admin DELETE flow at `super-admin/tenants/[id]/route.ts:302` reads `(tenant.settings as any)?.clerkOrgId` and calls `clerkClient.organizations.deleteOrganization()` on it. | `app/api/tenant-admin/branding/route.ts:65, 386, 396` | Tenant admin pre-arms a future super-admin delete to nuke another tenant's Clerk org. **Fix:** Zod-parse `settings` with `.strict()`, whitelist top-level keys. |
| **C5** | **ZIP slip + zip-bomb on template upload** — `adm-zip.extractAllTo(tempDir, true)` runs on the GitHub-fetched archive with no per-entry path check, no entry-count cap, no extracted-size cap, no `Content-Length` pre-check. | `lib/template-utils.ts:81-104`, `app/api/super-admin/templates/upload/route.ts:60-167` | Crafted GitHub repo writes outside `tempDir` (path traversal) or OOM-kills the Railway container (zip bomb). **Fix:** validate each `entry.entryName` resolves under `tempDir`; cap total uncompressed size (50 MB) and entry count (500); preflight `Content-Length`. |
| **C6** | **SVG XSS** — `next.config.js:19` sets `dangerouslyAllowSVG: true`. The CSP `script-src 'none'; sandbox` only applies to `_next/image` proxy. SVGs uploaded by tenants land at `tenants/{id}/templates/{slug}/...` with `Content-Type: image/svg+xml` (`lib/s3.ts:24, 131-167`) and are served via direct `<img src=…>` from S3 — bypassing the next/image CSP. Same-origin to the storefront page. | `next.config.js:19`, `lib/s3.ts:24,151`, `lib/upload-validation.ts:5-11` (allowlist excludes SVG for *tenant* uploads but `uploadDirectoryToS3` still uploads `.svg` from GitHub templates) | Stored XSS in storefront origin; steals customer session, places fraudulent orders. **Fix:** sanitize SVG server-side (DOMPurify / svg-sanitizer) at upload OR force `Content-Disposition: attachment` + drop SVG from `uploadDirectoryToS3`. |
| **C7** | **Email templates: tenant admins author raw HTML, no sanitization, sent through Handlebars to recipient inboxes under tenant's verified sender.** | `app/api/tenant-admin/email-templates/route.ts:74`, `scripts/email-worker.ts:72-77`, `components/admin/email/EmailEditor.tsx:190-195` | Stored HTML injection / phishing vector at scale; tracking pixels for exfiltration; spoofed Clerk login forms in your customers' inboxes. **Fix:** server-side `sanitize-html` on save with email-safe allowlist (no `script/iframe/form/on*/javascript:`). Preview iframe `sandbox=""` (currently `allow-same-origin`). |
| **C8** | **CSP `script-src 'unsafe-inline'`** — neutralizes XSS containment for the dozens of React raw-HTML-injection sinks and tenant-authored content surfaces in this app. | `next.config.js:73-76` | Any stored XSS becomes script execution. **Fix:** migrate to nonce-based CSP — Clerk supports `nonce` prop, generate per-request nonce in middleware, propagate via header, remove `'unsafe-inline'` from `script-src`. |
| **C9** | **`legacyCss` injected unsanitized on every storefront layout** — sibling `customCss` is sanitized (line 323) but `legacyCss` from `extractTemplateCss()` is not. | `app/store/[slug]/layout.tsx:331` | Stored XSS via `}</style><script>…<style>{` payload if templates are ever loaded from S3 (already happens for `customCss`). **Fix:** wrap with `sanitizeCss(legacyCss)`. |
| **C10** | **MIME confusion on `uploadDirectoryToS3`** — Content-Type derived purely from filename extension, no magic-byte check, no extension allowlist. `.html`, `.js`, `.mjs` upload-able from GitHub template ZIPs. No `Content-Disposition: attachment`. | `lib/s3.ts:131-167` | Attacker hosts `payload.html` on S3 served as `text/html`; phishing/credential harvest under your bucket's reputation. **Fix:** allowlist extensions (`png/jpg/webp/woff2/svg-sanitized`) at upload; force attachment for non-image types. |
| **C11** | **Public reset-password endpoint: no rate limit, timing-oracle email enumeration.** Real path is 200–500 ms longer than the no-user path (token gen + DB update + nodemailer send) despite the "always return success" comment. | `app/api/auth/reset-password/route.ts:8-43` | Enumerate every email on the platform from any IP. **Fix:** `checkRateLimit("reset:" + ip, {maxRequests:5, windowMs:60_000})`, Zod email schema, fixed-floor sleep on no-user branch. |
| **C12** | **Public signup: no rate limit, no field caps, no email validation.** | `app/api/signup/route.ts:7-74` | Account spray across all tenants by manipulating subdomain header. **Fix:** Zod schema + IP rate limit + length caps. |
| **C13** | **Consultation submit `.passthrough()` then writes RAW body** — Zod parses but code reads `rawBody` directly. ~30-field spread into Prisma with no length caps. | `app/api/consultation/submit/route.ts:37, 49-61, 163-215` | 10MB strings persisted; arbitrary fields injected. **Fix:** use `parseResult.data`, drop `.passthrough()`, length-cap every string field. |
| **C14** | **Webhook handlers parse JSON BEFORE signature verification, no body-size limit.** Also, DB lookup `findFirst({where:{nonce}})` runs on attacker input pre-verify (timing oracle). Staging accepts unverified webhooks if `tenants.drGreenSecretKey` is null. | `app/api/webhooks/drgreen/{status,crypto,fiat}/route.ts` | Parser-crash DoS; nonce enumeration; staging-only forgery. **Fix:** body-size guard first; verify signature against rawBody; resolve `tenantId` from secret used; lookup with `{nonce, tenantId}`. |

---

## HIGH — corroborated across multiple agents

### Auth / tenant isolation

- **H_a1** Cross-tenant S3 overwrite via `branding/upload` — key is `branding/${file.name}`, no tenant prefix. `app/api/tenant-admin/branding/upload/route.ts:38-45`. Tenant A overwrites Tenant B's logo or injects malicious SVG.
- **H_a2** Destructive super-admin endpoint accepts GET — CSRF via `<img src="…/reset-templates">`. `app/api/super-admin/tenants/reset-templates/route.ts:9,107`.
- **H_a3** `cleanup-s3?prefix=templates/` deletes the entire base-template namespace if a super-admin fat-fingers. No confirm token. `app/api/super-admin/templates/cleanup-s3/route.ts`.
- **H_a4** Tenant rename PATCH skips `RESERVED_SUBDOMAINS` check; rename to `www`, `api`, `mail` collides with platform routes. `app/api/super-admin/tenants/[id]/route.ts:99-110`.
- **H_a5** `consultation/status` lookup by email with no `tenantId` — anyone enumerates customer relationships across tenants. `app/api/consultation/status/route.ts:16-19`.
- **H_a6** Clerk `user.deleted` webhook is a no-op (`// TODO`). GDPR violation — local user, orders, prescription data persist after deletion. `app/api/webhooks/clerk/route.ts:135`.
- **H_a7** DrGreen webhook order match without tenant filter (`drGreenOrderId` is global). Forged-but-valid webhook from one tenant secret can match another tenant's order ID.
- **H_a8** Customer profile / customers PATCH stores raw `body` in `audit_logs.metadata` → potential stored XSS if rendered as HTML; unbounded size. `app/api/tenant-admin/customers/[id]/route.ts:367-376`.

### Information disclosure / error leak

- **H_e1** `/api/health` (unauthenticated) returns Prisma `error.message` including connection strings/host:port on DB failure. `app/api/health/route.ts:26-30`.
- **H_e2** `recover-deleted` returns full `error.stack`. `app/api/super-admin/templates/recover-deleted/route.ts:285`.
- **H_e3** `super-admin/tenants/[id]/drgreen-keys` GET returns first 30 chars of decrypted plaintext + exact byte length. `…/drgreen-keys/route.ts:43-47, 90-122`.
- **H_e4** `test-smtp` returns `nodemailer err.message` + `err.response` (SMTP banner reveals server software/version/IP). `app/api/super-admin/test-smtp/route.ts:65-92`.
- **H_e5** `/api/store/[slug]/orders/submit` and `cart/add` return raw `error.message` to anonymous customers — exposes Dr Green endpoint paths and internal order IDs.

### Encryption

- **H_x1** `lib/encryption.ts:23` uses fixed app-wide salt for scrypt KDF (cached per-process). One key compromise = entire DB readable. Also no minimum-length check on `ENCRYPTION_KEY`.
- **H_x2** `webhooks/drgreen/status/route.ts:67-71` passes `allowUnencryptedMigration: true` with `migrationDeadline: '2026-12-31'` — `decrypt()` returns ciphertext-as-plaintext on format mismatch through year-end.

### Uploads / S3

- **H_u1** `branding/upload` uses client-side `validateUpload` (trusts browser-supplied MIME) instead of `validateUploadBuffer` with magic-byte check. `app/api/tenant-admin/branding/upload/route.ts:27`.
- **H_u2** Cross-tenant signed-URL access via `signS3Path` accepts any `tenants/*` key with no caller-tenant assertion. `lib/s3.ts:59-80`, `app/store/preview/[templateSlug]/page.tsx:73`.
- **H_u3** SSRF defence-in-depth missing on tenant template upload — host regex passes, but `node-fetch` follows redirects by default; allow-host returns 302 to internal URL. `app/api/tenant-admin/templates/upload/route.ts:41-47`.
- **H_u4** `getJsonFromS3` JSON.parse with no size/depth limits on tenant-controlled `defaults.json` / `layout.json`. Values like `cta.url = "javascript:fetch(...)"` flow through `signLayoutAssets` filter unchanged → React renders `<a href="javascript:…">`. `lib/s3.ts:183-207`.

### CSP / headers

- **H_h1** Missing `object-src 'none'`, `base-uri 'self'`, `form-action 'self' …`. `<base href>` retargeting attack possible with HTML injection. `next.config.js:73`.
- **H_h2** No `report-uri` / `report-to` — zero visibility into CSP violations. `next.config.js:73`.
- **H_h3** `img-src https://*.amazonaws.com` is over-broad. Replace with specific bucket. `next.config.js:73`.
- **H_h4** Blog page (`app/blog/[slug]/page.tsx:267`) calls `sanitizeHtml(post.content)` with **default options** (no scheme allowlist). Inconsistent with `the-wire/[postSlug]/page.tsx:51-78` which restricts iframes. Unify into `lib/sanitize.ts`.

**Input validation (quantified):** of 105 routes, 55 parse JSON, only **13 use Zod (24%)**. Only **8** routes call `checkRateLimit()`. **0** SQL injection (clean Prisma usage). 50+ routes return raw `error.message` to clients. 6 routes spread raw `body` into Prisma writes.

---

## MEDIUM (selected — 18 findings)

- **M1** `consultation/status` accepts arbitrary email queries (rate-limit + tenantId fix).
- **M2** Super-admin `tenants` POST has no Zod (no subdomain regex; no reserved-subdomain check); inconsistent with onboarding.
- **M3** `dangerousExtensions` is a blocklist (`name.includes(ext)`) — wrong design, false positives + false negatives. Move to allowlist. `lib/upload-validation.ts:53-58, 96-102`.
- **M4** `cleanContent` iframe allowlist passes Y/T+Vimeo but lacks `sandbox` attribute and explicit `allowedSchemes: ['https']`. `app/store/[slug]/the-wire/[postSlug]/page.tsx:51-78`.
- **M5** Bulk endpoints accept unbounded `productIds: []` arrays (cap at 500). `tenant-admin/products/bulk/route.ts:63`, `orders/bulk`, `super-admin/tenants/bulk`.
- **M6** `tenant-admin/products/bulk` rate limit defaults to 20/min — too lax for delete; tighten to 5/min.
- **M7** Path params (`[id]`) passed directly to Prisma without UUID validation across 16 files.
- **M8** Onboarding lacks email verification gate — register tenant under any email; squat on subdomains.
- **M9** Inconsistent auth pattern — ~40 routes use raw `currentUser()` + manual `findFirst({where:{email}})`; only ~15 use `withTenantAuth`. Migrate all to wrappers.
- **M10** Order lookup at `store/[slug]/orders/[orderId]` relies on downstream lib for tenant scope (move to handler-level explicit `where:{id, tenantId, clientId}`).
- **M11** `super-admin/learning` spreads arbitrary FormData fields with no length caps. `app/api/super-admin/learning/route.ts:193-216`.
- **M12** `decrypt()` returns ciphertext as fallback "value" silently when migration flag is on — break the contract: return `{value, wasFallback}`. `lib/encryption.ts:108-113, 132-137`.
- **M13** `console.log` of full S3 keys/tenant IDs/SMTP `dataToUpdate` spreads.
- **M14** Reset-password fallback uses platform-wide email lookup if tenant context missing.
- **M15** Storefront subdomains framing each other under `SAMEORIGIN` — different origins, blocked anyway; consider dropping `X-Frame-Options` for store and rely on `frame-ancestors`. `next.config.js:111-120`.
- **M16** Markdown converter (`learn/[slug]/markdown-content.tsx`) — DOMPurify config allows iframes from any origin via `ADD_TAGS: ['iframe']`.
- **M17** Open-redirect surface on `redirectToSignIn({ returnBackUrl: req.url })` — verify Clerk dashboard `allowedRedirectOrigins` is locked. `middleware.ts:132`.
- **M18** Three-part legacy ciphertext detector misidentifies stripped v2 prefixes (observability bug). `lib/tenant-config.ts:37-40`.

---

## LOW (selected)

- Seed scripts log default `admin123` password; bcrypt hash committed. `scripts/seed.ts:347-356`.
- `next.config.js:8: outputFileTracingRoot: '../'` traces parent — audit standalone bundle for leaked files.
- Rate limiter fails open when Redis unavailable — pair with alerting. `lib/rate-limit.ts:92-96`.
- Permissions-Policy minimal — extend to a comprehensive deny list. `next.config.js:88`.
- `eslint.ignoreDuringBuilds: true` skips security-relevant lint rules. `next.config.js:12`.
- Admin analytics CSP `'unsafe-eval'` for plotly.js — migrate to `plotly.js-basic-dist-min` or `recharts`.
- `node-fetch` v2 in template-utils — migrate to native `fetch`.
- Iframe email preview with `sandbox="allow-same-origin"` — set to `sandbox=""`. `components/admin/email/EmailEditor.tsx:214`.
- Section components: `href={consultationUrl}` from `defaults.json` without scheme validation — add `safeHref()` helper that rejects `javascript:`/`data:`/`vbscript:`.

---

## Top 10 Prioritized Fixes (by risk × effort)

1. **`env.windows-dev` → gitignore + rotate every secret.** (S1) — 30 min ops, prevents catastrophic disclosure.
2. **`pnpm add @clerk/nextjs@^6.39.2 next@^15.5.10 nodemailer@^8.0.4`** + retest. (S2) — closes 3 critical CVEs and ~20 highs.
3. **Fix `/api/consultation/submit`, `/api/consultation/status`, `/api/orders/customer`, `/api/orders`** — resolve tenant from middleware, drop client `tenantId` and `clientId` overrides, drop `.passthrough()`. (C1, C2, C3, C13, H_a5)
4. **Zod `.strict()` on `tenant-admin/branding` `settings`** — kills the cross-tenant `clerkOrgId` weaponization. (C4)
5. **Reject SVG in `uploadDirectoryToS3` content-type map + force `Content-Disposition: attachment` on signed URLs for `.svg`** + sanitize at upload. (C6, C10)
6. **ZIP entry validation + size caps in `downloadGitHubRepo`/`extractAllTo`.** (C5)
7. **Server-side `sanitize-html` on `email-templates` save + `sandbox=""` on preview iframe.** (C7)
8. **Rate-limit + Zod on `signup` and `reset-password`; constant-time floor on no-user reset branch.** (C11, C12)
9. **Webhook signature first, JSON parse second, body-size cap, tenant-id derived from secret.** (C14, H_a7)
10. **CSP hardening: nonces in middleware → drop `script-src 'unsafe-inline'`; add `object-src 'none'; base-uri 'self'; form-action`; tighten `img-src` to specific bucket; add `report-uri`.** (C8, H_h1, H_h2, H_h3)

After top 10: convert all 40 `currentUser()` routes to `withTenantAuth`-style wrappers (M9), unify blog/learn sanitization helpers (H_h4 + M16), kill the dead `/api/orders` if confirmed deprecated, sanitize `legacyCss` (C9), shorten the DrGreen webhook migration deadline.

---

## Verified safe (no findings)

- `middleware.ts:46-48` deletes `x-tenant-*` headers before any path that re-sets them — clients can't forge tenant identity.
- `tenant-admin/customers/[id]` enforces explicit `existingCustomer.tenantId !== localUser.tenantId`.
- `store/[slug]/cart/**` correctly binds `dbUser.id` + `tenant.id`.
- `super-admin/templates/[id]` DELETE properly guarded post-2026-04-29 incident.
- Clerk webhook signature (Svix) verified.
- DrGreen signature path uses SHA-256 + timing-safe compare.
- Zero SQL injection — `$queryRawUnsafe`/`$executeRawUnsafe` clean across all app routes.
- No permissive CORS configured anywhere.

---

## Dependency CVEs (pnpm audit summary)

**Total: 67 vulnerabilities — 3 critical / 23 high / 36 moderate / 5 low**

### Critical

| Package | Installed | Patched | CVE |
|---|---|---|---|
| `@clerk/nextjs` | 6.38.2 | 6.39.2 | CVE-2026-41248 (CVSS 9.1) — middleware route bypass |
| `@clerk/shared` | 3.47.0 | 3.47.4 | CVE-2026-41248 |
| `handlebars` | 4.x | 4.7.9+ | JS injection via AST type confusion |

### High (selected)

- `next@14.2.35` → 15.5.10+ (DoS via image optimizer, HTTP request deserialization, Server Components DoS)
- `nodemailer@6.10.1` → 8.0.4+ (`addressparser` DoS, SMTP command injection via `envelope.size`, misrouting of recipients)
- `glob@10.3.10` (transitive via `eslint-config-next`) → 10.5.0+ (CLI command injection via -c/--cmd)
- `lodash@4.17.21` (transitive via `recharts`) → 4.17.23+ (prototype pollution + code injection via `_.template`)
- `undici` → multiple WebSocket vulns (memory overflow, unhandled exceptions, unbounded memory consumption)
- `serialize-javascript` → RCE
- `flatted`, `picomatch`, `fast-xml-parser`, `socket.io` — various high-sev DoS / prototype pollution

### Recommended action

```bash
cd nextjs_space
pnpm add @clerk/nextjs@^6.39.2
pnpm update next nodemailer handlebars
pnpm audit --fix
pnpm audit --audit-level high
```

Re-test middleware behavior after the Clerk upgrade (drop-in patch per advisory; no API changes). Re-test image optimization and email rendering after `next` and `nodemailer` upgrades.

---

## Scope summary

- 105 API route files audited across `tenant`, `tenant-admin`, `super-admin`, `store`, `webhooks`, `auth/signup/onboarding`, `consultation`
- `middleware.ts` reviewed (subdomain + custom-domain rewrite + Clerk auth)
- `next.config.js` security headers + CSP reviewed
- `lib/encryption.ts`, `lib/s3.ts`, `lib/upload-validation.ts`, `lib/rate-limit.ts`, `lib/template-utils.ts`, `lib/tenant.ts`, `lib/api-auth.ts`, `lib/auth-helper.ts` reviewed
- Storefront rendering pipeline (`TemplateRenderer`, `tenant-theme-provider`, blog/learn pages) reviewed
- `pnpm audit` against full dependency tree

Out of scope: AWS infra (bucket policies, CloudFront, IAM), Railway service config, Clerk dashboard settings, runtime traffic patterns.
