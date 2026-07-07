# PRD: Cloudflare for SaaS — Tenant Custom Domains

> **Status:** Draft / proposed — 2026-06-01.
> **Supersedes the custom-domain provisioning approach in** [`prd-custom-domains.md`](./prd-custom-domains.md) (Railway-direct). That PRD's middleware routing, `_cd` rewrite, and tenant-resolution model are **retained**; only the provisioning + DNS + SSL layer changes.

## Introduction / Overview

Tenants connect their own domains to their storefronts. Today every custom domain is provisioned **directly in Railway** (`lib/railway-api.ts` → `customDomainCreate`), which returns a per-domain **CNAME** target and a TXT validation record, and Railway auto-issues SSL.

This breaks for **apex (root) domains** — e.g. `healingbuds.co.za` — registered at limited registrars such as **one.com**:

- A CNAME at the apex (`@`) is forbidden by DNS (RFC 1034 — it can't coexist with the mandatory SOA/NS records).
- one.com (and many ccTLD registrars) offer **no ALIAS/ANAME** to work around it.
- **Railway provides no stable apex A-record** — only a CNAME target — so there is nothing valid to put at the apex.

Result: `healingbuds.co.za` sits in Railway as **"Waiting for DNS update"** indefinitely. This is structural, not a misconfiguration, and **every future tenant with an apex domain on a limited registrar hits the same wall.** We fix it before scaling.

**Solution:** front tenant custom domains with **Cloudflare for SaaS (Custom Hostnames)**. Cloudflare provides apex-compatible **A-records (anycast IPs)** the tenant *can* set at one.com, issues + auto-renews per-hostname SSL, and proxies traffic to our existing **Railway** origin (compute is unchanged).

## Background & Research Findings (load-bearing)

These findings shaped the design. Sources are official docs unless noted.

1. **Apex is solvable via Cloudflare apex-proxying.** The tenant adds **A/AAAA records at the apex pointing to anycast IPs allocated to our Cloudflare-for-SaaS account** (not the tenant's own CF account). one.com supports A-records at the apex. ⚠️ **Apex-proxying is plan/account-team-gated and Cloudflare recommends Static IPs / BYOIP** because standard anycast IPs can change — eligibility must be confirmed with Cloudflare **first** (see Open Questions / US-001). [cloudflare-for-platforms/cloudflare-for-saas/start/advanced-settings/apex-proxying]

2. **Railway routes by HTTP `Host` header, NOT SNI — and overwrites `Host` and `X-Forwarded-Host`.** (Confirmed by Railway staff on the Help Station.) If Cloudflare forwards `Host: healingbuds.co.za` to `*.up.railway.app`, Railway finds no service for that host and returns **404**; even if it routed, the app would never see the tenant hostname. **Therefore a Cloudflare Worker must rewrite `Host` → our canonical Railway origin and carry the real tenant hostname in a custom header the app reads.** This is the central architectural change vs. the original naive plan.

3. **CF→origin SSL must be "Full", not "Full (strict)".** Railway explicitly recommends Full because it may briefly serve its default `*.up.railway.app` cert during renewals (Full-strict → 526). The SaaS SNI/Host mismatch also blocks Full-strict without an Enterprise SNI-rewrite. Full still encrypts the hop. [Railway SSL troubleshooting]

4. **DCV Delegation gives hands-off cert renewal.** Tenant adds **one CNAME**: `_acme-challenge.<domain> → <domain>.<UNIQUE_ID>.dcv.cloudflare.com`. A CNAME on the `_acme-challenge` *subdomain* is allowed even on one.com (it's not the apex). [delegated-dcv]

5. **Clerk is NOT a blocker.** Storefronts use Clerk for customer login/checkout (`app/store/[slug]/login`, `/dashboard`, `/settings`, `/checkout`), **but** `app/layout.tsx:117` confirms Clerk now uses its **standard hosted redirect flow** (no `proxyUrl`, no per-domain CNAME). That handshake goes directly to Clerk's domain and **bypasses our Cloudflare/Railway path**, so CF fronting does not break it. The `/__clerk` rewrite in `next.config.js` is now vestigial. (Validate login + checkout on the spike anyway.)

6. **Pricing:** Cloudflare for SaaS is available on Free/Pro/Business/Enterprise; **100 custom hostnames included free**, then **$0.10/hostname/month** (verify live before sign-off). API limit ~15 cert-issuances/min.

## Goals

- Tenants on **any** registrar — including one.com — can connect an **apex** domain that resolves and serves valid HTTPS.
- Replace Railway-direct custom-domain provisioning with a **Cloudflare for SaaS** client, behind a feature flag, with no change to middleware tenant-resolution semantics.
- Keep **Railway** as the sole compute origin (no hosting migration).
- Per-hostname SSL is **issued and auto-renewed** without tenant or operator manual steps after initial DNS.
- **Zero regression** for existing working domains (`lekkerweed.co.za`, `*.budstacks.io` subdomains) and for Clerk customer auth.
- Migrate the three live entries (`xplaincrypto.ai` spike → `healingbuds.co.za` → `lekkerweed.co.za`) with instant DNS rollback available.

## User Stories

> Sequenced. **US-002 is a GO/NO-GO gate** — no live migration until the spike proves the path end-to-end.

### US-001: Provision Cloudflare for SaaS infrastructure (ops)
**Description:** As an operator, I need a Cloudflare account, SaaS zone, fallback origin, and API access so the platform can register custom hostnames.

**Acceptance Criteria:**
- [ ] Cloudflare account created; a **dedicated throwaway zone** added as the SaaS zone (a spare domain we control). **`budstacks.io` is NOT moved to Cloudflare** in this PRD — all `*.budstacks.io` subdomains + Namecheap stay untouched (see OQ-5).
- [ ] **Apex-proxying eligibility confirmed with Cloudflare** (account team / Static IPs / BYOIP). Record the allocated anycast A/AAAA IPs. **If unavailable, STOP and revisit Open Question OQ-1** before proceeding.
- [ ] **Fallback origin** configured: a proxied (orange-cloud) record in the zone pointing to the Railway origin host; designated as Fallback Origin.
- [ ] **DCV Delegation** enabled; the account `<UNIQUE_ID>` for `_acme-challenge` CNAMEs recorded.
- [ ] **API token** scoped to the zone (Custom Hostnames: Edit + DNS: Edit) created and stored as a deployment secret (not committed).
- [ ] Pricing tier confirmed and documented (free allotment + per-hostname overage).

### US-002: De-risking spike on `xplaincrypto.ai` (GO/NO-GO)
**Description:** As an engineer, I must prove the full Cloudflare → Worker → Railway → app path works on the throwaway demo domain before touching live sites.

**Acceptance Criteria:**
- [ ] Spike uses the **dedicated CF zone + fallback origin only** — `budstacks.io`, its subdomains, and Namecheap are **not touched**.
- [ ] `xplaincrypto.ai` registered as a Cloudflare custom hostname via API; SSL reaches `active`.
- [ ] A **Cloudflare Worker** rewrites `Host` → the canonical Railway origin host and sets `X-Original-Host: xplaincrypto.ai`; request reaches the Railway service (no 404).
- [ ] App resolves the correct tenant from `X-Original-Host` (storefront renders identically to the subdomain version).
- [ ] **`X-Original-Host` is only trusted when a shared-secret header set by the Worker matches** (proves the spoofing mitigation, US-004).
- [ ] HTTPS valid end-to-end with CF SSL mode **Full**; no redirect loop; no mixed content.
- [ ] **Clerk customer login + a test checkout succeed** on `xplaincrypto.ai`.
- [ ] Apex variant validated: point an apex test domain's A-records at the CF anycast IPs and confirm it serves. *(If apex-proxying is not yet enabled, mark this sub-item blocked and surface to OQ-1.)*
- [ ] Findings written up; explicit **GO/NO-GO** recorded.

### US-003: Cloudflare Worker — host rewrite + tenant header
**Description:** As an engineer, I need a deployed Worker that makes Railway's host-based routing work while preserving tenant identity.

**Acceptance Criteria:**
- [ ] Worker (in repo, e.g. `infra/cf-worker/`) fetches the canonical Railway origin, sets request `Host` to the origin host, sets `X-Original-Host` to the original hostname, and sets `X-CF-Proxy-Secret` from a Worker secret.
- [ ] Bound to custom-hostname traffic (route/binding validated on the plan tier).
- [ ] Streams method, path, query, body, and response unchanged (GET/POST/PUT/DELETE + redirects).
- [ ] Origin host + secret are Worker config/secrets, not hardcoded.
- [ ] Deploy steps documented (`docs/guides/DOMAINS.md`).

### US-004: Middleware reads `X-Original-Host` (trusted via secret)
**Description:** As the app, I must resolve the tenant from the Worker-supplied hostname instead of the Railway-rewritten `Host`.

**Acceptance Criteria:**
- [ ] `middleware.ts` computes the effective hostname as `X-Original-Host` **only if** `X-CF-Proxy-Secret` matches `CF_PROXY_SECRET` (env); otherwise falls back to `Host`.
- [ ] `parseHostToTenantHint` and the `x-tenant-custom-domain` / `x-tenant-subdomain` flow are otherwise unchanged.
- [ ] Direct requests to `*.up.railway.app` with a spoofed `X-Original-Host` and no/var wrong secret are **ignored** (resolve via real `Host`).
- [ ] Unit tests cover: valid secret + custom host, missing secret, wrong secret, subdomain passthrough.
- [ ] Typecheck/lint passes.

### US-005: `lib/cloudflare-saas.ts` API client
**Description:** As the platform, I need a typed client for Cloudflare Custom Hostnames mirroring the shape of `lib/railway-api.ts`.

**Acceptance Criteria:**
- [ ] `createCustomHostname(hostname)` → POST `/zones/{zone}/custom_hostnames` (`ssl.method: 'txt'` or delegated DCV, `type: 'dv'`); returns `{ id, status, ssl.status, ownership/DCV records }`.
- [ ] `deleteCustomHostname(id)` and `getCustomHostnameStatus(id)` implemented.
- [ ] Reads `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_SAAS_ANYCAST_IPS`, `CLOUDFLARE_DCV_ID`; throws clear errors if missing (mirror `railway-api.ts` `getConfig()`).
- [ ] Errors surface Cloudflare's message; no secret leakage in logs.
- [ ] Unit tests with mocked fetch (success + error). Typecheck/lint passes.

### US-006: Swap provisioning call sites behind `USE_CLOUDFLARE_DOMAINS` flag
**Description:** As an operator, I want domain CRUD to call Cloudflare instead of Railway, switchable without a redeploy risk.

**Acceptance Criteria:**
- [ ] `app/api/super-admin/tenants/[id]/route.ts` (PATCH add/change, DELETE) calls the Cloudflare client when `USE_CLOUDFLARE_DOMAINS=true`, else the existing Railway path (default off).
- [ ] `cfHostnameId` + returned DNS instructions stored in `tenants.settings` JSON (**no schema migration** — reuses the existing JSON column alongside legacy `railwayDomainId`).
- [ ] `verify-domain/route.ts` uses `getCustomHostnameStatus` (authoritative SSL/validation state) when the flag is on; DNS-resolve fallback retained.
- [ ] Audit-log entries record provider + hostname id on change.
- [ ] Typecheck/lint passes.

### US-007: DNS-instructions UI for the Cloudflare model
**Description:** As a super-admin, I want the tenant-facing DNS instructions to show the Cloudflare records (apex A-records + DCV CNAME), not the Railway CNAME.

**Acceptance Criteria:**
- [ ] `tenant-edit-form.tsx` renders, when on the CF provider: apex **A/AAAA** records (anycast IPs) for apex domains, or the **CNAME target** for subdomains, **plus** the `_acme-challenge` **DCV CNAME**.
- [ ] The old "apex CNAME not allowed" warning is replaced by the apex **A-record** instructions (problem now solved).
- [ ] Per-record copy-to-clipboard retained; SSL status reflects `getCustomHostnameStatus`.
- [ ] Verify in browser using dev-browser skill.
- [ ] Typecheck/lint passes.

### US-008: Migrate `healingbuds.co.za` (currently broken)
**Description:** As an operator, I want the stuck partner apex domain live via Cloudflare.

**Acceptance Criteria:**
- [ ] Custom hostname created for `healingbuds.co.za`; apex A-records + DCV CNAME communicated to the registrant (one.com).
- [ ] SSL reaches `active`; site serves over HTTPS; storefront renders; Clerk login + checkout work.
- [ ] Old Railway domain entry for `healingbuds.co.za` removed to avoid double-registration / stuck ACME.
- [ ] **Rendering unchanged** (HealingBuds is a live partner site — visual parity verified).
- [ ] Rollback path documented (revert apex A-records).

### US-009: Migrate `lekkerweed.co.za` (live, working) with rollback
**Description:** As an operator, I want the already-working live domain moved to Cloudflare during a window, with instant rollback.

**Acceptance Criteria:**
- [ ] Migrated in a low-traffic window; current Railway DNS records captured for rollback **before** any change.
- [ ] SSL `active`, storefront + auth verified post-cutover.
- [ ] Rollback rehearsed/documented (re-point to prior Railway CNAME).

### US-010: Decommission Railway-direct provisioning + refresh docs
**Description:** As a maintainer, I want dead provider code and docs cleaned up after cutover.

**Acceptance Criteria:**
- [ ] After all live domains are on Cloudflare and stable, make `USE_CLOUDFLARE_DOMAINS` the default; remove the Railway custom-domain call paths (keep `*.up.railway.app` as origin).
- [ ] Remove the vestigial `/__clerk` rewrite from `next.config.js` if confirmed unused.
- [ ] `docs/guides/DOMAINS.md` rewritten for the Cloudflare model (apex A-records, DCV, Worker, SSL Full).
- [ ] Decide Namecheap subdomain code fate (see OQ-3); remove if the wildcard supersedes it.

## Functional Requirements

- **FR-1:** The system MUST provision tenant custom domains via Cloudflare Custom Hostnames (`lib/cloudflare-saas.ts`) when `USE_CLOUDFLARE_DOMAINS=true`.
- **FR-2:** Apex domains MUST be connectable via **A/AAAA records** (CF anycast IPs); the UI MUST present those records.
- **FR-3:** Certificate validation/renewal MUST use **DCV Delegation** (a single `_acme-challenge` CNAME per domain).
- **FR-4:** A Cloudflare Worker MUST rewrite the `Host` header to the canonical Railway origin and pass the original hostname in `X-Original-Host`, authenticated by `X-CF-Proxy-Secret`.
- **FR-5:** `middleware.ts` MUST resolve the tenant from `X-Original-Host` only when `X-CF-Proxy-Secret` matches `CF_PROXY_SECRET`; otherwise from `Host`.
- **FR-6:** CF→Railway SSL mode MUST be **Full** (documented; not Full-strict).
- **FR-7:** Domain add/change/remove MUST be idempotent and audit-logged, storing `cfHostnameId` in `tenants.settings`.
- **FR-8:** `verify-domain` MUST report authoritative status from Cloudflare (`ssl.status`, validation errors) when the flag is on.
- **FR-9:** Migration MUST NOT leave a tenant domain registered in **both** Railway and Cloudflare (avoids stuck ACME).
- **FR-10:** Existing subdomain routing (`*.budstacks.io`) and Clerk customer auth MUST continue working unchanged.

## Non-Goals (Out of Scope)

- Migrating compute off Railway.
- Tenant-admin **self-service** domain management (stays super-admin; future PRD — was US-007 in the prior PRD).
- Automatic DNS configuration at the tenant's registrar (tenant always adds records manually).
- Domain purchase/registration, custom email domains, per-domain uptime monitoring.
- Cloudflare WAF/caching/CDN tuning beyond what's required to not break the app and Clerk.
- Enterprise Cloudflare SNI/Host-rewrite rules (we use a Worker to stay plan-agnostic).
- Clerk satellite-domain or FAPI-proxy rework (current redirect flow is retained).
- Moving `budstacks.io` DNS to Cloudflare / retiring the Namecheap subdomain automation — deferred to a later decision (OQ-3, OQ-5).

## Design Considerations

- **Reuse the existing model:** keep `tenants.customDomain` + `tenants.settings` JSON; add `cfHostnameId` alongside legacy `railwayDomainId` (no migration). Mirror `lib/railway-api.ts` structure for `lib/cloudflare-saas.ts` so call sites change minimally.
- **UI:** extend `tenant-edit-form.tsx` rather than building new screens; swap the record list + replace the apex warning with apex A-record instructions.
- **Worker** lives in-repo (`infra/cf-worker/`) and is small (~30 lines) and stateless.

## Technical Considerations

- **Canonical origin host** differs per environment (`budstack-saas-development.up.railway.app` vs `...-production...`) — Worker reads it from config.
- **Security:** `*.up.railway.app` is publicly reachable, so `X-Original-Host` is spoofable without the shared-secret gate (FR-5). The secret is the trust boundary; rotate via env.
- **Sitemap/robots/OG/canonical URLs** already derive from the resolved tenant domain — confirm they read the effective (X-Original-Host) hostname, not Railway's.
- **Dev/preview carve-outs** (`.abacusai.app`, localhost) in middleware are unaffected.
- **Clerk dev instance:** the default frontend API (`flying-jennet-34.clerk.accounts.dev`) is a *development* instance — production-instance setup is a separate concern (OQ-4).

## Test & Safety Strategy

**Core principle — inert until DNS is deliberately pointed at Cloudflare.** Nothing in this work changes how a live domain behaves until its DNS records are changed at the registrar. Every code layer is built to be a no-op until that final, per-domain, instantly-reversible step. We never "flip a switch" globally.

**Inert-by-default guarantees (verify each before any live cutover):**
- **Flag:** `USE_CLOUDFLARE_DOMAINS` defaults `false`. With it off, all provisioning call sites use the existing Railway path — the Cloudflare client is never invoked.
- **Secret:** `CF_PROXY_SECRET` unset ⇒ the middleware `X-Original-Host` branch can never trust an inbound header, so it always falls back to `Host`. The new branch is dead code until the secret exists.
- **Worker:** deployed only on the dedicated CF zone / custom hostnames. It is not in the request path of `*.budstacks.io`, `lekkerweed.co.za`, or `healingbuds.co.za` until their DNS points at Cloudflare.
- **UI:** the new DNS-instruction rendering is gated on the CF provider/flag; the existing Railway instructions stay for flagged-off tenants.
- **No schema migration:** `cfHostnameId` reuses the `tenants.settings` JSON column, so the DB is unchanged and there is nothing to roll back at the data layer.

**Five-rung test ladder — climb in order; do not skip a rung:**
1. **Local unit** — `lib/cloudflare-saas.ts` (mocked fetch) and the middleware secret-gate logic (valid/missing/wrong secret, subdomain passthrough). No network, no live anything.
2. **Staging, no DNS change** — deploy with the flag/secret/Worker present on the dedicated CF zone only. Confirm existing domains are completely unaffected (they still hit Railway directly).
3. **Throwaway-domain spike (`xplaincrypto.ai`)** — US-002 GO/NO-GO. Prove CF → Worker → Railway → app end-to-end, including Clerk login + a test checkout and the apex A-record variant. Nothing live is touched. **NO live migration until this records an explicit GO.**
4. **Broken live (`healingbuds.co.za`)** — the motivating case; it is already not serving, so migrating it has near-zero downside and high upside. Capture its current (stuck) state first; cut over; verify rendering parity (it is a live partner site).
5. **Working live, last (`lekkerweed.co.za`)** — only after 1–4 pass. Low-traffic window, DNS records captured for rollback **before** any change, rehearsed revert.

**Pre-flight checklist before each live cutover:**
- [ ] Spike GO recorded (rung 3) and apex-proxying eligibility confirmed (OQ-1).
- [ ] Current registrar DNS records for the target domain captured verbatim (for rollback).
- [ ] CF custom hostname shows `ssl.status: active` for the target before DNS is moved.
- [ ] A rollback owner + comms window agreed (for `lekkerweed` only).

## Rollback

Rollback is **per-domain and DNS-first** — the fastest, lowest-blast-radius lever is to repoint the one domain being migrated, leaving every other domain and all code untouched.

- **Per-domain revert (primary):** restore the captured registrar DNS records (apex A-records / CNAME) for that single domain back to the prior Railway target. Propagation returns it to the pre-migration path; no deploy needed. This is why each cutover captures records first.
- **Disable the new path globally (no redeploy of logic):** set `USE_CLOUDFLARE_DOMAINS=false` to route provisioning back to Railway; unset/rotate `CF_PROXY_SECRET` to make middleware ignore `X-Original-Host` entirely.
- **Worker unbind:** remove the Worker route/binding so traffic that still reaches the CF zone passes through (or fails closed) without host rewriting.
- **Full abort:** with the flag off, the secret unset, and DNS reverted, the system is back to the exact Railway-direct behaviour it has today — the remaining CF client/Worker code is inert and can be removed later (US-010 in reverse).

## Success Metrics

- A one.com **apex** domain (`healingbuds.co.za`) resolves with valid HTTPS within one DNS-propagation cycle of the tenant adding the records.
- New custom-domain onboarding requires the tenant to add **only** A-records (or one CNAME) **+ one DCV CNAME** — no apex CNAME, no support escalation.
- **0** regressions: `lekkerweed.co.za`, all `*.budstacks.io` subdomains, and Clerk login/checkout pass post-migration.
- Certificate renewals require **0** manual steps after initial setup.
- Operator can add/remove a custom domain without touching the Railway or Cloudflare dashboards.

## Open Questions

- **OQ-1 (blocking):** Is **apex-proxying** available on our Cloudflare plan, and will Cloudflare allocate **Static IPs / BYOIP** (recommended over rotating anycast IPs)? If not, the fallback is "apex tenants must use a `www.`/subdomain + registrar redirect" — confirm acceptable. *This gates US-002's apex sub-item and US-008.*
- **OQ-2:** Can a Worker (or Origin Rule) bind to **custom-hostname traffic on our plan tier**, or is Workers-for-Platforms / Enterprise required? Validate in US-002; Origin Rules host-override is a possible simplification if it applies to SaaS custom hostnames.
- **OQ-3:** Retire the **Namecheap** subdomain automation (`lib/namecheap-api.ts`) once `*.budstacks.io` is a Cloudflare wildcard? (The wildcard makes per-tenant subdomain DNS calls unnecessary.) In/out of this PRD?
- **OQ-4:** Move Clerk to a **production instance** (custom FAPI domain) as part of this, or track separately? Current setup points at a `*.clerk.accounts.dev` dev instance.
- **OQ-5 (decided 2026-06-02):** Use a **dedicated throwaway Cloudflare zone** for the SaaS fallback origin during build + spike, so `budstacks.io` stays on Namecheap and every subdomain is untouched. Moving `budstacks.io` to Cloudflare (to retire Namecheap via a `*.budstacks.io` wildcard) is a **separate, later** decision — explicitly out of scope here.
- **OQ-6:** Does CF caching ever serve an authenticated storefront page? Confirm cache rules bypass dynamic/auth routes during US-002.
