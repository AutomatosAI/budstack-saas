# PRD: Custom Domain Support for BudStacks SaaS

## Introduction

Enable BudStacks tenants to connect their own domain names (e.g., `shop.clientbrand.com` or `clientbrand.com`) to their storefronts. Currently, tenants are accessible via `{slug}.budstacks.io` subdomains only. Custom domains are essential for white-label branding — clients want their storefront to live on their own domain with no visible reference to BudStacks.

This PRD covers the full lifecycle: super-admin assigns a custom domain, Railway provisions SSL, the client configures DNS at their registrar, BudStacks verifies the DNS is correct, and the storefront (including Clerk authentication) works seamlessly on the custom domain.

**Current state of the codebase (as of 2026-04-08):**

- `customDomain` field already exists on the `tenants` table (nullable, unique)
- Middleware already has Priority 2 routing for custom domains (sets `x-tenant-custom-domain` header)
- `getCurrentTenant()` already queries by `customDomain` when the header is present
- `getTenantUrl()` already returns `https://{customDomain}` when set
- Super-admin tenant edit form already has a Custom Domain input field
- Super-admin PATCH API already validates `customDomain` uniqueness
- **What's missing:** Railway domain provisioning, DNS verification, Clerk multi-domain auth, and production infrastructure

**Deployment context:**

- Railway project ID: `10d943ff-8d5c-4ed5-ad0b-6a2671d8e098`, service: `budstack-saas`
- Current deployment: `template-skill` branch → `budstack.to` (development only)
- Production target: Two Railway environments — `staging` + `production`
- Base domain: `budstacks.io` (env var: `NEXT_PUBLIC_BASE_DOMAIN`)
- DNS managed via Namecheap API (`lib/namecheap-api.ts`)

---

## Goals

- Allow super-admins to assign a custom domain to any tenant via the existing edit form
- Automate Railway domain provisioning (SSL/TLS) when a custom domain is saved
- Provide a DNS verification system so super-admins can confirm the client's DNS is configured correctly
- Support both subdomain (`shop.clientbrand.com`) and root/apex domain (`clientbrand.com`) connections — the client is responsible for their DNS configuration
- Enable Clerk authentication to work on custom domains (login, signup, session management)
- Ship and test everything on the current development deployment before building production infrastructure
- Provide clear DNS instructions that super-admins can share with clients

---

## User Stories

### US-001: Railway Domain Provisioning on Save
**Description:** As a super-admin, when I save a custom domain for a tenant, the system should automatically add that domain to Railway so SSL is provisioned — without me needing to log into the Railway dashboard.

**Acceptance Criteria:**
- [ ] When `customDomain` is saved via PATCH `/api/super-admin/tenants/[id]`, the API calls Railway's GraphQL API to add the domain to the service
- [ ] When `customDomain` is removed (set to null/empty), the API calls Railway to delete the custom domain
- [ ] When `customDomain` is changed, the API deletes the old domain and adds the new one
- [ ] Railway API errors are caught and returned to the super-admin as a clear error message (domain not removed from DB on Railway failure)
- [ ] Railway API credentials are stored as environment variables: `RAILWAY_API_TOKEN`, `RAILWAY_SERVICE_ID`, `RAILWAY_ENVIRONMENT_ID`
- [ ] The Railway CNAME target (e.g., `budstack-saas-production.up.railway.app`) is stored as env var `RAILWAY_CNAME_TARGET` for use in DNS instructions
- [ ] Typecheck/lint passes

### US-002: DNS Verification Endpoint
**Description:** As a super-admin, I want to check whether a tenant's custom domain DNS is configured correctly so I can troubleshoot connection issues without using external tools.

**Acceptance Criteria:**
- [ ] New API endpoint: `GET /api/super-admin/tenants/[id]/verify-domain`
- [ ] Performs DNS lookup (CNAME/A record) on the tenant's `customDomain`
- [ ] Returns one of: `{ status: "verified" }` (CNAME points to Railway target or budstacks.io), `{ status: "pending" }` (no DNS record found), `{ status: "misconfigured", expected: "...", found: "..." }` (points to wrong target)
- [ ] For root/apex domains: checks A/AAAA records as well as CNAME (since ALIAS/ANAME resolves to A records)
- [ ] Stores verification result and timestamp in tenant `settings` JSON field (key: `domainVerification`)
- [ ] Requires SUPER_ADMIN role authorization
- [ ] Typecheck/lint passes

### US-003: DNS Verification UI in Super-Admin
**Description:** As a super-admin, I want to see the domain verification status in the tenant edit form and trigger a re-check with one click.

**Acceptance Criteria:**
- [ ] Below the Custom Domain input in `tenant-edit-form.tsx`, show verification status badge: green "Verified", yellow "Pending", red "Misconfigured"
- [ ] "Verify DNS" button triggers the verification endpoint and updates the badge
- [ ] When status is "Misconfigured", show what was expected vs what was found
- [ ] When status is "Pending", show the DNS instructions the client needs to follow (record type, host, value)
- [ ] The Railway CNAME target value displayed comes from `RAILWAY_CNAME_TARGET` env var (fetched via a settings API or passed as page prop)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: DNS Instructions Display
**Description:** As a super-admin, I want copy-pasteable DNS instructions to send to the client so they know exactly what to configure at their registrar.

**Acceptance Criteria:**
- [ ] DNS instructions panel shown in tenant edit form when `customDomain` is set
- [ ] For subdomain domains (e.g., `shop.clientbrand.com`): shows CNAME record instruction with host = `shop`, value = Railway CNAME target
- [ ] For root/apex domains (e.g., `clientbrand.com`): shows both ALIAS/ANAME option and A-record fallback, with a note that CNAME on root is not universally supported
- [ ] "Copy to clipboard" button for the DNS record value
- [ ] Includes TTL recommendation (300 seconds for initial setup, increase after verified)
- [ ] Instructions are plain text suitable for pasting into an email or chat
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Clerk Multi-Domain Authentication
**Description:** As a user on a custom domain (e.g., `clientbrand.com`), I want to log in, sign up, and maintain my session so that the full storefront experience works on the custom domain — not just the public pages.

**Acceptance Criteria:**
- [ ] Clerk is configured to allow authentication on custom domains (not just `budstacks.io`)
- [ ] Research and implement the correct Clerk multi-domain strategy: either Clerk's "satellite" domain feature or adding each domain to Clerk's allowed origins
- [ ] Auth callbacks (`/auth/login`, `/auth/signup`, `/auth/callback`) work correctly on custom domains
- [ ] Session cookies are scoped correctly for custom domains (not leaking across tenants)
- [ ] Middleware auth flow works the same on custom domains as on `*.budstacks.io` subdomains
- [ ] If Clerk requires per-domain configuration, the domain add/remove API (US-001) also updates Clerk
- [ ] Document the chosen Clerk multi-domain approach in a code comment or `docs/` file for future reference
- [ ] Typecheck/lint passes

### US-006: Storefront Rendering on Custom Domain
**Description:** As a visitor on a custom domain, I want the storefront to render identically to the subdomain version — same template, same products, same theme — with no BudStacks branding leaking through.

**Acceptance Criteria:**
- [ ] Visiting `clientbrand.com` renders the same storefront as `slug.budstacks.io`
- [ ] All internal navigation links work (products, about, contact, consultation) — no links pointing back to `budstacks.io`
- [ ] OG metadata / SEO tags use the custom domain in URLs (already partially implemented in `page.tsx`)
- [ ] `robots.txt` and `sitemap.xml` use the custom domain as base URL (currently hardcoded to `subdomain.budstacks.io` — needs fix)
- [ ] Static assets (images, S3 content) load correctly (no CORS issues)
- [ ] CSS theme variables apply correctly
- [ ] Cart and checkout flows work on custom domain
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-007: Update Hardcoded Domain References
**Description:** As a developer, I need to ensure no hardcoded `budstacks.io` references break the custom domain experience.

**Acceptance Criteria:**
- [ ] `app/store/[slug]/robots.txt/route.ts` — use `customDomain` when available instead of hardcoded `subdomain.budstacks.io`
- [ ] `app/store/[slug]/sitemap.xml/route.ts` — use `customDomain` when available
- [ ] `tenant-welcome.tsx` email template — use custom domain URL when tenant has one
- [ ] `settings-form.tsx` — display custom domain alongside subdomain in UI
- [ ] `app/tenant-admin/seo/page.tsx` — show custom domain URL in SEO preview
- [ ] Any `console.log` references using hardcoded domain (cosmetic but clean up)
- [ ] Create a shared utility function `getTenantBaseUrl(tenant)` that returns `https://{customDomain}` if set, otherwise `https://{subdomain}.budstacks.io` — use consistently everywhere
- [ ] Grep the codebase for remaining `budstacks.io` string literals and address each one
- [ ] Typecheck/lint passes

### US-008: Domain Lifecycle — Deactivation and Removal
**Description:** As a super-admin, when I deactivate a tenant or remove their custom domain, the system should clean up the Railway domain and update verification status.

**Acceptance Criteria:**
- [ ] Clearing the `customDomain` field and saving triggers Railway domain deletion
- [ ] Deactivating a tenant (setting `isActive: false`) does NOT remove the custom domain from Railway (domain stays reserved, just returns 404/maintenance)
- [ ] Deleting a tenant removes the custom domain from Railway
- [ ] Domain verification status is cleared when custom domain is removed
- [ ] If Railway deletion fails, the error is logged but the DB update still proceeds (best-effort cleanup, same pattern as existing Namecheap integration)
- [ ] Typecheck/lint passes

### US-009: Railway API Client Library
**Description:** As a developer, I need a clean, tested Railway API client to manage custom domains programmatically.

**Acceptance Criteria:**
- [ ] New file: `lib/railway-api.ts`
- [ ] Implements: `addCustomDomain(domain: string): Promise<{ id: string; cnameTarget: string }>` — calls Railway `customDomainCreate` GraphQL mutation
- [ ] Implements: `removeCustomDomain(domainId: string): Promise<void>` — calls Railway `customDomainDelete` mutation
- [ ] Implements: `listCustomDomains(): Promise<Array<{ id: string; domain: string; status: string }>>` — for debugging/admin
- [ ] Stores Railway domain ID in tenant `settings` JSON (key: `railwayDomainId`) for later deletion
- [ ] Handles auth via `RAILWAY_API_TOKEN` env var
- [ ] Handles errors gracefully: network failures, invalid domain, domain already exists
- [ ] Uses `fetch` (no additional dependencies)
- [ ] Typecheck/lint passes

### US-010: End-to-End Custom Domain Test
**Description:** As a developer, I need to verify the full custom domain flow works end-to-end in the development environment before we build production.

**Acceptance Criteria:**
- [ ] Document a manual test plan covering: assign domain → Railway provisioned → DNS configured → storefront loads → auth works → domain removed → Railway cleaned up
- [ ] Test with a real domain (can use a test subdomain like `test.budstacks.io` pointing to the dev deployment, or a cheap test domain)
- [ ] Verify DNS verification endpoint returns correct status at each stage
- [ ] Verify all pages render correctly: homepage, products, product detail, about, contact, consultation
- [ ] Verify Clerk auth flow works on the custom domain
- [ ] Document any issues found and their resolution

---

## Functional Requirements

- **FR-1:** The super-admin PATCH API (`/api/super-admin/tenants/[id]`) must call Railway's GraphQL API to add/remove custom domains when the `customDomain` field changes
- **FR-2:** A new `GET /api/super-admin/tenants/[id]/verify-domain` endpoint must perform DNS lookups and return verification status
- **FR-3:** DNS verification must support both CNAME lookups (for subdomains) and A/AAAA lookups (for root domains using ALIAS/ANAME)
- **FR-4:** The super-admin tenant edit form must display domain verification status, a verify button, and DNS instructions
- **FR-5:** The `lib/railway-api.ts` module must handle all Railway custom domain GraphQL operations
- **FR-6:** The Railway domain ID must be persisted in the tenant's `settings` JSON for lifecycle management
- **FR-7:** All storefront URLs (navigation, SEO, sitemap, robots.txt, OG tags, email templates) must use the custom domain when one is configured
- **FR-8:** A shared `getTenantBaseUrl(tenant)` utility must be the single source of truth for generating tenant-facing URLs
- **FR-9:** Clerk authentication must function on custom domains — research indicates this requires either Clerk's satellite domain feature or per-domain allowed origins configuration
- **FR-10:** Domain removal must clean up Railway resources (best-effort, non-blocking)
- **FR-11:** The system must detect whether a custom domain is a subdomain or root/apex domain and provide appropriate DNS instructions for each case
- **FR-12:** DNS instructions must include: record type (CNAME vs ALIAS/A), host value, target value, recommended TTL

---

## Non-Goals (Out of Scope)

- **Tenant self-service domain management** — Only super-admins can assign custom domains (tenant-admin self-service is a future phase)
- **Automatic DNS configuration** — The client is always responsible for configuring DNS at their registrar; BudStacks only verifies
- **Domain purchasing/registration** — BudStacks does not buy or manage domains on behalf of clients
- **CDN/edge caching** — No Cloudflare or CDN layer in front of Railway for this phase
- **Production environment setup** — This PRD covers custom domains only; production infrastructure is a separate PRD that follows after custom domains are tested on dev
- **Custom email domains** — Email sending (welcome emails, notifications) continues to use BudStacks sender addresses
- **Wildcard custom domains** — Each tenant gets one custom domain, no `*.clientbrand.com` support
- **Domain transfer or migration tooling** — No automated migration from one domain to another
- **Uptime monitoring per custom domain** — Health checks remain on the service level, not per-domain

---

## Technical Considerations

### Railway GraphQL API

Railway exposes a GraphQL API at `https://backboard.railway.com/graphql/v2`. Key mutations:

```graphql
mutation CustomDomainCreate($input: CustomDomainCreateInput!) {
  customDomainCreate(input: $input) {
    id
    domain
    status { dnsRecords { ... } }
  }
}

mutation CustomDomainDelete($id: String!) {
  customDomainDelete(id: $id)
}
```

Auth: Bearer token via `RAILWAY_API_TOKEN`. The token must have project-level access.

**Required env vars (new):**
| Variable | Description | Example |
|----------|-------------|---------|
| `RAILWAY_API_TOKEN` | Railway API token with project access | `rlw_...` |
| `RAILWAY_SERVICE_ID` | Service ID for budstack-saas | UUID |
| `RAILWAY_ENVIRONMENT_ID` | Environment ID (staging or production) | UUID |
| `RAILWAY_CNAME_TARGET` | The CNAME target Railway provides for the service | `budstack-saas-production.up.railway.app` |

### DNS Resolution

Use Node.js built-in `dns.promises` module — no external dependencies needed:

```typescript
import { promises as dns } from 'dns';
// CNAME lookup for subdomains
const cnames = await dns.resolveCname('shop.clientbrand.com');
// A record lookup for root domains (ALIAS/ANAME resolves to A)
const addresses = await dns.resolve4('clientbrand.com');
```

### Clerk Multi-Domain Strategy

Clerk supports multiple approaches for multi-domain auth:

1. **Satellite domains** (Clerk's built-in feature) — Each custom domain is registered as a "satellite" that shares the session with the primary domain. Requires Clerk Pro plan.
2. **Allowed origins** — Add each custom domain to Clerk's allowed CORS origins via Dashboard or API. Simpler but may have limitations.
3. **Proxy mode** — Clerk requests proxied through your own domain. Most control, most complexity.

**Recommendation:** Research Clerk's current satellite domain offering first. If it requires per-domain manual setup in Clerk dashboard, consider whether the Clerk API can automate this. Document findings in US-005.

### Existing Code Touchpoints

| File | What Changes |
|------|-------------|
| `app/api/super-admin/tenants/[id]/route.ts` | Add Railway API calls on `customDomain` change |
| `app/api/super-admin/tenants/[id]/verify-domain/route.ts` | **New file** — DNS verification endpoint |
| `lib/railway-api.ts` | **New file** — Railway GraphQL client |
| `lib/tenant-utils.ts` | Add `getTenantBaseUrl()` utility |
| `app/super-admin/tenants/[id]/tenant-edit-form.tsx` | Add verification UI + DNS instructions |
| `app/store/[slug]/robots.txt/route.ts` | Use `customDomain` in URLs |
| `app/store/[slug]/sitemap.xml/route.ts` | Use `customDomain` in URLs |
| `components/tenant-welcome.tsx` | Use `customDomain` in email links |
| `app/tenant-admin/seo/page.tsx` | Show custom domain in SEO preview |
| `app/tenant-admin/settings/settings-form.tsx` | Show custom domain alongside subdomain |
| `middleware.ts` | No changes needed (custom domain routing already works) |
| `lib/tenant.ts` | No changes needed (custom domain resolution already works) |
| `prisma/schema.prisma` | No changes needed (`customDomain` field already exists) |

### Root vs Subdomain Detection

Simple heuristic to determine DNS instruction type:

```typescript
function isApexDomain(domain: string): boolean {
  const parts = domain.split('.');
  // "example.com" = 2 parts = apex
  // "shop.example.com" = 3+ parts = subdomain
  // Handle .co.uk style TLDs if needed
  return parts.length <= 2;
}
```

For this phase, this simple check is sufficient. Edge cases (`.co.uk`, `.com.au`) can be handled with a public suffix list library if needed later.

### Tenant Settings JSON Schema

The existing `settings` JSON field on the `tenants` table will store domain-related metadata:

```typescript
{
  // ... existing settings ...
  railwayDomainId: string | null,      // Railway's domain resource ID
  domainVerification: {
    status: "verified" | "pending" | "misconfigured",
    checkedAt: string,                  // ISO timestamp
    expected: string,                   // Expected CNAME target
    found: string | null,              // What DNS actually returned
  } | null
}
```

---

## Implementation Order

Based on user requirement: **test everything on development deployment first**.

| Phase | Stories | Rationale |
|-------|---------|-----------|
| **Phase 1: Core plumbing** | US-009, US-007 | Railway client + fix hardcoded refs — foundation work |
| **Phase 2: API integration** | US-001, US-002, US-008 | Wire Railway into super-admin API + verification + lifecycle |
| **Phase 3: UI** | US-003, US-004 | Super-admin can see status and share DNS instructions |
| **Phase 4: Auth** | US-005 | Clerk multi-domain — research-heavy, may need Clerk plan upgrade |
| **Phase 5: Storefront polish** | US-006 | Ensure perfect rendering on custom domains |
| **Phase 6: Validation** | US-010 | End-to-end test with a real domain on dev |

---

## Success Metrics

- Super-admin can assign a custom domain and see it provisioned on Railway within 60 seconds
- DNS verification correctly reports status within 5 seconds of clicking "Verify"
- A custom domain storefront is visually identical to the subdomain version (zero BudStacks branding leaks)
- Clerk auth works on custom domains (login, signup, session persistence)
- Full domain lifecycle (add → verify → use → remove) works without manual Railway dashboard intervention

---

## Open Questions

1. **Clerk plan level** — Does the current Clerk plan support satellite domains or multi-domain auth? Need to check Clerk dashboard/pricing.
2. **Railway API token scope** — Does the existing Railway token (if any) have permission for `customDomainCreate`? May need to generate a new token.
3. **Railway CNAME target** — What is the exact CNAME target for the current dev service? Need to check Railway dashboard or add a test domain to find out.
4. **Rate limits** — Does Railway's API have rate limits on domain operations? Unlikely to be an issue at current scale but worth checking.
5. **Propagation time** — Should we set user expectations for DNS propagation (up to 48 hours) in the instructions, or is this typically minutes with modern registrars?
6. **CORS for S3 assets** — Will S3-hosted images/assets need CORS headers updated to allow custom domains, or is the current config (`*.amazonaws.com`) sufficient since assets are served from S3 directly?
7. **Cost** — Does Railway charge per custom domain, or is it included in the plan?
