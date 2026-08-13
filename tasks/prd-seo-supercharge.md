# PRD: SEO Supercharge — two-tier SEO (Basic $99 / Pro $169)

**Status:** Approved split · **Date:** 2026-08-13 · **Owner:** Gerard
**Source review:** `docs/SEO-SYSTEM-REVIEW.md` (2026-08-13) — read first; all file:line references verified there.
**Predecessor:** `docs/PRDS/prd-seo-manager.md` (Phase 1 — fields + sitemap, shipped ~80% write-only).

---

## 1. Introduction

Phase 1 built an SEO Manager whose data mostly renders nowhere: only the store homepage consumes it, every other tenant page titles itself "BudStacks - Medical Cannabis SaaS Platform", every sitemap product URL 404s, and zero structured data exists. This PRD (a) makes the **Basic tier ($99)** honest — everything a tenant types renders, sitemaps are correct, every page has a canonical; and (b) builds the **Pro tier ($169)** — JSON-LD, OG image studio, redirects, indexing controls, an audit/score panel, and **AI-assisted SEO powered by Automatos AI** (the cross-sell). Plans are carried by Clerk metadata with a thin gate — **no payment code** (PRD-303 remains the billing spec and slots in later unchanged).

All paths relative to `nextjs_space/`.

## 2. Goals

- Every indexed tenant page has a unique, tenant-branded title, description, and canonical URL.
- Sitemaps contain zero dead URLs and exclude soft-deleted/unpublished content.
- Pro features are individually gated on `seoPro` and flip on/off per tenant without deploys; Basic tenants see locked upsell states.
- Product/Organization/Article/FAQ JSON-LD renders from data already in the DB.
- A Pro tenant can generate meta titles/descriptions/alt text with one click via their Automatos AI credentials.
- The `www.*` black-hole stops costing tenants their primary hostname.

## 3. User Stories

Ordered by workstream. **A ships to everyone; B before C; every C story checks `seoPro`.** Each story is one focused session and one shippable commit (⚠️ this repo deploys on merge to main — every story leaves the branch shippable).

---

### Workstream A — Basic tier: make SEO real (ungated fixes)

### US-001: Store-layout metadata foundation
**Description:** As a store owner, I want every page of my store to carry my brand in search results instead of the platform's.

**Acceptance Criteria:**
- [ ] `app/store/[slug]/layout.tsx` gains `generateMetadata`: title template `%s | {businessName}` with `{businessName}` default, tenant description fallback, `metadataBase` from `getTenantBaseUrl(tenant)`
- [ ] Per-tenant favicon rendered via `icons` from `tenant_branding.faviconUrl` (stored today, rendered nowhere — platform `/favicon.svg` as fallback)
- [ ] `openGraph.siteName` = businessName at layout level
- [ ] No store page renders the platform title "BudStacks - Medical Cannabis SaaS Platform" (test asserts the layout metadata shape)
- [ ] Typecheck passes; tests pass
- [ ] Verify in browser using dev-browser skill

### US-002: Static store pages consume pageSeo
**Description:** As a store owner, my About/Contact/Support metadata edits must actually render.

**Acceptance Criteria:**
- [ ] `about`, `contact`, `support`, `conditions` (list page) get `generateMetadata` reading `tenants.pageSeo[key]` with the Phase-1 cascade (custom → sensible default → businessName)
- [ ] SEO Manager page list updated to match reality: `faq` key retired or mapped to `/support` (it currently 302s — `app/store/[slug]/faq/page.tsx:4-5`); keys and routes agree end-to-end
- [ ] Per-page canonical emitted (see US-007 helper)
- [ ] Typecheck passes; tests pass
- [ ] Verify in browser using dev-browser skill

### US-003: The Wire post metadata reads post.seo
**Description:** As a store owner, the post SEO I write must render — today it's silently discarded.

**Acceptance Criteria:**
- [ ] `app/store/[slug]/the-wire/[postSlug]/page.tsx` cascade: `post.seo.title || post.title`, `post.seo.description || post.excerpt`, `post.seo.ogImage || post.coverImage`
- [ ] `openGraph.type: "article"` with `publishedTime` (createdAt), author (post author name); twitter `summary_large_image`; canonical to the post URL on the primary host
- [ ] Wire list page gets metadata (pageSeo key or sensible default)
- [ ] Typecheck passes; tests pass
- [ ] Verify in browser using dev-browser skill

### US-004: Product detail metadata
**Description:** As a store owner, my product SEO must render on product pages — the page is a client component that emits no metadata at all.

**Acceptance Criteria:**
- [ ] `generateMetadata` added for `app/store/[slug]/products/[id]/page.tsx` (server-side fetch of the same product source the page uses — Dr Green id-keyed; keep the fetch cached/deduped per request)
- [ ] Cascade: `products.seo` (matched via local products row by `drGreenStrainId`) → product name + truncated description
- [ ] OG image from product image (absolutized); canonical to `/products/{id}` on the primary host
- [ ] SEO Manager product preview URL fixed to the real route (`seo-page-client.tsx:204` currently links `/products/{slug}` which 404s)
- [ ] Typecheck passes; tests pass
- [ ] Verify in browser using dev-browser skill

### US-005: Conditions SEO wired end-to-end
**Description:** As a store owner, condition pages are my content-marketing landing pages — they need editable, rendering SEO.

**Acceptance Criteria:**
- [ ] SEO Manager gains a Conditions tab (the `condition` entityType is already declared in `SeoEditorModal.tsx:24` but never wired); `PUT /api/tenant-admin/seo/conditions/[id]` cloned from the products route shape (`withTenantAuthParams`, ownership check)
- [ ] Condition detail page `generateMetadata` reads `conditions.seo` cascade; canonical emitted
- [ ] Typecheck passes; tests pass
- [ ] Verify in browser using dev-browser skill

### US-006: Sitemap correctness + platform sitemap
**Description:** As a search engine, every sitemap URL must resolve and reflect reality.

**Acceptance Criteria:**
- [ ] Product entries emit the real route (`/products/{id}` — today emits `/products/{slug}`, 100% dead: `app/store/[slug]/sitemap.xml/route.ts:49` vs `product-card.tsx:59`)
- [ ] `deletedAt: null` filter on products (soft-deleted currently submitted); conditions pages included; retired static entries (`faq`) removed
- [ ] `<lastmod>` from `updatedAt` on dynamic entries
- [ ] Platform-level `app/sitemap.ts` + `app/robots.ts` for budstacks.io (marketing pages + `/learn`; store hosts unaffected)
- [ ] Typecheck passes; tests pass (sitemap XML asserted: URL shape, filters, lastmod)

### US-007: Canonicals everywhere
**Description:** As a store owner with a custom domain, my `{slug}.budstacks.io` twin must not compete with my real domain in search.

**Acceptance Criteria:**
- [ ] Shared helper `storeCanonical(tenant, path)` → primary host (customDomain preferred, matching `getTenantBaseUrl`)
- [ ] Every store page's metadata emits `alternates.canonical` via the helper (home already does; all others gain it through US-001..005 + products list page)
- [ ] Unit test: canonical points at customDomain when set, subdomain otherwise, path preserved
- [ ] Typecheck passes; tests pass

### US-008: Fix the www.* black-hole
**Description:** As a tenant on a custom domain, `www.` must reach my store (or my apex), never the BudStacks platform page.

**Acceptance Criteria:**
- [ ] `www.{customDomain}` 301s to the apex custom domain (origin-side redirect in middleware, before tenant resolution); `www.{slug}.budstacks.io` 301s to `{slug}.budstacks.io`
- [ ] `lib/parse-host.ts:36` behavior updated in concert; the deliberate test at `tests/unit/parse-host.test.ts:34-37` rewritten to assert the new contract (redirect, not platform fallthrough)
- [ ] Super-admin guidance text at `tenant-edit-form.tsx:407-409` corrected (it currently recommends the broken www configuration)
- [ ] Ops note in the story journal: Cloudflare SaaS must have the www hostname provisioned for the redirect to be reachable — documented, not assumed
- [ ] Typecheck passes; tests pass

### US-009: Alt-text authoring
**Description:** As a store owner, I want to write image alt text — for accessibility and image search.

**Acceptance Criteria:**
- [ ] Product images: alt-text editor in the SEO Manager product entry (writes `product_images.altText` — column exists, no editor); product detail already renders it (`products/[id]/page.tsx:291`); product cards fall back name→altText priority corrected
- [ ] Post cover: alt field in `post-form.tsx` (stored in `posts.seo.coverAlt` or a column — pick one, document); Wire pages render it instead of `alt={post.title}`
- [ ] Typecheck passes; tests pass
- [ ] Verify in browser using dev-browser skill

### US-010: SEO route hardening
**Description:** As a platform, SEO writes need the same governance as email got in Phase 2.

**Acceptance Criteria:**
- [ ] `canViewSeo`/`canEditSeo` permission keys added and enforced on all SEO routes (`requirePermission`/`requirePermissionParams` per the PRD-301 pattern); nav gate at `nav-permissions.ts:15` (currently `undefined` = ungated); page gate via `requirePagePermission`
- [ ] `seo/pages` PUT race fixed: per-key update instead of whole-blob read-modify-write (`app/api/tenant-admin/seo/pages/route.ts:47-68` is last-write-wins today)
- [ ] Owner-admin + legacy null teamRole unaffected (assert, per US-009-email precedent)
- [ ] Typecheck passes; tests pass

---

### Workstream B — Plan plumbing (thin, Clerk-carried, PRD-303-compatible)

### US-011: Tenant plan resolution + seoPro gate
**Description:** As the platform, I need to know a tenant's plan and gate pro features on it — with zero billing code.

**Acceptance Criteria:**
- [ ] `tenants.plan` column (`basic` | `pro`, default `basic`) + hand-authored migration (never `migrate dev`)
- [ ] `resolveTenantPlan(tenant)`: Clerk org `publicMetadata.plan` claim wins when present and valid, else the column; unreadable values → `basic` (fail closed)
- [ ] `requirePlanFeature("seoPro")` server gate (composes with the permission wrappers) returning 403 with a distinct `upgrade_required` error shape; `PLAN_CONFIG` typed map compatible with PRD-303's shape (`basic: $99`, `pro: $169`)
- [ ] Unit tests: claim precedence, fail-closed parsing, gate 403 shape
- [ ] Typecheck passes; tests pass

### US-012: Super-admin plan control
**Description:** As the super admin, I set a tenant's plan until billing exists.

**Acceptance Criteria:**
- [ ] Plan selector on the super-admin tenant edit form; writes the column and best-effort syncs Clerk org `publicMetadata.plan` (sync failure surfaces a warning, column remains authoritative)
- [ ] Audit-log entry on plan change
- [ ] Typecheck passes; tests pass
- [ ] Verify in browser using dev-browser skill

### US-013: Upsell UI states
**Description:** As a Basic tenant, I should see what Pro does and how to get it — not a blank space.

**Acceptance Criteria:**
- [ ] Plan surfaced to admin UI (server-resolved prop/hook — no client-side Clerk parsing)
- [ ] Pro features in the SEO Manager render locked cards for Basic: feature name, one-line value prop, "Upgrade to Pro — $169/mo" CTA (links to a static upgrade/contact page — no checkout)
- [ ] Locked features are also server-enforced (US-011 gate) — UI lock is presentation, never the boundary
- [ ] Typecheck passes; tests pass
- [ ] Verify in browser using dev-browser skill

---

### Workstream C — Pro tier (every story server-gated on seoPro)

### US-014: JSON-LD engine + Organization/LocalBusiness
**Description:** As a Pro tenant, my store emits Organization + LocalBusiness structured data automatically.

**Acceptance Criteria:**
- [ ] `lib/seo/json-ld.ts`: typed builders + one renderer that serializes with `</script>`-safe escaping (`<` → `<` — injection guard asserted with a hostile fixture)
- [ ] Store home renders `Organization` + `LocalBusiness` (name, url, logo via durable public URL, `PostalAddress` from `tenants.businessAddress1..businessCountry` — only when address fields exist; partial data degrades to Organization only)
- [ ] Output validates against schema.org expectations (test: JSON parses, required fields present, no undefined leakage)
- [ ] Gated: Basic tenants render no JSON-LD (asserted)
- [ ] Typecheck passes; tests pass

### US-015: Product JSON-LD
**Description:** As a Pro tenant, product pages emit Product+Offer schema so listings get rich results.

**Acceptance Criteria:**
- [ ] Product detail renders `Product` (name, description, image absolutized, brand=businessName) + `Offer` (price, priceCurrency from tenant/currency source, availability from stock: InStock/OutOfStock)
- [ ] THC/CBD content and strain type as `additionalProperty` entries when present
- [ ] Renders only for Pro AND only when price data exists (no empty Offers)
- [ ] Typecheck passes; tests pass

### US-016: Article + BreadcrumbList JSON-LD
**Description:** As a Pro tenant, Wire posts emit Article schema and store pages emit breadcrumbs.

**Acceptance Criteria:**
- [ ] Post pages: `Article` (headline, image, datePublished/Modified, author, publisher=Organization ref)
- [ ] `BreadcrumbList` on posts, product detail, condition detail (Home → section → item, primary-host URLs)
- [ ] Typecheck passes; tests pass

### US-017: FAQPage JSON-LD from conditions
**Description:** As a Pro tenant, condition pages turn their existing FAQ content into FAQPage rich results.

**Acceptance Criteria:**
- [ ] Condition detail renders `FAQPage` from `conditions.faqs` Json (validated shape; malformed entries skipped, never break the page)
- [ ] Emitted only when ≥1 valid Q/A pair
- [ ] Typecheck passes; tests pass

### US-018: OG image studio — branded generation
**Description:** As a Pro tenant, every share gets a branded OG image even when I never uploaded one.

**Acceptance Criteria:**
- [ ] Dynamic OG route using `next/og` `ImageResponse` (1200×630): tenant logo, brand color, entity title — for home, products, posts, conditions
- [ ] Used as OG fallback in the US-001..005 metadata cascade when no explicit ogImage is set (Pro only; Basic keeps static fallbacks)
- [ ] Runtime/bundle choice documented (edge vs nodejs) and the route excluded from the middleware auth surface (public by design, tenant from host)
- [ ] Typecheck passes; tests pass
- [ ] Verify in browser using dev-browser skill (render the route directly)

### US-019: OG image studio — real upload
**Description:** As a Pro tenant, I can upload a custom OG image instead of pasting URLs.

**Acceptance Criteria:**
- [ ] The disabled upload button in `SeoEditorModal.tsx:147-157` becomes real: uploads via `/api/tenant-admin/upload`, stores the **durable public URL** (email-run route; never the presigned URL — same rule as US-014-email)
- [ ] 1200×630 guidance + client size cap; preview in the modal
- [ ] Available to Pro; Basic keeps URL-entry field
- [ ] Typecheck passes; tests pass
- [ ] Verify in browser using dev-browser skill

### US-020: Redirects manager
**Description:** As a Pro tenant, I can create 301s so moved content keeps its equity.

**Acceptance Criteria:**
- [ ] Prisma model `seo_redirects` (tenantId, fromPath unique per tenant, toPath, statusCode 301|308, createdAt; migration hand-authored); registered in tenant-scope set
- [ ] Middleware lookup on store hosts: exact-path match → redirect, before rendering; per-tenant lookup cached (in-memory TTL or single indexed query — document the choice; must not add a DB query to every request when a tenant has zero redirects)
- [ ] CRUD UI in SEO Manager (Pro tab): validation — fromPath normalized (leading slash, no query), no redirect loops (A→B→A rejected), core routes (`/api`, `/tenant-admin`, sitemap/robots) refused
- [ ] `requirePermission(canEditSeo)` + `requirePlanFeature(seoPro)` on writes
- [ ] Typecheck passes; tests pass
- [ ] Verify in browser using dev-browser skill

### US-021: Slug editing + auto-301 on change
**Description:** As a Pro tenant, renaming a post must not orphan its old URL.

**Acceptance Criteria:**
- [ ] Post slug becomes editable in `post-form.tsx` (uniqueness loop reused; slug pattern validated)
- [ ] On slug change, a `seo_redirects` row (old path → new path, 301) is written automatically (Pro); Basic slug edit warns that the old URL will 404
- [ ] Chain collapse: existing redirects pointing at the old path are re-pointed to the new one (no A→B→C chains)
- [ ] Typecheck passes; tests pass

### US-022: Indexing controls
**Description:** As a Pro tenant, I control what gets indexed — noindex, canonical overrides, sitemap exclusion.

**Acceptance Criteria:**
- [ ] `seo` Json gains optional `robots` (`noindex`/`nofollow` booleans), `canonicalOverride` (validated absolute URL), `sitemapExclude` (boolean) — Zod-extended on all SEO PUT routes
- [ ] Metadata rendering honors them (robots meta, canonical override wins over US-007 helper); sitemap skips excluded entries
- [ ] SeoEditorModal grows a Pro "Indexing" section with the three controls; Basic tenants see the locked state
- [ ] Typecheck passes; tests pass
- [ ] Verify in browser using dev-browser skill

### US-023: SEO audit panel
**Description:** As a Pro tenant, I get a Yoast-class score telling me exactly what to fix.

**Acceptance Criteria:**
- [ ] Server audit (`lib/seo/audit.ts`) checks: missing/short/long titles + descriptions per entity; missing OG images; missing alt text; duplicate titles across the store; sitemap health (entry count, dead product-URL detection); redirect loops/chains; noindex-on-indexed-page warnings
- [ ] `GET /api/tenant-admin/seo/audit` (gated view+pro), result cached ~15min per tenant; each finding carries a deep link to the screen that fixes it
- [ ] Audit tab in SEO Manager: score (weighted, documented weights), grouped findings, empty-state when clean
- [ ] Typecheck passes; tests pass
- [ ] Verify in browser using dev-browser skill

### US-024: Automatos AI assist — spike + service
**Description:** As the platform, AI SEO runs on the tenant's own Automatos AI credentials — the cross-sell is the architecture.

**Acceptance Criteria:**
- [ ] Spike documented in the story journal: what the Automatos API (per-tenant `automatosApiKey`/`automatosAgentId`, `tenants` columns) supports server-side — completion/message endpoint, auth shape, latency. Sources: `public/automatos-widget.js` wire calls + `docs/PRDS/prd-automatos-ai-integration.md`
- [ ] `lib/seo/ai-assist.ts`: provider interface + Automatos implementation; strict output contracts (title ≤60 chars, description ≤160, alt ≤120; JSON-validated, refused on contract violation — never truncate-and-ship silently)
- [ ] Tenants without Automatos credentials: feature reports `unavailable` with a "Connect Automatos AI" upsell state (the cross-sell surface) — no platform-key fallback in this PRD
- [ ] Rate-limited per tenant; inputs are the tenant's own entity content only (no cross-tenant data in prompts — asserted)
- [ ] If the spike concludes the API cannot serve completions: story BLOCKS with the finding documented, UI stories 025 gate on availability — do not improvise a different provider
- [ ] Typecheck passes; tests pass

### US-025: AI assist UI
**Description:** As a Pro tenant, one click drafts my meta title, description, or alt text — I review, I save.

**Acceptance Criteria:**
- [ ] "Generate with Automatos AI" buttons in SeoEditorModal (title + description, from entity name/description/content) and the alt-text editors
- [ ] Generated text lands in the field as a draft — never auto-saved; author edits then saves normally
- [ ] Loading/error/unavailable states (unavailable = the Connect-Automatos upsell); audit-log entry on generation
- [ ] Typecheck passes; tests pass
- [ ] Verify in browser using dev-browser skill

### US-026: Site verification + GA4 fields
**Description:** As a Pro tenant, I can verify Search Console and wire GA4 without anyone injecting raw HTML.

**Acceptance Criteria:**
- [ ] Structured tenant-settings fields: `googleSiteVerification`, `bingSiteVerification` (token charset/length validated), `ga4MeasurementId` (`G-[A-Z0-9]+` pattern) — **structured fields only, never raw head HTML**
- [ ] Verification tokens render as meta tags in the store layout; GA4 script renders CSP-nonce-safe (`middleware.ts:83-91` nonce plumbing) and only when the cookie-consent analytics flag permits (`tenant-settings.ts:111` `analyticsEnabled` integration documented)
- [ ] Pro-gated; settings UI section with the three fields
- [ ] Typecheck passes; tests pass
- [ ] Verify in browser using dev-browser skill

## 4. Functional Requirements

- FR-1: Every store page must emit tenant-branded title/description/canonical; the platform title must never appear on a tenant host (A).
- FR-2: All SEO Manager fields must render on their target pages: pageSeo (home/about/contact/support/conditions), products.seo, posts.seo, conditions.seo (A).
- FR-3: Sitemaps must contain only resolvable, live URLs with lastmod; budstacks.io gets its own sitemap/robots (A).
- FR-4: `www.*` hosts must 301 to the canonical host, never serve the platform page (A).
- FR-5: Plan resolution: Clerk claim > tenants.plan column > `basic`; unreadable → `basic`; `requirePlanFeature("seoPro")` is the single server gate for every pro feature (B).
- FR-6: Pro features must be server-enforced and UI-locked with upsell states for Basic (B/C).
- FR-7: JSON-LD must be auto-generated, `</script>`-escape-safe, and emitted only when its source data is valid and the tenant is Pro (C).
- FR-8: AI assist must run on the tenant's own Automatos credentials, produce contract-validated drafts, and never auto-save (C).
- FR-9: Redirects must be tenant-scoped, loop-free, and cost ~zero on requests for tenants without redirects (C).
- FR-10: All new SEO routes carry `canViewSeo`/`canEditSeo` permissions; write routes are rate-limited where public-adjacent (A/C).

## 5. Non-Goals (Out of Scope)

- **No payments/billing** — Clerk carries the plan claim; PRD-303 (Stripe) lands separately with zero rework to the gate.
- **No Search Console data integration** (impressions/clicks/rankings) — external OAuth app setup; follow-up PRD.
- **No Automatos chatbot work** — the chat widget cross-sell exists; this PRD only consumes Automatos for SEO generation.
- **No keyword rank tracking, no crawler**, no multi-language/hreflang, no raw custom-head HTML injection (structured fields only), no AMP.
- **No product slug routes** — product URLs stay id-based; the sitemap adapts to reality rather than the reverse.

## 6. Design Considerations

- Reuse the existing SEO Manager shell (tabs pattern, `SeoEditorModal`, `GooglePreview`); Pro additions are new tabs/sections in the same surface, locked cards from US-013 for Basic.
- Upsell cards follow the bs-* UI kit; CTA copy names the price ("Upgrade to Pro — $169/mo") and one concrete benefit per feature.
- Audit findings deep-link to the exact editor that fixes them (the email run's log-drawer pattern).

## 7. Technical Considerations

- **Repo traps (binding):** merge = deploy — every story shippable; no local `prisma migrate dev`/`db push` (hand-author migrations, boot applies); no `.env` edits; stage by name; the Docker runner lesson from email-p2 — **any new runtime import chain for scripts/ must check the runner image's COPY set** (SEO work should stay inside the Next bundle; nothing here touches the worker).
- **CSP:** all rendered scripts (JSON-LD, GA4) must work with the per-request nonce (`lib/security/csp`); JSON-LD via `<script type="application/ld+json">` with escaped serialization.
- **Metadata performance:** `generateMetadata` adds server fetches — keep them to the queries the page already makes (React `cache()`/dedupe); the Phase-1 PRD's <20ms budget stands.
- **Dr Green product source:** product metadata/JSON-LD read the same live-API-by-id source as the page; local `products` row matched by `drGreenStrainId` supplies the SEO overrides.
- **Plan gate composition:** `requirePlanFeature` wraps/composes with `requirePermission*` — permission answers "may this member", plan answers "may this tenant"; both must pass.
- **Clerk metadata writes** are best-effort with the DB column authoritative (offline/failed sync must not lock features).

## 8. Success Metrics

- 0 store pages render the platform title; 100% of store pages emit canonical (crawl of a seeded tenant in tests).
- Sitemap dead-URL rate: 0% (audit check green on a seeded store).
- Pro tenant emits valid Product/Organization/Article/FAQ JSON-LD (fixture-validated in tests; spot-check with Google Rich Results test post-deploy).
- Plan flip (basic↔pro) changes feature availability without deploy, verified in test.
- AI assist round-trip produces contract-valid drafts for a seeded product and post.

## 9. Open Questions

1. `www` redirect reachability depends on Cloudflare SaaS having www hostnames provisioned per custom domain — confirm fleet state at rollout (ops, not code).
2. Should conditions pages be Pro-gated as a "content hub" instead of Basic? (Currently Basic: they exist for all tenants today.)
3. GA4 loading vs cookie consent: block until consent (strict) or Consent-Mode default-denied (lenient)? Story assumes strict; flip if you prefer Consent Mode.
4. Automatos API contract — the US-024 spike resolves it; if unavailable server-side, does Gerard want a platform-key fallback (new decision) or hold the feature behind "Connect Automatos"? PRD assumes hold.
