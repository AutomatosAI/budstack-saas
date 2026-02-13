# PRD: Subdomain & Custom Domain Management

## 1. Introduction
Implement robust Multi-Tenant routing logic using Next.js Middleware. This system allows each tenant to access their store via a unique subdomain (e.g., `healingbuds.budstack.to`) or a fully custom domain (e.g., `healingbuds.pt`), purely through URL rewrites.

## 2. Goals
- **Subdomain Routing:** `tenant.budstack.to` rewrites to `/store/tenant`.
- **Custom Domain Routing:** `example.com` rewrites to `/store/tenant`.
- **Legacy Path Restriction:** Block public access to `/store/tenant` paths; purely for admin/dev debugging.
- **Platform Redirect:** Unregistered subdomains redirect to the main `budstack.to` marketing site.
- **Seamless UX:** Users never see the internal `/store/...` path structure.

## 3. User Stories

### US-001: Subdomain Rewrite Logic
**Description:** As a user visiting `portugalbuds.budstack.to`, I want to see the PortugalBuds store content without the URL changing to `/store/portugalbuds`.

**Acceptance Criteria:**
- [ ] Middleware detects host ending in `.budstack.to`.
- [ ] Extracts subdomain (e.g., `portugalbuds`).
- [ ] Rewrites request to `/store/portugalbuds`.
- [ ] URL in browser bar remains `portugalbuds.budstack.to`.
- [ ] Verify in browser using dev-browser skill (host header simulation).

### US-002: Custom Domain Support (MVP)
**Description:** As a tenant with a professional brand, I want `healingbuds.pt` to show my BudStack store.

**Acceptance Criteria:**
- [ ] Schema: Verify `Tenant` model has `customDomain` (String, Unique).
- [ ] Middleware: Check if `host` matches a `customDomain` in the DB (cached check or edge config).
- [ ] Rewrites request to `/store/[mapped_tenant_slug]`.
- [ ] Verify using mocked host headers.

### US-003: Invalid Subdomain Handling
**Description:** As a visitor typing a typo (`helingbds.budstack.to`), I should be redirected to the main platform site instead of a generic 404.

**Acceptance Criteria:**
- [ ] If subdomain/custom domain does not exist in DB:
- [ ] Return `NextResponse.redirect('https://budstack.to')` (or configured platform URL).
- [ ] Do NOT show Next.js 404 error page.

### US-004: Restrict Legacy Path Access
**Description:** As a system admin, I want `/store/tenant` paths to be accessible only for debugging, while public users get redirected or 404s.

**Acceptance Criteria:**
- [ ] If user requests `/store/healingbuds` directly:
- [ ] Check User Role (if logged in) OR Environment (`NODE_ENV`).
- [ ] If `ADMIN` or `Development`: Allow access.
- [ ] Else: Return 404 or Redirect to `healingbuds.budstack.to`.

### US-005: Railway & DNS Configuration Guide
**Description:** As a developer, I need instructions on how to configure the infrastructure to support wildcard and custom domains.

**Acceptance Criteria:**
- [ ] Documentation created in `docs/` covering:
    - Adding `*.budstack.to` in Railway.
    - Adding `healingbuds.pt` in Railway.
    - Configuration of CNAME records.

## 4. Functional Requirements
1.  **FR-1:** `middleware.ts` must parse `req.headers.get('host')`.
2.  **FR-2:** Ignore platform hosts (`budstack.to`, `www`, `localhost`, `*.railway.app`).
3.  **FR-3:** Perform DB lookup (or Redis/Edge cache) to validate tenant existence.
4.  **FR-4:** Inject `x-tenant-slug` header for downstream components.
5.  **FR-5:** Handle `www` sub-subdomains (e.g., `www.healingbuds.pt` -> `healingbuds.pt` logic).

## 5. Non-Goals
- **Automated SSL Provisioning:** We will manually add domains in Railway UI for MVP. No API integration with Vercel/Railway for auto-issuance yet.
- **Multi-Region Routing:** All traffic goes to the primary region.

## 6. Technical Considerations
- **Performance:** DB lookups in middleware can be slow. Use `unstable_cache` or Redis if possible, or accept slight latency for MVP.
- **Host Header Trust:** Ensure `trust proxy` is configured if detecting IPs, though standard Host header parsing is sufficient for routing.

## 7. Success Metrics
- 100% of valid subdomain requests serve correct store content.
- 0% of invalid subdomain requests show a generic 404 (all redirect to platform).
- Manual custom domain setup takes < 5 minutes per tenant.

## 8. Open Questions
- Should we use a high-performance Edge Config (Vercel) or Redis for domain lookups to avoid hitting Postgres on every single request? *Decision: Query Postgres for MVP, optimize later.*
