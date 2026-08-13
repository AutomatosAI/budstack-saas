# Email System Review — non-technical authoring, newsletters & CRM

**Date:** 2026-08-12 · **Scope:** `nextjs_space/` email templates, sending pipeline, and what it takes to let non-technical tenants send newsletters/blog emails with images, and grow toward CRM campaigns.
All paths relative to `nextjs_space/` unless noted.

---

## 1. As-built map (verified)

### Authoring
- `components/admin/email/EmailEditor.tsx` — the entire authoring UX is a **raw HTML `<textarea>`** (L190–195) beside a sandboxed iframe preview (L210–215). Variables (`{{businessName}}`, `{{orderNumber}}`, `{{#each items}}`…) exist only as a click-to-copy popover (L32–46). Shared by super-admin and tenant admin.
- Super-admin surface: `app/super-admin/emails/` (list + mapper tabs, `new/`, `[id]/`). Tenant surface: `app/tenant-admin/emails/` (list + mapper, `new/`, `[id]/`), with a clone-system-template flow (`TenantTemplateList.tsx:71–96`).
- Event mappers: super-admin knows 4 events (`EmailEventMapper.tsx:22–43`); tenant mapper knows 7 — `welcome`, `passwordReset`, `tenantWelcome`, `orderConfirmation`, `userInvite`, `paymentFailed`, `subscriptionUpdated` (`TenantEventMapper.tsx:24–60`, server allowlist `app/api/tenant-admin/email-mappings/route.ts:15–23`).

### Storage (prisma/schema.prisma)
- `email_templates` (L50–68): `contentHtml`, **`contentJson Json?` — dormant** (written nowhere, passed through once at `app/super-admin/emails/[id]/page.tsx:29`), `category`, `isSystem`, `isActive`, nullable `tenantId` (null = platform default).
- `email_event_mappings` (L70–82): `@@unique([eventType, tenantId])` — tenant override → system default resolution.
- `email_logs` (L31–48): QUEUED/SENT/FAILED + `smtpResponse`/`errorMessage`.

### APIs
- Super-admin CRUD: `app/api/super-admin/email-templates/` (+`[id]`), `email-mappings/` — `withSuperAdmin`; POST forces `isSystem: true, tenantId: null`.
- Tenant CRUD: `app/api/tenant-admin/email-templates/` (+`[id]`, `clone/`), `email-mappings/` — `withTenantAuth` with strict ownership in the `where`.
- Both write paths run `sanitizeEmailHtml`/`sanitizeEmailSubject` (`lib/security/email-sanitize.ts`) — solid allowlist, `<img>` allows `http/https/data/cid`, `<style>` + inline styles allowed, 200k-char cap (`EMAIL_HTML_MAX_LENGTH`), 512KB request cap.
- ⚠️ `canViewEmails`/`canEditEmails` permission keys exist (`lib/permissions/permission-keys.ts:25–26`) but are enforced **only at nav level** — the email API routes check tenancy, not permission. Part of the known "~31 legacy routes role-only" sweep.

### Sending pipeline
- `sendEmail` (`lib/email/email.ts:23`) → `MailerService.send` (`lib/email/mailer.ts:20`) → BullMQ `email-sending` (`lib/queue.ts:21–37`: **3 attempts, exponential backoff, 7-day retention**) + `email_logs` QUEUED row.
- Worker `scripts/email-worker.ts`: PRD-220 stale-job expiry guard (L76–81); **dynamic template override** — mapping lookup tenant→system, then `Handlebars.compile` of `contentHtml` + `subject` (L128–133; helpers `multiply`, `toFixed`); transport = tenant SMTP from `tenants.settings.smtp` (encrypted) → `platform_config.emailServer` → `EMAIL_SERVER` env (L144–204); concurrency 5 (global, not per-tenant); heartbeat + stuck-queue alert (L282–314) read by `app/api/super-admin/ops/email-health/`.
- ⚠️ SENT/FAILED log update matches "most recent QUEUED row with same (tenantId, recipient, subject)" (L219–227) — a heuristic that mis-attributes under concurrent same-subject sends. Fine at transactional volume; breaks at campaign volume.

### Two disconnected template systems
1. **Code path:** 9 react-email JSX components in `emails/`, rendered at ~10 call sites (`signup`, `reset-password`, `onboarding`, `orders`, `lib/drgreen/status-event-handlers.ts` ×7, `lib/team/invite-email.ts`, `lib/legal/subprocessor-announce.ts`) which pass **fully-rendered HTML** into the queue.
2. **DB path:** that HTML is silently replaced by the worker *iff* an active `email_event_mappings` row matches `templateName`. So editing a DB template does nothing until it's mapped — a support-call generator. Seeds (`scripts/seed-email-templates.ts`) bridge the two by rendering react-email components with `{{placeholder}}` props.

### What does not exist
- **No test-send endpoint** anywhere. No tenant-facing email log UI (US-003 of `docs/PRDS/prd-email-system.md` — only the super-admin health route shipped).
- **No subscriber list.** The storefront Newsletter CTA is a stub: `components/sections/ctas/Newsletter.tsx:24–27` — `handleSubmit` sets `submitted=true` and **discards the address**, then renders "Thanks for subscribing!" and promises "No spam, ever. Unsubscribe anytime." It is registered in `lib/templates/section-registry.ts:49,105`, so any live storefront using the section is losing real signups today. Second identical stub: `components/home/educational-content.tsx:25–32`.
- **No consent field, no unsubscribe route, no suppression list, no `List-Unsubscribe` header** — all specced in `prd-email-system.md` §4.4 ("day one"), none built. Worker sends bare `from/to/subject/html` (L208–213).
- **No campaign/broadcast/segment/audience model or endpoint.** Closest precedent is the serial admin loop in `lib/legal/subprocessor-announce.ts:144–173` (no batching/rate-limit/suppression).
- **No CSS inliner** (no `juice`/`mjml`). `resend@6.12.4` is in `package.json` but **never imported** — dead dependency (or a future option).

### Adjacent assets worth reusing
- **TipTap 3.26 already ships** in `components/editor/tiptap.tsx`, used by The Wire blog (`app/tenant-admin/the-wire/post-form.tsx`) with cover-image upload to `/api/tenant-admin/upload`. Its image button is a `window.prompt("URL")` (L22–27) — needs the upload wired in.
- **The Wire posts** (`posts` model: title/slug/content-HTML/excerpt/coverImage/published) are a ready-made newsletter source.
- **S3 upload infra** is hardened (magic-byte validation, tenant prefix, scope guard: `lib/storage/s3.ts`, `upload-validation.ts`) — **but the bucket is private and `getFileUrl()` returns 1-hour presigned URLs** (`s3.ts:105–130`; the route comment at `app/api/tenant-admin/upload/route.ts:50–53` acknowledges the follow-up). An image embedded in an email — or a Wire cover — breaks within an hour.
- Customers API (`app/api/tenant-admin/customers/`): PATIENT rows with email/name/phone/`_count.orders`; permission keys incl. `canViewCRM` exist. No consent/tags/segments — usable targeting axes today are only `isActive`, `createdAt`, `_count.orders`.

---

## 2. What blocks the goal (ranked)

| # | Blocker | Why it matters |
|---|---|---|
| B1 | Raw-HTML editor | Non-technical users cannot author at all — the core ask. |
| B2 | Presigned-only image URLs (1h) | Any image a user uploads dies in the inbox. Also a live bug for Wire covers. Hard prereq for "upload images". |
| B3 | No email-safe rendering | TipTap emits semantic HTML w/ classes; Outlook/Gmail need inlined CSS + table-friendly layout. Needs render→inline→sanitize on save. |
| B4 | Newsletter CTA discards signups; no subscribers/consent/unsubscribe/suppression | No audience to send to, and current UI makes a promise the platform can't keep. Legal exposure the moment marketing mail flows (POPIA §69 for ZA, GDPR, CAN-SPAM). |
| B5 | No campaign model / bulk fan-out | `MailerService.send` accepts `to: string[]` but a single nodemailer message would expose every address in To:. Needs per-recipient jobs, rate caps, per-recipient status. |
| B6 | No test-send, no tenant log UI | "Did my customer get it?" is the #1 email support question; the data is already in `email_logs`. |
| B7 | Two-path template rendering | Edited DB templates only apply when mapped; hardcoded call sites otherwise win. Confusing today, untenable once tenants author for real. |

---

## 3. Recommendation — phased

### Phase 0 — quick wins (~2–3 days, independent of everything else)
1. **Wire the Newsletter CTA to a real table** (`newsletter_subscribers`) + public rate-limited subscribe endpoint + confirmation email through the existing queue. Or, if deferred, remove the section from the registry — the false promise is worse than the missing feature.
2. **Test-send button** — endpoint that renders template + sample variables and sends to the logged-in admin via the existing queue.
3. **Tenant email-log page** (list + SMTP error detail from `email_logs`; PRD US-003).
4. **`requirePermission(canEditEmails/canViewEmails)`** on the tenant email routes (fold into the known sweep).
5. **Pass `logId` in job payload**; worker updates by id, not the (recipient, subject) heuristic. Prereq for campaign volume.

### Phase 1 — non-technical editor (~1.5–2 weeks)
**Extend the in-repo TipTap 3 editor into a shared "simple mode"; keep the HTML tab as advanced mode.**
- New `EmailComposer` built on `components/editor/tiptap.tsx` extensions: headings, lists, buttons (styled `<a>`), divider, image.
- **Branded shell:** users edit only the body. On render, wrap content in a tenant shell (logo, `primaryColor`, footer with business address + unsubscribe slot) — a react-email layout component rendered server-side. Kills 90% of the "HTML is hard" problem; boilerplate stops being editable/breakable.
- **Merge tags as chips:** TipTap Mention-style node inserting `{{userName}}` etc., serialized as literal handlebars text so the existing worker compile (email-worker.ts:128) keeps working unchanged. Filter the tag list by the event's variable set.
- **Images:** wire the editor's image button to `/api/tenant-admin/upload` + a **durable public URL** (B2). Cheapest fix: a public streaming route (`/api/public/images/[...key]` → S3 GetObject, long `Cache-Control`, Cloudflare caches) — no infra change, tenant-scoped keys, also fixes Wire covers. Alternative: CDN (CloudFront/Cloudflare) in front of a `public/` prefix.
- **Save path:** store TipTap JSON in the dormant `contentJson`, render body → shell → **inline CSS (add `juice`)** → `sanitizeEmailHtml` → `contentHtml`. Worker untouched. Templates with only `contentHtml` (legacy/hand-written) open in the HTML tab.
- Editor toolbar: mobile/desktop preview widths in the existing iframe; test-send button (Phase 0).

**Why not a drag-drop builder first:** newsletters and blog digests are document-shaped — TipTap's writing UX fits, it's already shipped (The Wire), zero new vendors, and one editor serves blog + email. Evaluated alternatives:

| Option | License / cost | Verdict |
|---|---|---|
| Extend TipTap 3 (in repo) | MIT, already shipped | **Phase 1 pick.** Lowest risk; work = shell + inliner + merge tags + image wiring. |
| `@usewaypoint/email-builder` (EmailBuilderJS) | MIT, React 18 OK | Best OSS drag-drop-blocks option; JSON doc + deterministic HTML renderer; `{{vars}}` survive as text. Young (0.0.9, Jan 2026). **Phase 2 candidate** if tenants want product-grid marketing emails. |
| Maily.to (`@maily-to/core` 0.3.7) | MIT, active (3.9k★) | Notion-style email editor with variables + `@maily-to/render`. **Bundles TipTap v2** while app has v3 — two ProseMirror majors in the bundle. Viable, not first choice. |
| Unlayer (`react-email-editor`) | wrapper MIT; editor is a **hosted CDN embed**, free tier + paid features | Fastest Mailchimp-grade UX (merge tags, image upload hooks) but external vendor script in the admin, feature paywalls — verify current pricing before committing. |
| GrapesJS + newsletter preset | MIT | Self-hosted drag-drop; aging preset, heaviest integration. Pass. |

### Phase 2 — newsletter/campaign MVP (~2–3 weeks)
Models (sketch):
```prisma
model newsletter_subscribers { id tenantId email status(PENDING|CONFIRMED|UNSUBSCRIBED|SUPPRESSED) source consentAt confirmedAt unsubscribedAt token @@unique([tenantId, email]) }
model campaigns { id tenantId name subject contentHtml contentJson status(DRAFT|SCHEDULED|SENDING|SENT|CANCELLED) audience Json scheduledAt sentAt stats Json }
model campaign_recipients { id campaignId email userId? status emailLogId @@unique([campaignId, email]) }
model email_suppressions { tenantId email reason createdAt @@unique([tenantId, email]) }
```
- **Compose** = Phase-1 editor; **audience v1** = confirmed subscribers ∪ customers with marketing consent (add `marketingConsentAt` to users; capture at checkout/signup — currently no field exists).
- **Fan-out:** one BullMQ job per recipient (never `to: string[]`), per-tenant rate cap (e.g. N/min) to protect tenant SMTP reputation; campaign progress from per-recipient statuses.
- **Compliance built-in, not optional:** signed-token unsubscribe route → suppression table checked by the worker; `List-Unsubscribe` + `List-Unsubscribe-Post` (one-click, Gmail/Yahoo bulk-sender requirement) on every marketing send; mandatory footer (physical address + unsubscribe) enforced by the shell; double opt-in for storefront signups (POPIA §69 consent for ZA; GDPR/CAN-SPAM elsewhere). Marketing vs transactional consent tracked separately (the original PRD's `EmailConsent`).
- **"Send post as newsletter"** button on The Wire: prefill campaign from `posts.title/excerpt/content/coverImage` through the same shell/inline/sanitize path.
- Scheduling via BullMQ delayed jobs; kill-switch = campaign status check at send time.

### Phase 3 — CRM-lite (incremental)
- Segments as saved filters (last-order age, order count, KYC status, tags) — aligns with the BudStacks GTM goal (patient reorders): "hasn't ordered in 60 days" is the money segment.
- Automations: welcome series, re-order reminder (event-driven, reuse event-mapping pattern).
- Open/click tracking (pixel + wrapped links) — per-tenant toggle, privacy-note in policies.
- Deliverability guidance surfaced in SMTP settings: Gmail app-password SMTP caps (~500/day) make it unfit for newsletters; recommend a real ESP SMTP per tenant. **Check ESP acceptable-use policies — many (e.g. Mailchimp) prohibit cannabis marketing; BYO-SMTP is the right architecture for this vertical, keep it.**

---

## 4. Traps for whoever builds this

- **Editor↔sanitizer contract:** render → inline → sanitize → store, and keep the editor's output inside the `email-sanitize.ts` allowlist (no `<button>`; buttons are styled `<a>`). Sanitizer already permits `class`/`style`/`<style>`.
- **200k-char template cap:** hosted image URLs only — a single pasted base64 image can blow the cap (`data:` URIs are allowed by the sanitizer but must not become the default path).
- **Worker + tenant scoping:** the email worker needs `bypassTenantScope` if `TENANT_CONTEXT_STRICT` ever goes live (known landmine from PR #209 work).
- **Two-path convergence (B7):** long-term, call sites should enqueue `(templateName, variables)` and let the worker always resolve (DB mapping → seeded default), instead of pre-rendering react-email HTML as the implicit fallback. Until then, auto-map seeded defaults so "edit template" visibly works.
- **Handlebars:** variables are system-supplied today — keep it that way; never let subscriber-controlled strings become template source (only variable *values*, which Handlebars escapes on `{{ }}`).
- **Deploys:** the worker is the Railway sidecar from PR #194 — campaign volume makes its health (already instrumented via PRD-220) genuinely load-bearing.

## 5. Suggested order

Phase 0 items 1+5 → B2 public-image fix → Phase 1 editor → Phase 2 campaigns → Phase 3. Phase 0 items 2–4 slot in anywhere.
