# SEO System Review — as-built audit + two-tier upgrade plan

**Date:** 2026-08-13 · **Scope:** `nextjs_space/` SEO Manager, storefront metadata, sitemaps/robots, structured data, plan-gating readiness. Paths relative to `nextjs_space/`.
**Context:** basic plan ($99) keeps SEO; pro plan ($169) gets advanced features. Plans carried by Clerk — no payment code in scope (PRD-303 remains the full billing spec, 0% implemented).

---

## 1. As-built (verified)

### What exists and works
- **SEO Manager admin** (`app/tenant-admin/seo/`, `components/admin/seo/`): tenant-scoped, impersonation-aware CRUD for `{title, description, ogImage}` across products, posts, and 4 static page keys (`home/about/contact/faq`), with a char-count Google preview. API routes are well built (Zod, `parseUuid`, ownership checks) — `app/api/tenant-admin/seo/{pages,products/[id],posts/[id]}`.
- **Per-tenant `sitemap.xml` + `robots.txt`** (`app/store/[slug]/{sitemap.xml,robots.txt}/route.ts`) — custom-domain aware via `getTenantBaseUrl`, reachable on custom domains through the middleware rewrite.
- **Exactly one consumer:** the store homepage (`app/store/[slug]/page.tsx:358-418`) renders `pageSeo.home` with full OG/Twitter/canonical (canonical correctly prefers customDomain).
- Storage: untyped `Json?` blobs — `products.seo`, `posts.seo`, `conditions.seo`, `tenants.pageSeo` (+ platform_settings equivalents).

### What's broken (the feature is mostly write-only)
1. 🔴 **Every non-homepage tenant page titles itself "BudStacks - Medical Cannabis SaaS Platform"** — `app/store/[slug]/layout.tsx` exports no metadata, so products list/detail, The Wire, about, contact, conditions, support all fall back to `app/layout.tsx:33`. The single largest indexed-quality defect.
2. 🔴 **`posts.seo`, `products.seo`, `conditions.seo` are read by nothing.** Post pages ignore `post.seo` entirely (`the-wire/[postSlug]/page.tsx:27-33`); product detail is a client component with no `generateMetadata`; conditions has no UI tab, no route, no metadata. Three of four static page keys (`about/contact/faq`) are never consumed — `faq` even redirects to `/support`.
3. 🔴 **Every product URL in the sitemap 404s** — sitemap emits `/products/{slug}` (`sitemap.xml/route.ts:49`) but real product routes are by Dr Green **id** (`product-card.tsx:59`). The SEO Manager's preview URL (`seo-page-client.tsx:204`) has the same bug. Sitemap also ignores `deletedAt` (soft-deleted products submitted for indexing) and emits no `lastmod`.
4. 🔴 **`www.*` hosts black-hole to the BudStacks platform page** (`lib/parse-host.ts:36`, locked in by tests) — and the super-admin domain UI *recommends* www as a workaround (`tenant-edit-form.tsx:407-409`). Known workspace issue, now confirmed as an active SEO defect.
5. **Zero JSON-LD** anywhere (grep-verified) — despite `prd-seo-manager.md:76` promising auto Product schema. The data for `Product`, `LocalBusiness` (tenants.business* address columns), `FAQPage` (`conditions.faqs`), and `Article` schema is already in the DB, unused.
6. **Canonicals exist only on the homepage** — every other subdomain page is unmitigated duplicate content against its custom-domain twin. No `metadataBase` anywhere (relative OG URLs would break). No redirects infrastructure at all; post-slug changes orphan old URLs silently.
7. **Per-tenant favicon stored but never rendered** (`tenant_branding.faviconUrl` written at `branding/route.ts:394`; every store serves platform `/favicon.svg`). No manifest, no apple-touch-icon.
8. **OG images:** manual URL entry only; upload button shipped disabled (`SeoEditorModal.tsx:149`). No `ImageResponse`/`opengraph-image` generation.
9. **Alt text:** auto-derived everywhere; `product_images.altText` column exists with no editor; post cover has no alt field.
10. **No platform sitemap/robots** for budstacks.io itself. **No SEO tests** of any kind. `seo/pages` PUT is a read-modify-write of the whole blob (last-write-wins race). SEO nav item is permission-ungated (`nav-permissions.ts:15`).

### Plan infrastructure: none
No `plan`/`subscription`/billing code or columns exist (PRD-303 is spec-only). Clerk metadata carries `role`/`tenantId`/`nftTokenId`/`countryCode` — the natural carrier for a plan claim. Reusable gate mechanics: `require-page-permission.ts`, `nav-permissions.ts`, PRD-301 permission plumbing.

### Adjacent facts that shape the plan
- Analytics page is 100% commerce — no traffic/impression/ranking data exists (pro-tier SEO analytics is genuinely net-new; GSC OAuth has external dependencies → out of scope here).
- Automatos AI integration exists per-tenant (`tenants.automatosApiKey/automatosAgentId`) as a chat widget — the obvious credential set for AI SEO assist, pending an API-shape spike.
- The email run's durable public image route (`/api/public/images/...`) directly serves OG upload/generation storage.

---

## 2. Proposed tier split

**Principle: basic must actually work before pro can supercharge.** Workstream A fixes ship to *everyone* (they're correctness, and they're the credibility of the $99 tier). Pro features are additive and individually gated.

### Basic — $99 (today's promise, made real)
Meta fields for home/pages/products/posts/conditions **that actually render**; correct sitemaps (real URLs, soft-delete filtered, lastmod); robots; canonicals on every page; per-tenant favicon; `metadataBase`; alt-text authoring; www fixed.

### Pro — $169 ("supercharged", each gated on `seoPro`)
1. **Auto JSON-LD**: `Product` (price/availability/THC-CBD as additionalProperty), `Organization`/`LocalBusiness` (+PostalAddress), `Article`+`BreadcrumbList` (Wire), `FAQPage` (conditions).
2. **OG image studio**: branded auto-generated OG images (`ImageResponse`) + real upload (re-enable the button; store via the durable public-image route).
3. **Redirects manager**: tenant-scoped 301/308 table + middleware lookup + UI; automatic redirect on post-slug change.
4. **Indexing controls**: per-page noindex/nofollow, canonical override, sitemap include/exclude.
5. **SEO audit panel**: Yoast-class checks (title/desc lengths, missing metadata, missing alts, duplicate titles, sitemap health, orphaned redirects) with a score + fix-links. (Explicitly deferred by the Phase-1 PRD.)
6. **AI assist** (via tenant Automatos credentials; spike first): generate meta title/description from product/post content, alt-text suggestions. Fallback path documented if the Automatos API can't serve completions.
7. **Site verification fields**: structured `googleSiteVerification` / `bingSiteVerification` meta + GA4 measurement id — structured fields, never raw head HTML (CSP-nonce-safe by construction).

### Plan plumbing (thin, PRD-303-compatible)
`tenants.plan` (`basic|pro`, default basic) synced from Clerk org `publicMetadata.plan` when present; `resolveTenantPlan()` + `requirePlanFeature("seoPro")` server gate + client hook; locked-state upsell UI on pro cards; super-admin plan override on the tenant edit form. No Stripe, no billing — PRD-303 slots in later without rework.

---

## 3. Sequencing note

A (basic fixes) → B (plan plumbing) → C (pro features). The www fix (A) touches `parse-host.ts` + Cloudflare SaaS behavior — needs the deliberate-test unwound and the domain-UI guidance corrected with it. GSC data integration (impressions/rankings) is **out of scope** — external OAuth dependencies; follow-up PRD when wanted.
