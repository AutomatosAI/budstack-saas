# PRD: Custom Domain Support for BudStacks SaaS

## Introduction

Enable BudStacks tenants to connect their own domain names (e.g., `onetree.com` or `xplaincrypto.ai`) to their storefronts. Currently, tenants are accessible via `{slug}.budstacks.io` subdomains only. Custom domains are essential for white-label branding — clients want their storefront to live on their own domain with no visible reference to BudStacks.

This PRD covers the full lifecycle: super-admin assigns a custom domain, Railway provisions SSL, the client configures DNS at their registrar, BudStacks verifies the DNS is correct, and the storefront (including Clerk authentication) works seamlessly on the custom domain.

## Implementation Status (as of 2026-04-09)

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Railway API client | DONE | `lib/railway-api.ts` — add/remove/list domains via GraphQL |
| Phase 2: API integration | DONE | PATCH API provisions Railway domain, stores DNS records in settings |
| Phase 3: Super-admin UI | DONE | Verification badge, DNS instructions panel with Railway's actual records |
| Phase 4: Auth (Clerk proxy) | DONE | `/__clerk` rewrite in next.config.js, `proxyUrl` on ClerkProvider |
| Phase 5: Storefront rendering | DONE | Middleware rewrites, sitemap/robots.txt use custom domain |
| Phase 6: E2E validation | DONE | `xplaincrypto.ai` tested — homepage + `/products` + `/the-wire` all render |
| Phase 7: Tenant-admin self-service | TODO | Move domain management from super-admin to tenant-admin |
| Phase 8: Production infrastructure | TODO | Separate Railway staging/production environments |

### Resolved Open Questions

1. **Clerk approach**: Proxy mode via `/__clerk` path rewrite — zero per-domain Clerk setup needed
2. **Railway DNS records**: Each domain gets a UNIQUE CNAME target + TXT verification record from Railway API (not a static target)
3. **Railway API token**: Does NOT start with `rlw_` — regular UUID format
4. **RAILWAY_CNAME_TARGET env var**: REMOVED — each domain's CNAME target comes from the `customDomainCreate` API response and is stored in `settings.railwayDnsRecords`
5. **DNS records needed**: TWO records per domain — CNAME (or ALIAS for apex) + TXT (`_railway-verify`)
6. **Railway cost**: Custom domains included in plan
7. **CORS for S3**: No issues — S3 assets use signed URLs served directly from amazonaws.com

---

## Goals

- Allow super-admins to assign a custom domain to any tenant via the existing edit form
- Automate Railway domain provisioning (SSL/TLS) when a custom domain is saved
- Provide a DNS verification system so super-admins can confirm the client's DNS is configured correctly
- Support both subdomain (`shop.clientbrand.com`) and root/apex domain (`clientbrand.com`) connections
- Enable Clerk authentication to work on custom domains via proxy mode
- Provide clear DNS instructions sourced directly from Railway's API response

---

## User Stories

### US-001: Railway Domain Provisioning on Save — DONE
**Description:** As a super-admin, when I save a custom domain for a tenant, the system should automatically add that domain to Railway so SSL is provisioned.

**Acceptance Criteria:**
- [x] PATCH `/api/super-admin/tenants/[id]` calls Railway `customDomainCreate` GraphQL mutation
- [x] Removing customDomain calls Railway `customDomainDelete`
- [x] Changing customDomain deletes old + adds new
- [x] Railway API errors returned as clear error messages
- [x] DNS records from Railway response stored in `settings.railwayDnsRecords`
- [x] Railway domain ID stored in `settings.railwayDomainId`

### US-002: DNS Verification Endpoint — DONE
**Description:** As a super-admin, I want to check whether a tenant's custom domain DNS is configured correctly.

**Acceptance Criteria:**
- [x] `GET /api/super-admin/tenants/[id]/verify-domain`
- [x] DNS lookup (CNAME/A record) on tenant's customDomain
- [x] Returns verified/pending/misconfigured status
- [x] Stores result in `settings.domainVerification`

### US-003: DNS Verification UI — DONE
**Description:** As a super-admin, I want to see domain verification status and trigger a re-check.

**Acceptance Criteria:**
- [x] Verification badge: green Verified / yellow Pending / red Misconfigured
- [x] "Verify DNS" button triggers endpoint
- [x] Misconfigured shows expected vs found
- [x] DNS instructions panel shows Railway's actual records (CNAME + TXT)
- [x] Copy-to-clipboard for individual records and full instructions

### US-004: Clerk Proxy Mode Authentication — DONE
**Description:** As a user on a custom domain, I want auth to work seamlessly.

**Acceptance Criteria:**
- [x] `next.config.js` rewrite: `/__clerk/:path*` → Clerk frontend API
- [x] `app/layout.tsx` passes `proxyUrl` to ClerkProvider when `x-tenant-custom-domain` header is present
- [x] No per-domain Clerk dashboard configuration required
- [x] Single DNS record approach (no separate `clerk.{domain}` CNAME)

### US-005: Storefront Rendering on Custom Domain — DONE
**Description:** As a visitor on a custom domain, the storefront renders identically.

**Acceptance Criteria:**
- [x] Middleware Priority 2 rewrites `customdomain.com/path` → `/store/_cd/path`
- [x] `getCurrentTenant()` resolves via `x-tenant-custom-domain` header
- [x] All subpages work (/products, /about, /contact, etc.)
- [x] OG metadata uses custom domain
- [x] sitemap.xml and robots.txt use custom domain
- [x] No `budstacks.io` leaks in navigation or URLs

### US-006: Domain Lifecycle — DONE
**Description:** Domain removal and tenant deletion clean up Railway resources.

**Acceptance Criteria:**
- [x] Clearing customDomain triggers Railway domain deletion
- [x] Deleting tenant removes Railway custom domain (best-effort)
- [x] Verification status cleared on domain removal
- [x] Audit log records changes

### US-007: Move Domain Management to Tenant-Admin — TODO
**Description:** As a tenant admin, I want to manage my own custom domain without needing super-admin intervention.

**Acceptance Criteria:**
- [ ] New API: `PATCH /api/tenant-admin/domain` — sets/removes customDomain for current tenant
- [ ] Calls Railway API to provision/remove domain (same logic as super-admin)
- [ ] DNS instructions panel in tenant-admin settings page
- [ ] Verify DNS button in tenant-admin
- [ ] Super-admin can still override via existing super-admin UI
- [ ] Tenant-admin cannot set a domain that's already taken by another tenant
- [ ] Typecheck/lint passes

### US-008: Production Infrastructure — TODO
**Description:** Separate Railway environments for staging and production.

**Acceptance Criteria:**
- [ ] New Railway environment: `production` with its own service instance
- [ ] Production deploys from `main` branch, staging from `template-editor`
- [ ] Separate env vars per environment (DB, Clerk keys, Railway IDs)
- [ ] Custom domains provisioned on production environment only
- [ ] Subdomain routing works on production (`*.budstacks.io`)
- [ ] CI/CD pipeline: PR → staging, merge to main → production

---

## Functional Requirements

- **FR-1:** ~~DONE~~ Railway GraphQL API client (`lib/railway-api.ts`) handles add/remove/list operations
- **FR-2:** ~~DONE~~ PATCH API calls Railway on customDomain changes, stores DNS records in settings
- **FR-3:** ~~DONE~~ DNS verification supports CNAME + A/AAAA lookups
- **FR-4:** ~~DONE~~ Super-admin UI shows verification status, DNS instructions from Railway API
- **FR-5:** ~~DONE~~ Clerk proxy mode via `/__clerk` path rewrite
- **FR-6:** ~~DONE~~ All storefront URLs use custom domain when configured
- **FR-7:** TODO — Tenant-admin domain management API + UI
- **FR-8:** TODO — Production Railway environment with separate config

---

## Non-Goals (Out of Scope)

- Automatic DNS configuration — client always configures at their registrar
- Domain purchasing/registration
- CDN/edge caching layer
- Custom email domains
- Wildcard custom domains
- Domain transfer tooling
- Uptime monitoring per custom domain

---

## Technical Architecture (Implemented)

### Railway API Integration
- GraphQL endpoint: `https://backboard.railway.com/graphql/v2`
- `customDomainCreate` returns unique CNAME target + TXT verification per domain
- DNS records stored in `settings.railwayDnsRecords[]` (array of `{ hostlabel, requiredValue, status }`)
- Railway auto-provisions SSL after both DNS records are configured

### Clerk Proxy Mode
- `next.config.js` rewrite: `/__clerk/:path*` → `${NEXT_PUBLIC_CLERK_FRONTEND_API}/__clerk/:path*`
- `app/layout.tsx` detects custom domain via `x-tenant-custom-domain` header → sets `proxyUrl` on ClerkProvider
- Zero Clerk dashboard changes per domain

### Middleware Routing (3 priorities)
1. **Subdomain**: `slug.budstacks.io/path` → `/store/slug/path` (rewrite)
2. **Custom domain**: `onetree.com/path` → `/store/_cd/path` (rewrite, sets `x-tenant-custom-domain` header)
3. **Path-based**: `/store/slug/path` → sets `x-tenant-slug` header (localhost/dev)

### Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `RAILWAY_API_TOKEN` | Yes | Bearer token with project-level access |
| `RAILWAY_PROJECT_ID` | Yes | Railway project ID |
| `RAILWAY_SERVICE_ID` | Yes | Railway service ID |
| `RAILWAY_ENVIRONMENT_ID` | Yes | Target environment ID |
| `NEXT_PUBLIC_BASE_DOMAIN` | Yes | `budstacks.io` (no trailing space!) |
| `NEXT_PUBLIC_CLERK_FRONTEND_API` | Yes | Clerk's frontend API URL for proxy rewrite |

### Key Files
| File | Purpose |
|------|---------|
| `lib/railway-api.ts` | Railway GraphQL client (add/remove/list domains) |
| `middleware.ts` | 3-priority routing including custom domain rewrite |
| `app/layout.tsx` | Clerk proxy mode (`proxyUrl` prop) |
| `next.config.js` | `/__clerk` rewrite rule |
| `app/api/super-admin/tenants/[id]/route.ts` | Domain CRUD + Railway provisioning |
| `app/api/super-admin/tenants/[id]/verify-domain/route.ts` | DNS verification |
| `app/super-admin/tenants/[id]/tenant-edit-form.tsx` | Verification UI + DNS instructions |
| `lib/tenant.ts` | `getCurrentTenant()` resolves custom domain |
| `lib/tenant-utils.ts` | `getTenantBaseUrl()` returns custom domain URL |

---

## Success Metrics

- [x] Super-admin can assign a custom domain and see Railway provision it within 60 seconds
- [x] DNS verification correctly reports status within 5 seconds
- [x] Custom domain storefront is visually identical to subdomain version
- [x] Clerk auth works on custom domains via proxy mode
- [x] Full domain lifecycle (add → verify → use → remove) works without Railway dashboard
- [ ] Tenant-admin can self-manage their custom domain (Phase 7)
- [ ] Production environment operational with custom domain support (Phase 8)

---

## Lessons Learned (Implementation)

1. **Railway CNAME target is per-domain, not per-service** — cannot use a static env var; must capture from API response
2. **Railway requires BOTH CNAME + TXT records** before provisioning SSL — original assumption of single record was wrong
3. **`NEXT_PUBLIC_BASE_DOMAIN` trailing space** broke all subdomain routing — env var hygiene matters
4. **Railway API token format** is a UUID, not `rlw_` prefixed
5. **`projectId` is required** in `CustomDomainCreateInput` — Railway docs don't make this obvious
6. **Clerk proxy mode** is the simplest multi-domain auth approach — no per-domain setup, single DNS record for auth
