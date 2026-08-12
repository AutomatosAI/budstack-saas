# PRD: Email System Phase 2 — Authoring, Newsletters & Campaigns

**Status:** Draft · **Date:** 2026-08-12 · **Owner:** Gerard
**Source review:** `docs/EMAIL-SYSTEM-REVIEW.md` (2026-08-12) — read it first; every file/line reference below is verified there.
**Predecessor:** `docs/PRDS/prd-email-system.md` (Phase 1 — SMTP & observability, shipped).

---

## 1. Introduction

Phase 1 delivered a reliable transactional pipeline (BullMQ queue → worker → tenant SMTP, template overrides via event mappings, sanitized storage). Phase 2 makes the system usable by **non-technical tenant admins** and adds the **outbound-marketing half**: a visual editor with image upload, a real subscriber list with consent and unsubscribe, one-off campaigns (newsletters, blog digests), and CRM-lite targeting.

It also fixes two shipped defects that block everything else:
1. The storefront Newsletter section **silently discards every signup** (`components/sections/ctas/Newsletter.tsx:24-27`; duplicate stub in `components/home/educational-content.tsx:25-32`).
2. All uploaded images get **1-hour presigned S3 URLs** (`lib/storage/s3.ts:105-130`) — an image in a delivered email (or a Wire blog cover) dies within the hour.

All paths relative to `nextjs_space/`.

## 2. Goals

- A tenant admin with no HTML knowledge can create, preview, test-send, and activate a branded email template end-to-end.
- Storefront newsletter signups are captured, confirmed (double opt-in), and unsubscribable; consent state is queryable.
- A tenant can send a campaign (newsletter or blog post) to their audience with per-recipient delivery status, rate-capped fan-out, and compliant headers/footer.
- Images uploaded for emails and blog posts render indefinitely (durable public URLs).
- Every marketing send carries `List-Unsubscribe` (+ one-click POST) and an enforced footer (business address + unsubscribe link).
- The existing worker Handlebars contract (`scripts/email-worker.ts:128-133`) keeps working unchanged — Phase 2 produces `contentHtml` it can already compile.

## 3. User Stories

Ordered by workstream. **A must land before C; A5 (images) before B4; B before C2.** Each story is one focused session and one shippable PR (⚠️ merges deploy immediately — see §7).

---

### Workstream A — Foundations & fixes

### US-001: Newsletter subscribers model
**Description:** As the platform, I need a tenant-scoped subscriber table so storefront signups persist.

**Acceptance Criteria:**
- [ ] Prisma model `newsletter_subscribers`: `id`, `tenantId` (FK, cascade), `email`, `status` enum `PENDING|CONFIRMED|UNSUBSCRIBED|SUPPRESSED`, `source` (e.g. `storefront-cta`), `consentAt`, `confirmedAt`, `unsubscribedAt`, `token` (unique, for confirm/unsubscribe links), `createdAt`, `updatedAt`; `@@unique([tenantId, email])`, index on `[tenantId, status]`
- [ ] Migration generated; migrations run on boot (existing behavior) — no manual step
- [ ] Typecheck passes

### US-002: Public subscribe endpoint + wire the stubs
**Description:** As a storefront visitor, I want my newsletter signup to actually register so the store can email me.

**Acceptance Criteria:**
- [ ] `POST /api/storefront/newsletter/subscribe` — public, tenant resolved from host (existing tenant-resolution util), zod-validated email, rate-limited (reuse existing API rate-limit util), upserts `PENDING` row with fresh token; idempotent for existing CONFIRMED/UNSUBSCRIBED rows (no status downgrade)
- [ ] Returns generic success regardless of prior state (no subscriber enumeration)
- [ ] `Newsletter.tsx` and `educational-content.tsx` POST to it; error state shown on failure — success copy no longer lies
- [ ] Unit test: duplicate subscribe does not downgrade CONFIRMED → PENDING
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Double opt-in confirmation
**Description:** As a store owner, I want subscribers confirmed so my list is consented and deliverable.

**Acceptance Criteria:**
- [ ] Subscribe enqueues a confirmation email (existing queue; `templateName: "newsletterConfirm"`; seeded default template) with signed confirm link
- [ ] `GET /api/storefront/newsletter/confirm?token=` sets `CONFIRMED` + `confirmedAt`, invalidates token for reuse, redirects to storefront with a friendly notice
- [ ] Expired/unknown token → friendly error page, no state change
- [ ] `newsletterConfirm` added to tenant event-mapper allowlist (`app/api/tenant-admin/email-mappings/route.ts:15-23`) and `TenantEventMapper.tsx`
- [ ] Typecheck passes

### US-004: Unsubscribe route + suppression enforcement
**Description:** As a recipient, I want one-click unsubscribe that is actually honored on every future marketing send.

**Acceptance Criteria:**
- [ ] Prisma model `email_suppressions`: `tenantId`, `email`, `reason` (`unsubscribed|bounced|manual`), `createdAt`; `@@unique([tenantId, email])`
- [ ] `GET /api/storefront/newsletter/unsubscribe?token=` → confirmation page; `POST` (same token) sets subscriber `UNSUBSCRIBED` + writes suppression row. `POST` alone must work headerlessly (RFC 8058 one-click target)
- [ ] Worker: before sending any job flagged `category: "marketing"`, check suppression; suppressed → mark log `FAILED` with reason `suppressed`, do not send, do not retry
- [ ] Unit tests: suppression blocks marketing send; transactional sends unaffected
- [ ] Typecheck passes

### US-005: Durable public image URLs
**Description:** As a tenant admin, I want uploaded images to keep working forever so emails and blog covers don't break after an hour.

**Acceptance Criteria:**
- [ ] `GET /api/public/images/[...key]` streams from S3 (existing client), only under each tenant's `tenants/{tenantId}/uploads/` prefix (reuse `s3-tenant-guard` path assertion; reject traversal), sets `Cache-Control: public, max-age=31536000, immutable` and correct `Content-Type`
- [ ] Upload responses include the durable URL alongside the presigned one
- [ ] The Wire cover images and `posts.coverImage` use durable URLs for new uploads (no backfill required; note in PR description)
- [ ] Non-image keys (magic-byte check on first bytes or extension allowlist) → 404; unknown key → 404 without S3 error leakage
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill (image loads; response headers correct)

### US-006: Test-send endpoint + button
**Description:** As an admin editing a template, I want to send it to myself so I can see it in a real inbox.

**Acceptance Criteria:**
- [ ] `POST /api/tenant-admin/email-templates/[id]/test-send` (and super-admin equivalent) — renders subject+body via the same Handlebars helpers the worker uses, with a canned sample-variable set per event, sends to the logged-in admin's email through the existing queue, `templateName: "test-send"`
- [ ] Rate-limited (e.g. 5/min/tenant); requires `canEditEmails` (after US-009)
- [ ] "Send test" button in `EmailEditor` header; success/failure toast
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-007: Tenant email-log page
**Description:** As a tenant admin, I want to see what was sent, to whom, and why it failed ("did my customer get their confirmation?").

**Acceptance Criteria:**
- [ ] `GET /api/tenant-admin/email-logs` — `withTenantAuth`, paginated, filter by `status` and date range, search by recipient
- [ ] Page under `app/tenant-admin/emails/` (new "Activity" tab beside Templates/Events): table of recipient/subject/template/status/timestamp, detail drawer showing `smtpResponse`/`errorMessage`
- [ ] Requires `canViewEmails`
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-008: Deterministic log linkage
**Description:** As the platform, I need SENT/FAILED to update the right log row — the (recipient, subject) heuristic (`scripts/email-worker.ts:219-227`) mis-attributes under concurrency and breaks at campaign volume.

**Acceptance Criteria:**
- [ ] `MailerService.send` creates the `email_logs` row **first**, passes `logId` in the BullMQ payload
- [ ] Worker updates by `logId`; falls back to legacy heuristic only when `logId` absent (in-flight jobs during deploy)
- [ ] `markLogFailed` and SENT paths both migrated; unit tests cover both
- [ ] Typecheck passes

### US-009: Permission enforcement on email routes
**Description:** As a store owner, I want team-member email access governed by the existing permission keys, not just role.

**Acceptance Criteria:**
- [ ] `canViewEmails` on GET routes; `canEditEmails` on POST/PUT/DELETE across `app/api/tenant-admin/email-templates*`, `email-mappings`, and new email endpoints (pattern per PRD-301 team routes)
- [ ] Owner-admin unaffected; member without permission gets 403 with standard error shape
- [ ] Integration test: member with `canViewEmails` only cannot PUT
- [ ] Typecheck passes

---

### Workstream B — Non-technical editor

### US-010: Branded email shell renderer
**Description:** As a tenant admin, I want my logo, colors, and footer applied automatically so I only ever edit the message body.

**Acceptance Criteria:**
- [ ] `EmailShell` react-email component: header (tenant logo via durable URL, `primaryColor` accents), content slot, footer (business name, physical address, `{{unsubscribeUrl}}` slot rendered only for marketing category)
- [ ] Server util `renderEmailBody(bodyHtml, tenant, opts)` → shell-wrapped full document; tenant branding read from existing tenant settings (add `businessAddress` field to settings if absent)
- [ ] Deterministic snapshot test of rendered output for a fixture tenant
- [ ] Typecheck passes

### US-011: Save-path render pipeline (JSON → email-safe HTML)
**Description:** As the platform, I need editor output converted to inbox-safe HTML while the worker contract stays untouched.

**Acceptance Criteria:**
- [ ] Add `juice`; pipeline on template save: TipTap JSON → HTML → `EmailShell` wrap → juice inline CSS → `sanitizeEmailHtml` → `contentHtml`; JSON stored in existing `email_templates.contentJson`
- [ ] Literal `{{variable}}` text survives the whole pipeline verbatim (unit test), so worker `Handlebars.compile` keeps working with zero changes
- [ ] Pipeline output for a fixture doc stays under `EMAIL_HTML_MAX_LENGTH` (200k) with 3 images (URLs, never base64 — reject pasted `data:` images > 10KB with a clear error)
- [ ] Order is render → inline → sanitize (sanitizer is the last writer); test asserts no `<script>`/event-handler survives a hostile fixture
- [ ] Typecheck passes

### US-012: EmailComposer component (TipTap simple mode)
**Description:** As a non-technical admin, I want to write an email like a document — headings, lists, buttons, dividers, images.

**Acceptance Criteria:**
- [ ] New `EmailComposer` built on the in-repo TipTap 3 setup (`components/editor/tiptap.tsx` as reference, not modified): StarterKit + image + link + text-align; toolbar adds "Button" (styled `<a>`, editable label/URL) and divider
- [ ] `EmailEditor.tsx` gains Simple/Advanced tabs: Simple = composer (default when `contentJson` exists or template is new); Advanced = existing HTML textarea. Editing in Advanced clears `contentJson` after an explicit confirm dialog
- [ ] Legacy templates (contentHtml only) open in Advanced with a banner explaining Simple mode is available for new templates
- [ ] Both super-admin and tenant-admin new/edit pages get the same component (shared, per Phase-1 design note)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-013: Merge-tag chips
**Description:** As a non-technical admin, I want to insert "Customer name" from a menu instead of typing `{{userName}}`.

**Acceptance Criteria:**
- [ ] TipTap mention-style node triggered by `{{` or toolbar "Personalize" menu; renders as a labeled chip in-editor; serializes to literal `{{variable}}` text in output (round-trips through US-011 pipeline — test)
- [ ] Tag list driven by the event's variable set (source the existing `COMMON_VARIABLES` data, moved to a shared module keyed by event type); free-text custom tag allowed for advanced users
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-014: In-editor image upload
**Description:** As a non-technical admin, I want to drag or pick an image and have it just work in the sent email.

**Acceptance Criteria:**
- [ ] Composer image button opens file picker (and accepts drag-drop); uploads via `POST /api/tenant-admin/upload`; inserts the **durable public URL** (US-005)
- [ ] Client-side max size (e.g. 2MB) with clear error; server validation already exists (magic-byte)
- [ ] Width constrained to shell content width by default
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-015: Preview modes + test-send integration
**Description:** As an admin, I want to see the email as recipients will, on mobile and desktop, before activating it.

**Acceptance Criteria:**
- [ ] Preview pane renders the **full pipeline output** (shell-wrapped, inlined, sanitized — not raw editor HTML) in the existing sandboxed iframe; toggle 375px / 800px widths
- [ ] Sample variables substituted in preview (same canned set as US-006)
- [ ] "Send test" (US-006) accessible from the composer
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### Workstream C — Newsletters & campaigns

### US-016: Campaign data model
**Description:** As the platform, I need campaign state with per-recipient delivery tracking.

**Acceptance Criteria:**
- [ ] Prisma models: `campaigns` (`id`, `tenantId`, `name`, `subject`, `contentHtml`, `contentJson`, `status` enum `DRAFT|SCHEDULED|SENDING|SENT|CANCELLED`, `audience` Json, `scheduledAt`, `sentAt`, `stats` Json, timestamps) and `campaign_recipients` (`id`, `campaignId`, `email`, `userId?`, `status` enum `PENDING|QUEUED|SENT|FAILED|SUPPRESSED`, `emailLogId?`, `error?`; `@@unique([campaignId, email])`, index `[campaignId, status]`)
- [ ] `users.marketingConsentAt DateTime?` added
- [ ] Migration runs; typecheck passes

### US-017: Campaign CRUD + compose UI
**Description:** As a tenant admin, I want to create a campaign using the same composer I use for templates.

**Acceptance Criteria:**
- [ ] `app/api/tenant-admin/campaigns` (+`[id]`) — `withTenantAuth` + `canEditEmails`; CRUD limited to `DRAFT|SCHEDULED`; content goes through the US-011 pipeline with `category: "marketing"` (unsubscribe footer slot mandatory — save rejects content without it, shell provides it by default)
- [ ] "Campaigns" tab under `app/tenant-admin/emails/`: list (status, audience size, sent count) + compose page (subject, EmailComposer, audience picker placeholder, save draft)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-018: Audience selection v1
**Description:** As a tenant admin, I want to choose who receives the campaign and see the count before sending.

**Acceptance Criteria:**
- [ ] Audience options: (a) confirmed newsletter subscribers; (b) customers with `marketingConsentAt` set; (c) both (deduped by email). Stored as structured `audience` Json
- [ ] `GET /api/tenant-admin/campaigns/[id]/audience-count` returns live count **after** suppression and status filtering
- [ ] Recipients materialized into `campaign_recipients` at send time (not draft time)
- [ ] Unit test: dedupe + suppression exclusion
- [ ] Typecheck passes

### US-019: Fan-out send with rate cap
**Description:** As the platform, I must send one message per recipient, rate-limited per tenant, with progress and cancel — never a single message exposing all addresses in To:.

**Acceptance Criteria:**
- [ ] `POST /api/tenant-admin/campaigns/[id]/send` → status `SENDING`, materializes recipients, enqueues **one BullMQ job per recipient** carrying `campaignId`, `recipientId`, `logId`, `category: "marketing"`; per-tenant rate cap via delayed-job spacing (default from env `CAMPAIGN_RATE_PER_MINUTE`, default 60)
- [ ] Worker: per-recipient variable set (name, unsubscribe URL from recipient token); suppression checked at send time (US-004); updates `campaign_recipients.status` + `emailLogId`
- [ ] Campaign flips to `SENT` when no PENDING/QUEUED recipients remain; UI shows progress (sent/failed/suppressed counts)
- [ ] Cancel: `POST .../cancel` sets `CANCELLED`; worker drops jobs whose campaign is cancelled (status check before send)
- [ ] Integration test with fake transport: 3 recipients → 3 discrete messages, distinct To: headers
- [ ] Typecheck passes

### US-020: Compliance headers + enforced footer
**Description:** As a store owner, I need marketing email to meet Gmail/Yahoo bulk-sender and POPIA/GDPR requirements by default.

**Acceptance Criteria:**
- [ ] Marketing sends set `List-Unsubscribe: <mailto:...>, <https://.../unsubscribe?token=...>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (nodemailer `headers` option); one-click POST works headlessly (US-004)
- [ ] Footer (business name, physical address, unsubscribe link) present in every marketing send — worker refuses (`FAILED`, reason `missing-footer`) if `{{unsubscribeUrl}}` was not rendered
- [ ] Transactional category completely unaffected (test)
- [ ] Typecheck passes

### US-021: Scheduling
**Description:** As a tenant admin, I want to schedule a campaign for later.

**Acceptance Criteria:**
- [ ] Compose page date-time picker → status `SCHEDULED` + `scheduledAt`; a delayed BullMQ job triggers the US-019 send path at time
- [ ] Rescheduling replaces the delayed job; cancel works while SCHEDULED
- [ ] Send-time guard re-checks status (a cancelled campaign never sends)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-022: Send blog post as newsletter
**Description:** As a tenant admin, I want one click to turn a Wire post into a campaign draft.

**Acceptance Criteria:**
- [ ] "Send as newsletter" on the Wire post list/edit (published posts only) → creates DRAFT campaign prefilled: subject = post title, body = post content converted to composer doc + cover image (durable URL) + excerpt intro + "Read more" button to the post URL
- [ ] Content passes the US-011 pipeline; opens in campaign compose for review — never auto-sends
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-023: Marketing consent capture
**Description:** As a storefront customer, I choose whether to receive marketing at signup/checkout, and the store records when I consented.

**Acceptance Criteria:**
- [ ] Unticked-by-default checkbox ("Email me offers and updates") on storefront signup and checkout; sets `users.marketingConsentAt` (null = no consent)
- [ ] Customer detail page (admin) shows consent state; manual toggle writes/clears timestamp with audit-log entry (existing audit util)
- [ ] Unsubscribe (US-004) also clears `marketingConsentAt` for a matching customer email
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### Workstream D — CRM-lite

### US-024: Customer tags
**Description:** As a tenant admin, I want to tag customers so I can target them.

**Acceptance Criteria:**
- [ ] `customer_tags` model (`tenantId`, `userId`, `tag`; `@@unique([tenantId, userId, tag])`); add/remove on customer detail; tag filter chip on customers list + API filter param
- [ ] Requires `canEditCustomers`
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-025: Segments as saved audiences
**Description:** As a tenant admin, I want reusable audience filters — "hasn't ordered in 60 days" is the reorder play.

**Acceptance Criteria:**
- [ ] `segments` model (`tenantId`, `name`, `filter` Json); filter grammar v1: last-order age (days), order count ≥/=0, has tag, KYC-approved, marketing consent (always ANDed with consent + suppression)
- [ ] Segment builder UI with live count preview; campaigns audience picker (US-018) accepts a segment
- [ ] Query implemented against existing customers/orders relations; unit tests for each filter axis
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-026: Campaign results page
**Description:** As a tenant admin, I want to see how a campaign did.

**Acceptance Criteria:**
- [ ] Campaign detail: delivered/failed/suppressed counts, failure reasons (from linked `email_logs`), unsubscribes attributed to the campaign (token → recipient row)
- [ ] Export recipients CSV requires `canExportCustomers`
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-027: Open/click tracking (per-tenant opt-in)
**Description:** As a tenant admin, I may want open/click stats — but tracking is off by default and disclosed.

**Acceptance Criteria:**
- [ ] Tenant setting `emailTrackingEnabled` (default false). When on: 1px pixel route + link-wrapping redirect route (signed recipient token, no PII in URL), recorded per `campaign_recipients`
- [ ] Counts surface on US-026 page; privacy-policy template gains a tracking disclosure clause when enabled
- [ ] When off: sent HTML contains no tracking artifacts (test)
- [ ] Typecheck passes

### US-028: Reorder-reminder automation (MVP)
**Description:** As a store owner, I want an automatic "time to reorder?" email — the core BudStacks retention play.

**Acceptance Criteria:**
- [ ] Tenant-configurable rule: N days (default 60) after a customer's last DELIVERED order, send mapped template `reorderReminder` — only if consented + not suppressed + no newer order; once per customer per window
- [ ] Daily scheduled trigger (BullMQ repeatable job — verify single-instance safety since worker count may scale)
- [ ] `reorderReminder` event added to mapper allowlists with seeded default template; per-tenant on/off toggle (default off)
- [ ] Unit tests: window logic, consent/suppression gates, idempotency
- [ ] Typecheck passes

## 4. Functional Requirements

- FR-1: Storefront newsletter signups must persist to `newsletter_subscribers` with tenant scoping and double opt-in (US-001..003).
- FR-2: Marketing email must never send to a suppressed or unconsented address; suppression is checked at send time, not enqueue time (US-004, US-019).
- FR-3: All admin-uploaded images must be servable via non-expiring URLs (US-005).
- FR-4: Template save must produce inbox-safe HTML: shell-wrapped, CSS-inlined, sanitizer-last; literal `{{tags}}` preserved for the worker's Handlebars compile (US-010..011).
- FR-5: The editor must offer Simple (visual) and Advanced (raw HTML) modes; Simple requires no HTML knowledge for text, headings, lists, buttons, dividers, images, merge tags (US-012..014).
- FR-6: Campaigns must fan out one queue job per recipient with a per-tenant rate cap and per-recipient status (US-019).
- FR-7: Marketing sends must carry `List-Unsubscribe` + `List-Unsubscribe-Post` headers and an address+unsubscribe footer (US-020).
- FR-8: Every new email endpoint enforces `canViewEmails`/`canEditEmails`; audience/export features enforce customer permissions (US-009, US-024..026).
- FR-9: The transactional path (existing 10 call sites → queue → worker) must be behaviorally unchanged except log linkage by id (US-008).
- FR-10: Blog posts must be convertible to campaign drafts without re-authoring (US-022).

## 5. Non-Goals (Out of Scope)

- **No platform-managed sending** — BYO SMTP stays (cannabis-restricted ESP policies make shared sending a liability). The unused `resend` dependency stays unused or gets removed as a chore.
- **No drag-drop block builder** (product grids, multi-column layouts) — revisit `@usewaypoint/email-builder` after Workstream B ships and tenant feedback exists.
- **No list import** (CSV/purchased lists) in v1 — platform-captured, consented contacts only. Deliberate compliance stance.
- **No A/B testing, no multi-step drip sequences** beyond the single reorder-reminder rule, no SMS/push.
- **No re-architecture of the two-path template system** — call sites keep passing rendered fallback HTML; convergence is a separate refactor.
- **No backfill of existing presigned image URLs** in historical posts/templates.

## 6. Design Considerations

- Reuse existing UI kit (`bs-card`, `bs-btn`, `bs-table`, tabs pattern from `app/tenant-admin/emails/page.tsx`); composer toolbar mirrors The Wire's TipTap toolbar for familiarity.
- Shared components stay tenant/super-admin agnostic (Phase-1 rule): composer takes data + save callback, no fetch inside.
- Empty states matter: Campaigns tab explains double opt-in and links to the subscribers list; audience picker with zero consented contacts explains why (consent capture, US-023).

## 7. Technical Considerations

- **Repo traps (hard-won):** PRs merge and deploy in seconds — every story must leave `main` shippable; TS errors fail the deploy. No local execution — verify via typecheck, unit/integration tests, and CI (Vitest + Playwright); browser-verify ACs run against a dev instance where available, else the story adds a Playwright spec. Workflow-file changes push via SSH.
- **Worker + tenant scoping:** worker DB access must remain `bypassTenantScope`-safe (TENANT_CONTEXT_STRICT landmine, PR #209).
- **Sanitizer contract:** editor/pipeline output must stay inside the `email-sanitize.ts` allowlist (buttons are styled `<a>`, no `<button>`); sanitize is always last; 200k cap → hosted image URLs, never base64.
- **Handlebars safety:** subscriber/customer-controlled strings are only ever variable *values* (escaped by `{{ }}`), never template source.
- **Rate caps protect tenant SMTP reputation** (Gmail app-password ≈ 500/day); SMTP settings page should surface "use a real ESP for newsletters" guidance (copy change, part of US-017's tab).
- **Queue versioning:** US-008/US-019 change job payloads — worker must tolerate old payload shapes during deploy overlap.
- Dependency added: `juice` (US-011). Everything else uses in-repo deps (TipTap 3, react-email, handlebars, bullmq, sharp).

## 8. Success Metrics

- A non-technical tester creates, previews, test-sends, and activates a branded template touching zero HTML.
- Storefront signup → confirmed subscriber conversion visible in data (was: 100% silent loss).
- 0 broken images in emails/posts created after US-005.
- Campaign to 1,000 recipients: 1,000 discrete messages, ≥98% SENT on healthy SMTP, no cross-recipient address leakage, progress visible throughout.
- Unsubscribe honored on the very next send (suppression check at send time).
- Existing transactional email: zero behavior change (log linkage aside).

## 9. Open Questions

1. Double opt-in is the default — do any markets want single opt-in as a per-tenant toggle (POPIA doesn't mandate double; it's a deliverability/proof choice)?
2. Default `CAMPAIGN_RATE_PER_MINUTE` (60?) and should it be per-tenant configurable in UI at launch or env-only?
3. Should campaign audiences additionally require KYC-approved status for cannabis-marketing caution, or is consent sufficient? (Review recommends "consented; optionally KYC-verified".)
4. Remove the unused `resend` dependency, or keep for a future platform-sending experiment?
5. Physical-address footer source: one `businessAddress` settings field, or reuse an existing legal-entity field if one exists in tenant settings?
