# PRD: SEO & Metadata Manager

## 1. Introduction
Allow Tenants to control how their store appears in search engines (Google) and social media (Facebook, Twitter/X). This system provides granular control over Meta Titles, Descriptions, and Open Graph (OG) Images for both dynamic resources (Products, Posts) and static pages (Home, About).

## 2. Goals
- **Tenant Autonomy:** Tenants can override system defaults to target specific keywords.
- **Performance:** SEO data must load instantly (Server-Side Rendering) without slowing down page (TTFB).
- **Technical SEO:** Automatically generate distinct `sitemap.xml` and `robots.txt` files for every tenant subdomain.
- **Smart Fallbacks:** Ensure no page ever has "empty" metadata by cascading from Custom -> System -> Generic.

## 3. User Stories

### US-001: Edit Product SEO
**Description:** As a Tenant, I want to write a custom Title and Description for "Premium CBD Oil" so it clicks better than the default database name.

**Acceptance Criteria:**
- [ ] Product Editor UI adds "SEO Settings" tab.
- [ ] Fields: `Meta Title` (Input), `Meta Description` (Textarea), `OG Image` (Upload).
- [ ] Preview: Show a "Google Search Result" preview card.
- [ ] Logic: If left blank, default to `Product Name` and `Truncated Description`.

### US-002: Edit Static Page SEO (Home/About)
**Description:** As a Tenant, I want to customize the metadata for my Homepage and About page.

**Acceptance Criteria:**
- [ ] New "Pages" settings section in Tenant Dashboard.
- [ ] List editable routes: `Home`, `About`, `Contact`.
- [ ] Store data in `Tenant.settings` JSON or new `PageSeo` model.

### US-003: Dynamic Sitemap Generation
**Description:** As a Search Engine Bot (Googlebot), I need to find all the tenant's products.

**Acceptance Criteria:**
- [ ] Route `/sitemap.xml` dynamically generates XML.
- [ ] Filters products/posts by `tenantId`.
- [ ] Includes correct `https://tenant.budstack.to` or `custom.domain` URLs.
- [ ] Excludes "Unpublished" or "Draft" items.

### US-004: OG Image Upload
**Description:** As a Tenant, I want my links to look good when shared on WhatsApp/Facebook.

**Acceptance Criteria:**
- [ ] Upload wrapper uploads image to Tenant S3 bucket (`/seo/og-image.jpg`).
- [ ] Saves URL to the SEO JSON field.

## 4. Functional Requirements

### 4.1. Data Storage
**Decision:** Use **Postgres JSON Columns** instead of S3 for text metadata.
*Rationale:* SEO metadata is needed on *every* Server-Side Render (SSR). Fetching a JSON file from S3 adds 100-300ms latency per page load. Database queries are <10ms.
- **Schema Additions:**
    - `Product.seo`: `{ title?: string, description?: string, ogImage?: string }`
    - `Post.seo`: `{ title?: string, description?: string, ogImage?: string }`
    - `Condition.seo`: `{ title?: string, description?: string, ogImage?: string }`
    - `Tenant.pageSeo`: `Record<string, { title, description, ogImage }>` (for static routes).

### 4.2. Next.js Integration
- Implement `generateMetadata()` in `layout.tsx` and `page.tsx` files.
- **Cascade Logic:**
    1.  Check `model.seo.title`.
    2.  If empty, check `model.name`.
    3.  If empty, verify `Tenant.businessName`.
    4.  Final Fallback: "BudStack Store".

### 4.3. Technical SEO Routes
- `app/sitemap.ts`: Next.js special route handler. Logic:
    - Get `host`.
    - Resolve `tenant`.
    - Query `prisma.product.findMany({ where: { tenantId } })`.
    - Return XML XML Response.
- `app/robots.txt`: Allow all by default, but block `/api/` and `/admin/`.

## 5. Non-Goals
- **Keyword Analysis Tool:** We will not "score" their SEO (like Yoast) in Phase 1. Just fields.
- **Structured Data (JSON-LD) Editor:** We will auto-generate Product Schema (Price, Availability) but tenants cannot manually edit the raw JSON-LD yet.

## 6. Technical Considerations
- **OG Images:** Recommended size 1200x630.
- **Performance:** `generateMetadata` must run fast. Ensure database indexes on `slug` are present (they are).

## 7. Success Metrics
- **Indexing:** New tenant products appear in Google Search Console within 1 week.
- **Performance:** Adding SEO data adds < 20ms to server response time.
- **Usage:** >40% of tenants customize their Homepage Meta Description.

## 8. Open Questions
- **Canonical URLs:** Should we force the canonical URL to be the `customDomain` (if it exists) to prevent duplicate content issues with the `budstack.to` subdomain? *Recommendation: Yes.*
