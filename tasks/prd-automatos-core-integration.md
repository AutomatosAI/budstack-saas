# PRD: Automatos Core Integration (chatbot toggle · one-click provisioning · assisted Wire)

## Introduction

BudStacks embeds the Automatos AI chat widget on tenant storefronts today, but the integration is "presence of an API key" — no on/off switch, no plan gating, and merchants copy-paste keys by hand. This PRD turns Automatos into a properly productized **pro-tier extra**: tenants on the pro plan can enable the storefront chatbot with a toggle, get their workspace/agent/key provisioned automatically instead of pasting keys, and opt The Wire into **assisted mode**, where Automatos agents write draft posts into the tenant's own blog for the merchant to review and publish.

Three phases, each independently shippable. Phase 1 has no external dependencies; Phase 2 depends on one new orchestrator endpoint (spec below — we own both sides); Phase 3 depends on Phase 1's feature keys only.

**Established context this PRD builds on (verified in code):**
- Canonical chatbot config = `tenants.automatosApiKey` / `tenants.automatosAgentId` **columns** (`prisma/schema.prisma:795-796`), written by `app/api/tenant-admin/settings/route.ts:77-79`, read by the storefront at `app/store/[slug]/layout.tsx:362-371`. The `automatosApiKey`/`automatosHelperAgentId` keys in `lib/validation/tenant-settings.ts:137-139` (settings JSON) are a dead parallel store — nothing writes them.
- Entitlement seam = `lib/entitlements/features.ts` (trial mode: every feature granted; plan matrix swaps in later without call-site changes). Consumers pass granted keys and check `hasFeature()`.
- The Wire = tenant-authored posts in the `posts` table (Tiptap editor, `app/tenant-admin/the-wire/*`), server-rendered on storefronts (crawlable). The Automatos SDK's blog *widget* renders Automatos-hosted posts in Shadow DOM (NOT crawlable) — deliberately not used here; assisted mode writes into our posts table instead.
- The Automatos widget-SDK public key model: `ak_pub_*` keys are browser-safe, workspace-bound, **origin-allowlisted**. Server keys are `ak_srv_*`. Keys are minted platform-side (`POST /api/api-keys` with `key_type: "public"`, `permissions`, `allowed_domains`).
- Schema changes in this repo are applied as **manual SQL** (loose files in `prisma/migrations/`, no Railway pre-deploy command). Every schema story below includes its exact SQL and ordering.

## Goals

- A pro-gated enable/disable toggle for the storefront chatbot, enforced **server-side** at the point of widget injection.
- Zero regression for tenants with a working chatbot today (backfill grandfathers them on).
- One-click provisioning: enabling the chatbot mints workspace + agent + public key automatically; manual key fields remain as an override.
- Assisted Wire: Automatos pushes **drafts only** into the tenant's posts table; merchant reviews and publishes. No AI content goes live unseen.
- All gating flows through `lib/entitlements/features.ts` so the coming `tenants.plan` column activates the paywall without touching these call sites.

## User Stories

---

### Phase 1 — Chatbot toggle + entitlement (no external dependencies)

### US-001: Add Automatos feature keys to the entitlement seam
**Description:** As the platform operator, I want `automatos.chatbot` and `automatos.wire` feature keys so the pro-plan matrix can grant or withhold these extras.

**Acceptance Criteria:**
- [ ] `FEATURES.AUTOMATOS_CHATBOT = "automatos.chatbot"` and `FEATURES.AUTOMATOS_WIRE = "automatos.wire"` added to `lib/entitlements/features.ts`
- [ ] `getTenantFeatures()` still returns all features (trial mode) — no behavior change
- [ ] Coordination note: the `ralph/seo-supercharge` branch also edits this file (US-011 there); keys are additive, land in any order, rebase trivially
- [ ] Typecheck/lint passes

### US-002: `automatosChatbotEnabled` column with grandfathering backfill
**Description:** As a developer, I need a persistent on/off flag that is independent of whether a key is configured, defaulting existing chatbot tenants to ON.

**Acceptance Criteria:**
- [ ] Prisma schema: `automatosChatbotEnabled Boolean @default(false)` on `tenants`
- [ ] Migration SQL added as `prisma/migrations/add_automatos_chatbot_enabled.sql`:
  ```sql
  ALTER TABLE "tenants" ADD COLUMN "automatosChatbotEnabled" BOOLEAN NOT NULL DEFAULT false;
  UPDATE "tenants" SET "automatosChatbotEnabled" = true WHERE "automatosApiKey" IS NOT NULL;
  ```
- [ ] **Operator step (Gerard): apply the SQL to Postgres-BudStack BEFORE merging the code PR** (column-add is backward compatible with the running build; the old build ignores it)
- [ ] `prisma generate` output compiles; typecheck passes

### US-003: Server-side widget gate on the storefront
**Description:** As the platform operator, I want the widget injected only when the tenant has a key AND the toggle is on AND the entitlement is granted, so the pro gate cannot be bypassed client-side.

**Acceptance Criteria:**
- [ ] `app/store/[slug]/layout.tsx` (currently `:362` — bare key-truthiness) renders `AutomatosWidgetWrapper` only when `automatosApiKey && automatosChatbotEnabled && hasFeature(getTenantFeatures({id: tenant.id}), FEATURES.AUTOMATOS_CHATBOT)`
- [ ] Layout is a server component — the script tag simply never reaches the browser for disabled/unentitled tenants
- [ ] A tenant with the toggle off sees no FAB, no script request (verify via view-source / network tab)
- [ ] Grandfathered tenant (key set, backfilled true) sees the chatbot exactly as before
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: Settings-tab toggle UI with pro-teaser lock state
**Description:** As a tenant admin, I want an Enable Storefront Chatbot switch in the Automatos AI Integration section; if my plan doesn't include it, I see the locked state with an upgrade prompt instead of a dead control.

**Acceptance Criteria:**
- [ ] Toggle added at the top of the Automatos section in `app/tenant-admin/settings/settings-form.tsx` (section `:314-363`), styled like the existing Switch usage (`app/tenant-admin/the-wire/post-form.tsx`)
- [ ] `app/tenant-admin/settings/page.tsx` resolves `Array.from(getTenantFeatures({id: tenant.id}))` server-side and passes a `features` prop into `SettingsForm` (settings has no GET API — server prop is the pattern here)
- [ ] Not entitled → switch renders disabled with a lock badge and short upgrade copy (teaser pattern; do NOT hide the section)
- [ ] Entitled + no key → helper text "Save an API key or use automatic provisioning (coming in Phase 2)"
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Settings PATCH accepts the toggle with server-side entitlement re-check
**Description:** As the platform operator, I want the API to reject enabling the chatbot for unentitled tenants, because the client toggle is not enforcement.

**Acceptance Criteria:**
- [ ] `app/api/tenant-admin/settings/route.ts` accepts boolean `automatosChatbotEnabled` in the body and includes it in `dataToUpdate`
- [ ] Enabling (`false→true`) when `!hasFeature(..., FEATURES.AUTOMATOS_CHATBOT)` → 403 with a clear message; disabling is always allowed
- [ ] Values other than boolean are rejected (Zod or explicit check), never coerced
- [ ] Unit test covering: entitled enable OK, unentitled enable 403, disable always OK
- [ ] Typecheck/lint passes

### US-006 (cleanup, optional but recommended): Retire the dead Automatos settings-JSON paths
**Description:** As a developer, I want one canonical config store so the next person doesn't wire a feature to the dead one.

**Acceptance Criteria:**
- [ ] `automatosApiKey`/`automatosAgentId`/`automatosHelperAgentId` removed from `lib/validation/tenant-settings.ts` (settings JSON) — columns are canonical
- [ ] Dead branding-form co-pilot read (`app/tenant-admin/branding/branding-form.tsx:109-110, :579-586`) either removed or repointed at the columns — decide at implementation; removal preferred until helper-agent work is real
- [ ] `components/admin/StoreEditorHelperBot.tsx` no-op documented or removed (`@automatos/widget-sdk` is not in package.json — the dynamic import silently fails)
- [ ] Typecheck/lint passes; grep proves no remaining readers of the JSON keys

---

### Phase 2 — One-click provisioning (depends on new orchestrator endpoint)

### US-007: Orchestrator contract — generic partner-provision endpoint (Automatos-side ticket)
**Description:** As BudStacks, I need a platform-agnostic provision API because the only one today is Shopify-specific (`/api/shopify/provision`).

**Contract to build on the orchestrator (this story is the spec; implementation is an Automatos-side ticket):**
```
POST /api/partners/provision
Authorization: Bearer <AUTOMATOS_PARTNER_API_KEY>   # server-to-server, per-partner secret
{
  "partner": "budstacks",
  "external_id": "<budstacks tenantId>",            # idempotency key
  "name": "<tenant businessName>",
  "domains": ["<sub>.budstacks.io", "<customDomain>", "www.<customDomain>"]
}
→ 200 { "workspace_public_id": "...", "api_key": "ak_pub_...", "agent_id": "..." }

PATCH /api/partners/provision/<external_id>/domains   # re-sync allowlist on domain changes
{ "domains": [...] }
```
**Acceptance Criteria:**
- [ ] Idempotent on `(partner, external_id)` — re-provision returns the existing workspace and does NOT rotate the key (the Shopify repo's silent key rotation on re-provision is a known footgun; do not replicate)
- [ ] Minted key is `key_type: "public"`, `permissions: ["chat"]` (widen to `["chat","blog"]` only when Phase 3 ships), `allowed_domains` from the request
- [ ] **No unauthenticated dev fallback** — the Shopify app accepts unauthenticated server-to-server calls when the env is unset; this endpoint must reject instead
- [ ] Contract documented in the orchestrator repo; budstacks side (US-008) is blocked until this lands

### US-008: "Provision automatically" in the settings Automatos section
**Description:** As a tenant admin on pro, I want one click to set up my chatbot without understanding API keys.

**Acceptance Criteria:**
- [ ] Button renders when entitled and no `automatosApiKey` is set; calls a new server route `POST /api/tenant-admin/automatos/provision` (wrapped `requirePermission("canEditSettings")` + `hasFeature(AUTOMATOS_CHATBOT)`)
- [ ] Route calls the US-007 endpoint with `domains` built from `tenants.subdomain` + `customDomain` (+ `www.` variant), stores `automatosApiKey`/`automatosAgentId`, sets `automatosChatbotEnabled = true`
- [ ] `AUTOMATOS_PARTNER_API_KEY` read from env; route returns 503 with a clear message if unset (never calls unauthenticated)
- [ ] Failure surfaces to the UI verbatim-safe (no internals leaked) and leaves all fields unchanged
- [ ] Manual key fields still work and win if the admin overwrites them (override path preserved)
- [ ] Unit test: provision happy path (mocked orchestrator), env-missing 503, unentitled 403
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-009: Domain-change re-sync
**Description:** As a tenant admin, when my custom domain changes, my chatbot must keep working on the new domain (the public key is origin-allowlisted).

**Acceptance Criteria:**
- [ ] Settings PATCH: when `customDomain` changes and the tenant has an Automatos key, fire-and-forget the US-007 domains PATCH (log failure, never block the settings save)
- [ ] Cloudflare/custom-domain flows that set `customDomain` outside this route are enumerated at implementation time and either covered or explicitly listed as manual re-provision cases
- [ ] Typecheck/lint passes

---

### Phase 3 — Assisted Wire drafts (drafts only; no auto-publish)

### US-010: `wireMode` column
**Description:** As a tenant admin, I want an explicit mode for The Wire so assisted drafting is an opt-in, not a side effect of having a key.

**Acceptance Criteria:**
- [ ] Prisma: `wireMode String @default("MANUAL")` on `tenants` (values `MANUAL` | `ASSISTED`; string not enum to avoid a Postgres enum migration)
- [ ] Migration SQL `prisma/migrations/add_wire_mode.sql`: `ALTER TABLE "tenants" ADD COLUMN "wireMode" TEXT NOT NULL DEFAULT 'MANUAL';`
- [ ] **Operator step: apply before merging the code PR**
- [ ] Typecheck passes

### US-011: Inbound drafts endpoint for Automatos agents
**Description:** As an Automatos agent running a content mission, I need an authenticated way to deliver a draft post into the tenant's Wire.

**Acceptance Criteria:**
- [ ] `POST /api/integrations/automatos/posts` — authenticated by per-tenant HMAC: signature over the raw body with a per-tenant secret minted at provision time (stored encrypted with the existing `encrypt()` used for SMTP passwords), tenant resolved from an explicit `external_id` header, constant-time compare
- [ ] Request: `{ title, content (sanitized server-side with the same sanitize-html config as storefront render), excerpt?, seo_title?, seo_description? }`
- [ ] Creates a post with `published: false` ALWAYS (server ignores any published flag in the payload), `seo` JSON carrying `{title: seo_title, description: seo_description}`, slug via the existing slugify + uniqueness loop in `app/api/tenant-admin/posts/route.ts:10-18,:61-69`, `source: "AUTOMATOS"`
- [ ] Rejected with 403 unless `wireMode === "ASSISTED"` AND `hasFeature(AUTOMATOS_WIRE)`
- [ ] Rate-limited (reuse `checkRateLimit` keyed per tenant)
- [ ] Unit tests: valid draft lands unpublished; published:true in payload still lands unpublished; bad HMAC 401; MANUAL-mode tenant 403
- [ ] Typecheck/lint passes

### US-012: `source` column + "Draft by Automatos" badge in The Wire
**Description:** As a tenant admin, I want to see at a glance which drafts came from the agent so review is easy.

**Acceptance Criteria:**
- [ ] Prisma: `source String @default("MANUAL")` on `posts`; SQL bundled into `add_wire_mode.sql` (`ALTER TABLE "posts" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';`)
- [ ] `app/tenant-admin/the-wire/posts-list.tsx` shows an "Automatos" pill on `source === "AUTOMATOS"` rows; publish/edit/delete work identically
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-013: Wire mode selector UI
**Description:** As a tenant admin on pro, I want to switch The Wire between manual and assisted, with the teaser lock when I'm not entitled.

**Acceptance Criteria:**
- [ ] Mode control on `app/tenant-admin/the-wire/page.tsx` (or settings — implementer's call, one place only) writing `wireMode` through a permission-checked route with the same server-side entitlement re-check pattern as US-005
- [ ] Unentitled → locked/teaser state, not hidden
- [ ] Switching to ASSISTED with no Automatos provisioning yet → helper text pointing at the chatbot/provision setup
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Widget injection on storefronts requires key + toggle + entitlement, evaluated server-side (US-003).
- FR-2: Existing keyed tenants are backfilled to enabled — zero visible change at deploy (US-002).
- FR-3: Enabling the toggle or ASSISTED mode without the entitlement returns 403 from the API regardless of UI state (US-005, US-013).
- FR-4: Locked features render as visible teasers with upgrade copy, never hidden (US-004, US-013).
- FR-5: Provisioning is idempotent, never rotates an existing key, and registers all tenant hostnames in the key's origin allowlist (US-007/008/009).
- FR-6: Assisted drafts can never publish themselves; `published: false` is server-enforced (US-011).
- FR-7: All inbound Automatos content is sanitized with the storefront's existing sanitize-html config before storage (US-011).
- FR-8: No code path reads Automatos config from tenant-writable `settings` JSON (US-006).

## Non-Goals (Out of Scope)

- **SEO management** — owned entirely by the `ralph/seo-supercharge` PRD (only touchpoint: additive keys in `lib/entitlements/features.ts`).
- **Auto-publish / MANAGED Wire mode** — future phase, needs a compliance pass for unreviewed AI content on cannabis storefronts.
- **The SDK blog widget on storefronts** — Shadow-DOM rendering is invisible to crawlers; The Wire's server rendering is strictly better and stays.
- **Billing/plan column** — the entitlement seam ships trial-mode; `tenants.plan` is the separate tiering workstream.
- **Chat proxying** — the widget keeps talking directly to `api.automatos.app` with the public key; no budstack server proxy.
- **Reviving the store-editor helper bot** — dead code today; noted in US-006, not rebuilt here.

## Technical Considerations

- **Split-brain warning:** columns are canonical for Automatos config. Do not add settings-JSON fallbacks; US-006 deletes the dead ones.
- **Migrations are manual** in this repo (loose SQL in `prisma/migrations/`, no pipeline). Every schema story ships its SQL file + the apply-before-merge operator step. All columns here are additive/backward-compatible.
- **Vendored widget bundle** (`public/automatos-widget.js?v=5`) is a stale snapshot of the SDK; the live channel is `https://widgets.automatos.app/v0/widget.global.js`. Recommended follow-up chore (not blocking): switch the wrapper to the CDN and extend storefront CSP (`script-src widgets.automatos.app`, `connect-src api.automatos.app`) — check `tests/unit/csp.test.ts` expectations when doing so.
- **Fail-soft:** the widget loads `afterInteractive`; storefront render has zero dependency on Automatos uptime (precedent: the dead-model outage on the Shopify side broke chat replies, not host pages — preserve that property).
- **Trial mode means everything ships live-but-ungated** until the plan column lands; the 403 paths in US-005/US-013 are latent until then. Test them with a stubbed feature set, not by waiting for the paywall.
- **Draft cover images:** Automatos-hosted image URLs may be short-lived (see the S3 1-hour-URL email incident). v1 drafts ship without `coverImage` unless the payload provides a stable public URL; downloading covers into budstack storage is an open question below.
- **Prisma any-widening trap:** the `prisma` export is any-widened — annotate every callback param explicitly or CI typecheck fails (TS7006), which is also why `$queryRaw` results need explicitly typed consts.

## Success Metrics

- A pro tenant can turn the chatbot on/off without touching key fields; the widget script provably absent when off.
- Provisioning completes in under a minute with no manual steps and works on subdomain + custom domain + www.
- An ASSISTED tenant receives agent drafts in The Wire and publishes with one click; zero unreviewed AI content ever renders on a storefront.
- Zero storefront regressions for grandfathered tenants at each phase's deploy.

## Open Questions

1. **Wire draft images** — should budstack download agent-provided cover images into its own S3 at ingest (stable URLs, more moving parts) or require stable public URLs from the orchestrator?
2. **Per-tenant HMAC secret distribution** — minted by budstack at provision time and pushed to the orchestrator in the US-007 call, or minted by the orchestrator and returned? (Decide when US-007 is ticketed; budstack-minted is simpler to rotate.)
3. **Helper/co-pilot agent** — the settings screenshot's Agent ID drives the storefront bot; the dead store-editor co-pilot used a second helper agent. Is a revived co-pilot part of a future Automatos extra, or dropped?
4. **CDN switch timing** — fold the vendored-bundle → CDN chore into Phase 2 (provisioning already touches the wrapper) or keep it separate?
