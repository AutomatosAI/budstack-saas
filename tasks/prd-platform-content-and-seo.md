# PRD: Platform content and SEO — article typography, platform Wire, budstacks.io SEO

- **Status:** Draft, not started
- **Owner:** Gerard
- **Created:** 2026-08-15
- **Predecessors:** #249 (video slots) · #251 (/documents chrome) · #253 (editorial posts + `lib/blog/posts.ts`) · #254 (platform leads, Phase 1) · #255 (`.bs-article`)
- **Related:** `tasks/prd-seo-supercharge.md` (tenant SEO — the components this reuses) · `tasks/prd-automatos-core-integration.md` (assisted-Wire drafts)

---

## 1. Introduction

BudStacks sells storefronts, content tooling and SEO to cannabis operators. Its own marketing site does none of those things for itself.

Four concrete gaps, all verified in the live tree — and for the first, against production — on 2026-08-15:

0. **Much of it is behind a login wall.** `/documents` (all 18 guide pages), `/faq`, `/dpa`, `/aup`, `/regulatory` and `POST /api/platform/leads` are missing from the `isPublicRoute` allowlist, so anonymous visitors and crawlers get a 307 to Clerk. The guide hub has never been indexable, and platform lead capture — the whole of Phase 1 — has recorded nothing since it shipped. Fixed first, in Workstream 0.


1. **Article text is unstyled.** `@tailwindcss/typography` is not installed — `tailwind.config.ts:255` loads only `tailwindcss-animate`. Every `prose-*` class in the repo is inert: preflight strips heading sizes and paragraph margins and nothing puts them back. PR #255 fixed this for the platform blog with a hand-rolled `.bs-article`. **Eight surfaces still render long-form text with no typography at all**, including `/store/[slug]/the-wire/[postSlug]` — live on every tenant storefront — and the TipTap editor, so authors cannot see formatting while writing it.

2. **Every blog post is a code deploy.** `/blog` reads a hardcoded TypeScript array. Six sample posts are duplicated across `app/blog/page.tsx:9` and `app/blog/[slug]/page.tsx:11`; PR #253 added `lib/blog/posts.ts` as a single source but only the two editorial posts live there. Publishing throttled to the deploy cadence is the reason the blog has eight posts.

3. **budstacks.io's own SEO is unmanaged.** `app/sitemap.ts` and `app/robots.ts` exist (SEO Supercharge US-006) but neither `app/blog/page.tsx` nor `app/blog/[slug]/page.tsx` exports `metadata` or `generateMetadata`, so **every blog post serves the root layout's title** — "BudStacks - Medical Cannabis SaaS Platform" — as its own. Individual posts are absent from the sitemap. Meanwhile `app/tenant-admin/seo/` ships 22 components that do exactly this job for tenants.

This PRD closes all three so marketing runs without an engineer, and does it mostly by pointing components that already work at platform-scoped data.

## 2. Goals

- Long-form text renders correctly on all eight remaining surfaces, with the tenant storefront respecting **tenant** branding rather than BudStacks branding.
- A new blog post is published from super-admin in minutes, with no deploy, no PR and no engineer.
- The eight existing posts survive the migration at their current URLs, with no 404 and no lost content.
- Every platform blog post carries its own title, description, canonical, OG image and sitemap entry.
- budstacks.io's marketing metadata is editable in super-admin, not hardcoded in `app/layout.tsx`.
- No regression to tenant Wire, tenant SEO or the storefront — the tenant paths are the proven ones being reused, not rewritten.

## 3. User Stories

### Workstream 0 — Routing (ship FIRST, alone, before anything else)

Found during PRD review and **confirmed live against budstacks.io on 2026-08-15**, not inferred from source:

```
GET  /terms                    -> 200      GET  /dpa                     -> 307 → /auth/login
GET  /privacy                  -> 200      GET  /aup                     -> 307 → /auth/login
GET  /cookies                  -> 200      GET  /regulatory              -> 307 → /auth/login
GET  /blog                     -> 200      GET  /faq                     -> 307 → /auth/login
GET  /learn                    -> 200      GET  /documents               -> 307 → /auth/login
GET  /marketplace              -> 200      GET  /documents/getting-started -> 307 → /auth/login
GET  /contact                  -> 200      POST /api/platform/leads      -> 307 → /auth/login
```

The routes exist and work. They are simply missing from `isPublicRoute` in `middleware.ts:9-56`, which lists `/terms`, `/privacy` and `/cookies` but not these seven.

Three consequences, in order of cost:

- **The entire `/documents` guide hub is invisible.** 18 illustrated guide pages carrying 16 videos (#246, #249, #251), built as top-of-funnel marketing, have never been reachable by a signed-out visitor or indexed by any crawler. The index and every guide beneath it 307. This is the largest single piece of marketing content the platform has.
- **Platform lead capture has been dead since #254 deployed.** Every homepage CTA and Operator-101 submission has hit Clerk's auth wall and recorded nothing. The whole of Phase 1 does not work in production.
- **Four of the pages this PRD styles are invisible** to anonymous visitors and crawlers. Styling `/regulatory` (US-004) while nobody can load it is wasted work.

This is the **fourth occurrence of the same class** — `/robots.txt` and `/sitemap.xml` needed it (SEO US-006), then the Automatos ingest route (fix `f59ac74`), then the legal pages and the lead endpoint, then `/documents` and `/faq` found while fixing those. Four occurrences is what makes this worth a guard rather than a one-line patch.

#### US-000: Public routes reach the public
**Description:** As an anonymous visitor or crawler, I want the public marketing pages and the lead endpoint to load, so the site's own funnel is not behind a login wall.

**Acceptance Criteria:**
- [ ] `/dpa`, `/aup`, `/regulatory`, `/faq`, `/documents`, `/documents/(.*)` and `/api/platform/leads` added to `isPublicRoute` (`middleware.ts:9-56`)
- [ ] Each verified anonymously with curl after deploy: the six page routes return 200, and `POST /api/platform/leads` with an invalid body returns a 400 validation error rather than a 307
- [ ] At least one `/documents/<guide>` sub-page verified, not just the index
- [ ] One real lead submitted end-to-end through the homepage CTA and confirmed present in `platform_leads`
- [ ] **A CI guard compares the route tree against the allowlist** — every top-level `app/*/page.tsx` must be allowlisted or explicitly named as private with a reason, and every path the platform sitemap advertises must be allowlisted. A source check, not an HTTP probe: CI never starts the app, so there is no origin to curl. Pairs with the US-005 guard as the other half of "the sweep cannot silently regress"
- [ ] Shipped as its own PR, merged and deployed before any other story in this PRD
- [ ] Separately raised (not fixed here): the Clerk redirect leaks the container's internal origin — `redirect_url=https%3A%2F%2F0.0.0.0%3A8080%2Fdpa` — so even an authenticating user lands on an unreachable URL. Config, not middleware, and out of scope for this story

---

### Workstream A — Article typography (retire the inert `prose-*`)

Eight surfaces. Seven are the straightforward swap; **US-001 is not**, for a reason worth stating up front.

`.bs-article` (`app/globals.css:1377`) is the **BudStacks brand** voice: `text-bs-fg-body`, `--bs-font-display` (Cormorant Garamond) headings, `text-bs-green-soft` links, `text-bs-green` list markers. Applying it to a tenant's blog would paint every operator's articles in BudStacks green and a serif they never chose.

**The tenant side already has the machinery for this, and it is not `globals.css`.** `components/tenant-theme-provider.tsx` injects `TENANT_SCOPED_CSS` (`:133`) — static rules scoped to `.tenant-theme-container` that consume the per-tenant variables, described in its own comment as "the bridge between 'variables are set' and 'components actually use them'". The Wire post page is inside it (`app/store/[slug]/layout.tsx:378`). That bridge is where the article rules belong: it is already the tenant design system, and its scoping means the rules cannot leak into admin or editor chrome.

Two consequences that shrink US-001 considerably:

- **Headings are already handled.** `TENANT_SCOPED_CSS` sets `font-family` and `font-size` on `h1`–`h6` inside the container from `--tenant-font-heading` and the heading scale (`:141-155`). The article rules must **not** restate them — only supply the vertical margins that preflight stripped.
- **shadcn tokens are already tenant-aware inside the container.** `applyThemeToContainer` remaps `--primary` (`:285`), `--secondary` (`:287`), `--accent` (`:289`) and `--foreground` (`:297`) to the tenant's colours. So `hsl(var(--primary))` for links and list markers *is* the tenant's brand colour — no new variable plumbing needed, and `text-muted-foreground` already on the page is already correct.

`.bs-article` also styles only `h2, h3, p, strong, em, a, ul, ol, li, blockquote, code, hr` — no rule for `h1`, `h4`–`h6`, `img`, `figure`, `table` or `pre`. Fine for hand-authored editorial, **not** fine for arbitrary TipTap output, which is what the tenant surface renders.

#### US-001: Tenant Wire article typography, on tenant branding
**Description:** As a storefront visitor, I want a tenant's blog post to be readable and to look like that tenant's brand, so the article does not render as unstyled flow wearing BudStacks colours.

**Acceptance Criteria:**
- [ ] `.tenant-article` rules added to `TENANT_SCOPED_CSS` in `components/tenant-theme-provider.tsx` — **not** to `globals.css`, and never using `bs-*` tokens
- [ ] Colours come from the shadcn tokens the provider already remaps per tenant (`hsl(var(--primary))`, `hsl(var(--foreground))`, `hsl(var(--border))`, `hsl(var(--muted-foreground))`)
- [ ] Heading `font-family` and `font-size` are **not** restated — `.tenant-theme-container h1`–`h6` already set them. Only `margin-top`/`margin-bottom` are added
- [ ] Covers every tag TipTap can emit: `p`, `strong`, `em`, `a`, `ul`, `ol`, `li`, `blockquote`, `code`, `pre`, `hr`, `img`, `table`, plus heading margins
- [ ] `img` is `max-width: 100%; height: auto` — a wide tenant image must not force horizontal page scroll
- [ ] `pre` scrolls inside itself (`overflow-x: auto`) so a long code line cannot scroll the page
- [ ] `table` is `width: 100%` inside an `overflow-x: auto` wrapper, or `display: block; overflow-x: auto` — same reason
- [ ] `app/store/[slug]/the-wire/[postSlug]/page.tsx:205` applies `.tenant-article` to the rendered-HTML container only, not the whole `<article>`
- [ ] The h1, the meta row (`:210`) and the cover image (`:222`) move **outside** the styled container, replacing the two `not-prose` escapes
- [ ] Both `not-prose` occurrences removed; no `prose*` class remains in the file
- [ ] Verify in browser using dev-browser skill, on a tenant with non-default branding — headings, lists and links pick up that tenant's colours
- [ ] Typecheck/lint passes

#### US-002: TipTap authoring view matches the published article
**Description:** As an author, I want the editor to show real formatting so I can see what I am publishing without saving and previewing.

**Acceptance Criteria:**
- [ ] `components/editor/tiptap.tsx:137` drops `prose prose-sm sm:prose lg:prose-lg xl:prose-2xl` for the article class
- [ ] Headings, lists, blockquotes and code render visibly distinct inside the editor
- [ ] Editor chrome (border, min-height, padding, focus ring) unchanged
- [ ] Verify in browser using dev-browser skill — type an h2, a bulleted list and a blockquote; each is visibly styled
- [ ] Typecheck/lint passes

#### US-003: Legal pages get real typography
**Description:** As a visitor reading the terms, I want headings and lists to be distinguishable so a long legal document is navigable.

**Acceptance Criteria:**
- [ ] `.bs-article` replaces the inert prose string in all four: `app/terms/page.tsx:362`, `app/privacy/page.tsx:323`, `app/dpa/page.tsx:294`, `app/aup/page.tsx:204`
- [ ] All four carry an identical class string today — the replacement is identical in all four
- [ ] `max-width: none` retained where the page intends full width (the current strings all carry `max-w-none`)
- [ ] Verify in browser using dev-browser skill on all four pages
- [ ] Typecheck/lint passes

#### US-004: Regulatory and Learning Center article typography
**Description:** As a visitor, I want `/regulatory` and Learning Center articles to read as articles.

**Acceptance Criteria:**
- [ ] `app/learn/[slug]/markdown-content.tsx:24` — the long prose chain replaced with `.bs-article max-w-none`
- [ ] `.bs-article` extended for the tags that renderer emits and it did not cover: `h1`, `img`, `pre`. `h4`, `figure`/`figcaption` and `table` added at the same time so the class is complete for arbitrary article HTML
- [ ] `pre` and `table` scroll inside themselves; `img` is `max-width: 100%`
- [ ] `app/regulatory/page.tsx:13` — inert classes **deleted with no replacement**. Unlike the other legal pages it does not wrap itself in `.budstacks-theme`, so it renders on the light `:root` palette and `.bs-article`'s light body colour would be grey-on-white. Every element on that page already carries explicit utility classes, so the removed chain was styling nothing it needed
- [ ] A comment on that page records why it is the exception, so the next sweep does not "fix" it
- [ ] Verify in browser using dev-browser skill on `/regulatory` and one `/learn/[slug]`
- [ ] Typecheck/lint passes

#### US-005: A guard so `prose-*` cannot come back
**Description:** As a developer, I want a check that fails when someone adds a `prose-*` class, so an inert class never ships again while the plugin is absent.

**Acceptance Criteria:**
- [ ] A CI check fails on any new `prose-`, `prose "`, or `not-prose` occurrence under `app/`, `components/` and `lib/`
- [ ] The failure message names the file and says to use `.bs-article` or `.tenant-article`
- [ ] Passes cleanly on the tree once US-001 to US-004 have landed
- [ ] If `@tailwindcss/typography` is ever intentionally installed, the guard is the one place to remove — documented in a comment

---

### Workstream B — Platform Wire (Phase 2): blog out of code

Reuse targets, all proven in production: `posts` model (`prisma/schema.prisma:680`), `app/tenant-admin/the-wire/post-form.tsx` (473 lines), `posts-list.tsx` (224), `app/api/tenant-admin/posts/route.ts` (132) and `[id]/route.ts` (263).

#### US-006: `platform_posts` model, SQL applied before any code
**Description:** As a developer, I need platform blog posts stored in the database so publishing stops being a deploy.

**Acceptance Criteria:**
- [ ] `platform_posts` added to `prisma/schema.prisma`: `id`, `slug` (`@unique`), `title`, `excerpt`, `content`, `coverImage`, `coverImageAlt`, `authorName`, `authorRole`, `published` (default `false`), `publishedAt`, `seo Json?`, `createdAt`, `updatedAt`
- [ ] **Author is denormalised strings, not a `users` FK** — `users` is tenant-scoped (`lib/db.ts:73`), so an FK join would hit tenant scoping on the apex where no tenant context exists. It also sidesteps the Clerk-id-vs-`users.id` P2003 class that broke the lekkerweed blog (PR #226). `learning_resources` sets the same precedent by carrying no author relation at all
- [ ] Indexes on `[published, publishedAt]` and `[slug]`
- [ ] **`platform_posts` is NOT added to `tenantScopedModels` (`lib/db.ts:49`)** — that Set is opt-in, so a platform model is unscoped by default. Adding it would break every apex query
- [ ] Hand-written `.sql` in `prisma/migrations/` — the build runs `prisma generate` only, there is no `prisma migrate` step
- [ ] **The SQL is applied to Railway prod and verified in psql BEFORE the code that queries it deploys**, or every `/blog` request 500s
- [ ] `prisma generate` succeeds; typecheck passes

#### US-007: Platform posts write API
**Description:** As a super-admin, I need endpoints to create, edit, publish and delete platform posts.

**Acceptance Criteria:**
- [ ] `POST`/`GET` at `app/api/platform/posts/route.ts`; `GET`/`PATCH`/`DELETE` at `app/api/platform/posts/[id]/route.ts`
- [ ] Every route is super-admin only and returns 403 to a tenant admin, using **`withSuperAdmin` / `withSuperAdminParams` from `lib/api-auth.ts:150`**
- [ ] ⚠️ **Do NOT model these on `app/api/platform/leads`.** It is the only existing route under `app/api/platform/` and it is deliberately **unauthenticated** — its own header reads "Unauthenticated and platform-level — there is no tenant here by design", because a prospect filling in the homepage CTA has no account. Copying its shape would ship an unauthenticated write API for platform blog content. These will be the first `/api/platform/*` routes to use `withSuperAdmin`
- [ ] Zod validation on all input
- [ ] `content` sanitised on write. The tenant Wire's `cleanContent` is a **local `const` inside the page component** (`app/store/[slug]/the-wire/[postSlug]/page.tsx:164`), not an importable helper — **extract it to `lib/` first and call it from both** the Wire page and these routes, so the two paths cannot drift
- [ ] Slug validated against **`POST_SLUG_PATTERN`** and `POST_SLUG_MAX_LENGTH` (`lib/seo/post-slug.ts`). Note the tenant routes do **not** enforce the pattern server-side — they apply `normalizePostSlug` and a max length only, leaving the regex to the client form and tests. **Enforce the regex server-side here**, and treat the tenant-side gap as known debt rather than the example to follow
- [ ] Duplicate slug returns a 409 with a usable message, not a Prisma error
- [ ] Setting `published: true` stamps `publishedAt` once and does not overwrite it on later edits
- [ ] Row types declared explicitly on every query — the any-widened Prisma client throws TS7006 on implicit-`any` map callbacks
- [ ] Typecheck/lint passes

#### US-008: Super-admin Wire list
**Description:** As a super-admin, I want a list of platform posts with their status so I can see what is published.

**Acceptance Criteria:**
- [ ] `/super-admin/the-wire` lists posts: title, slug, author, published state, `publishedAt`
- [ ] Adapted from `app/tenant-admin/the-wire/posts-list.tsx`, pointed at the platform endpoints
- [ ] Publish/unpublish toggle and delete, both with confirmation
- [ ] "New post" links to the editor
- [ ] Nav entry added to `components/admin/SuperAdminSidebar.tsx`, alongside Leads (`:58`)
- [ ] Empty state before any post exists
- [ ] Verify in browser using dev-browser skill
- [ ] Typecheck/lint passes

#### US-009: Super-admin post editor
**Description:** As a super-admin, I want to write and edit a post in the browser, so publishing needs no PR.

**Acceptance Criteria:**
- [ ] `/super-admin/the-wire/new` and `/super-admin/the-wire/[id]`
- [ ] Adapted from `app/tenant-admin/the-wire/post-form.tsx` — TipTap body, title, slug, excerpt, cover image + alt, published toggle
- [ ] **A new `POST /api/platform/upload` route, guarded by `withSuperAdmin`, reusing the existing S3 client.** The tenant form posts to `/api/tenant-admin/upload` (`post-form.tsx:89`), which is `withTenantAuth` and derives `tenantId` from the authenticated user — a super-admin has no tenant, so that route either rejects the upload or stamps it against the wrong tenant. Do not reuse it
- [ ] The tenant form's SEO-Pro entitlement gating (`post-form.tsx:52-78`) and `AiAssistButton` (`:384`) are **removed** — entitlements are a tenant concept and the platform is not on a plan
- [ ] Slug auto-derives from the title on create and is editable; editing an existing slug warns that the old URL will break (auto-301 is US-020)
- [ ] Verify in browser using dev-browser skill — create, save as draft, publish, edit, confirm it appears on `/blog`
- [ ] Typecheck/lint passes

#### US-010: `/blog` index reads the database
**Description:** As a visitor, I want the blog index to list published posts from the database.

**Acceptance Criteria:**
- [ ] `app/blog/page.tsx` queries `platform_posts` where `published: true`, newest `publishedAt` first
- [ ] Card layout, spacing and styling unchanged from the current page
- [ ] `export const dynamic = "force-dynamic"` — at build time `DATABASE_URL` is a dummy and the mock client in `lib/db.ts` returns `[]`, which would bake an empty blog into the static output (the same reason `app/sitemap.ts` sets it)
- [ ] A database error renders an empty state, never a 500
- [ ] Explicit row type on the query result
- [ ] Verify in browser using dev-browser skill
- [ ] Typecheck/lint passes

#### US-011: `/blog/[slug]` reads the database, with its own metadata
**Description:** As a visitor and as a crawler, I want a post page served from the database that carries that post's own title and description.

**Acceptance Criteria:**
- [ ] `app/blog/[slug]/page.tsx` loads one post by slug; unpublished or missing returns `notFound()`
- [ ] `generateMetadata` exports per-post title, description (from `excerpt`), canonical URL from `platformBaseUrl()`, and OG image from `coverImage` — **this page has no metadata export at all today**, so every post currently serves the root layout's title
- [ ] Body renders through `.bs-article` (from #255) with the content sanitised
- [ ] Related-posts block preserved, now sourced from the database
- [ ] `generateStaticParams` (`:344`) removed or reconciled with `force-dynamic`
- [ ] Verify in browser using dev-browser skill; confirm `<title>` and `og:image` differ per post via page source
- [ ] Typecheck/lint passes

#### US-012: Migrate the eight existing posts
**Description:** As a visitor following an existing link, I want every current post to keep working at its current URL.

**Acceptance Criteria:**
- [ ] All 8 posts inserted into `platform_posts` — 2 from `lib/blog/posts.ts` plus the 6 `samplePosts`
- [ ] **Slugs identical to today's** — no existing `/blog/[slug]` URL changes
- [ ] `published: true`; `publishedAt` set from each post's existing `date` string
- [ ] `author` / `role` map to `authorName` / `authorRole`
- [ ] Applied as SQL, verified by row count and by loading each of the 8 URLs
- [ ] Runs before US-013 removes the arrays — content must exist in the database before the code that held it is deleted

#### US-013: Delete the inline post arrays
**Description:** As a developer, I want one source of truth for blog content so the drift that produced 6-vs-8 entries cannot recur.

**Acceptance Criteria:**
- [ ] `samplePosts` removed from `app/blog/page.tsx:9` and `app/blog/[slug]/page.tsx:11`
- [ ] `lib/blog/posts.ts` deleted, and its imports with it
- [ ] `grep -rn "samplePosts\|BLOG_POSTS"` returns nothing
- [ ] All 8 post URLs plus `/blog` still render, verified after removal
- [ ] Typecheck/lint passes

---

### Workstream C — Platform SEO (Phase 3): budstacks.io manages its own

Reuse targets: `components/admin/seo/` (22 files) and `app/tenant-admin/seo/seo-page-client.tsx` (796 lines).

#### US-014: `platform_seo_settings` + super-admin SEO page
**Description:** As a super-admin, I want to edit budstacks.io's own metadata without touching code.

**Acceptance Criteria:**
- [ ] Model keyed by marketing route (`/`, `/marketplace`, `/learn`, `/blog`, `/contact`) holding title, description, OG image, `noindex`
- [ ] SQL applied to prod before the reading code deploys
- [ ] `/super-admin/seo` page reusing `SeoEditorModal` and `GooglePreview` from `components/admin/seo/`
- [ ] Not added to `tenantScopedModels`
- [ ] Explicit row types
- [ ] Verify in browser using dev-browser skill
- [ ] Typecheck/lint passes

#### US-015: Marketing pages consume the settings
**Description:** As a crawler, I want each marketing page to serve its own configured title and description.

**Acceptance Criteria:**
- [ ] Each route's `generateMetadata` reads `platform_seo_settings`, falling back to the current hardcoded values in `app/layout.tsx:32` when no row exists
- [ ] The hardcoded strings remain as the documented fallback — an empty table must not blank the site's metadata
- [ ] `noindex` emits a real robots meta tag
- [ ] Verify via page source that an edit in super-admin changes the served `<title>`
- [ ] Typecheck/lint passes

#### US-016: Blog posts enter the sitemap
**Description:** As a crawler, I want to discover every published post from the sitemap.

**Acceptance Criteria:**
- [ ] `app/sitemap.ts` enumerates published `platform_posts`, mirroring the existing `learning_resources` block
- [ ] `lastModified` from `updatedAt`; priority 0.6
- [ ] Wrapped in the same try/catch — a sitemap that 500s teaches a crawler the whole site is broken
- [ ] Unpublished posts absent
- [ ] Verify `/sitemap.xml` lists all 8 post URLs

#### US-017: Canonicals across platform marketing routes
**Description:** As a crawler, I want one canonical URL per page so apex and `www` do not compete.

**Acceptance Criteria:**
- [ ] Every marketing route emits `<link rel="canonical">` from `platformBaseUrl()`
- [ ] Blog posts canonical to `/blog/{slug}`
- [ ] Cross-check against the `www.*` handling noted in the SEO Supercharge PRD before choosing the canonical host
- [ ] Verify in page source on three routes

#### US-018: Article and BreadcrumbList JSON-LD for the platform blog
**Description:** As a crawler, I want structured data on platform posts, the same as tenant posts get.

**Acceptance Criteria:**
- [ ] Reuses the tenant JSON-LD engine (SEO Supercharge US-016) rather than a second implementation
- [ ] `Article` carries headline, image, `datePublished`, `dateModified`, author, publisher
- [ ] `BreadcrumbList`: Home → Blog → post
- [ ] Validates clean in Google's Rich Results Test
- [ ] Typecheck/lint passes

#### US-019: Platform SEO audit panel
**Description:** As a super-admin, I want the audit we sell to tenants pointed at our own site.

**Acceptance Criteria:**
- [ ] `SeoAuditTab` reused on `/super-admin/seo` against platform routes
- [ ] Flags missing titles, missing descriptions, missing OG images, absent canonicals
- [ ] Verify in browser using dev-browser skill
- [ ] Typecheck/lint passes

#### US-020: Slug changes issue a 301
**Description:** As a visitor with an old link, I want a changed post slug to redirect rather than 404.

**Acceptance Criteria:**
- [ ] Editing a published post's slug writes a redirect from old to new
- [ ] Reuses the tenant redirects mechanism (`seo_redirects`, SEO Supercharge US-021) with platform scope
- [ ] Old URL returns 301 to the new one
- [ ] Redirect chains collapse rather than nest

---

### Workstream D — Content

#### US-021: Rewrite or retire the six legacy sample posts
**Description:** As a visitor, I want every published post to be real editorial, not placeholder text.

**Acceptance Criteria:**
- [ ] Each of the 6 is either rewritten to publishable quality or unpublished (`published: false`, not deleted — the URL history stays intact)
- [ ] Rewrites follow the framing rules in §6: no revenue promises, no "passive income"
- [ ] Each rewritten post has a real excerpt, cover image and alt text
- [ ] Decision recorded per post so the reasoning survives

## 4. Functional Requirements

- **FR-1:** No `prose-*` class remains in `app/`, `components/` or `lib/`; a CI check enforces this.
- **FR-2:** Tenant storefront articles are styled from `--tenant-*` variables; platform articles from `bs-*`. Neither borrows the other's tokens.
- **FR-3:** Platform blog content is stored in `platform_posts` and edited only through super-admin.
- **FR-4:** Publishing or editing a post requires no deploy and takes effect on the next request.
- **FR-5:** All 8 existing posts retain their current URLs.
- **FR-6:** Every published post emits its own title, description, canonical, OG image and sitemap entry.
- **FR-7:** Every platform write endpoint is super-admin only and 403s a tenant admin.
- **FR-8:** All post HTML is sanitised on write, using the sanitiser already applied on the tenant read path.
- **FR-9:** No platform model is added to `tenantScopedModels`.
- **FR-10:** Every schema change is applied as SQL to prod and verified before the code that reads it deploys.
- **FR-11:** Every public page and unauthenticated endpoint is present in `isPublicRoute`, and CI proves it by fetching them logged-out.

## 5. Non-Goals (Out of Scope)

- Installing `@tailwindcss/typography` — deliberately avoided; the hand-rolled classes stay in the `bs-*`/`--tenant-*` systems with no new dependency.
- Restyling tenant storefronts beyond the article body.
- Migrating Learning Center content into `platform_posts` — `learning_resources` stays as it is.
- Categories, tags, scheduled publishing, drafts-with-preview-links, or multi-author workflow on the platform blog. Publish/unpublish only.
- Comments, reactions or any social feature.
- Changing tenant Wire behaviour or the tenant SEO Manager — they are reuse sources, not targets.
- Automatos assisted-Wire drafting for platform posts — that is `prd-automatos-core-integration.md`.
- Paid distribution or ad tooling. Paid cannabis advertising is banned on the major networks; distribution stays organic per the GTM playbook.

## 6. Design Considerations

- **Two article voices, deliberately.** `.bs-article` is BudStacks-branded and belongs on `budstacks.io`, `/learn`, `/documents` and the legal pages. `.tenant-article` lives in `TENANT_SCOPED_CSS` and derives from the tenant-remapped shadcn tokens, so an operator's blog looks like their store. Mixing them is the failure mode this workstream exists to prevent.
- **Extend the existing bridge, do not build a second one.** `TENANT_SCOPED_CSS` is already the declared seam between tenant variables and rendered components. A parallel tenant-styling mechanism in `globals.css` would be a second place to look when a tenant's blog renders wrong.
- **`.bs-article`'s `max-width: 68ch`** is a text-column constraint. It must wrap only the prose, never a cover image or a page header — this is precisely why the Wire swap needs a DOM change rather than a class swap.
- **Editorial framing rules,** carried forward from PR #253 and unchanged: frame the economics, never "passive income"; no revenue promises anywhere; a passive-income claim contradicts the guides and is the highest-risk framing for cannabis plus earnings.
- Super-admin Wire and SEO pages follow the existing super-admin chrome; the sidebar is the only nav change.

## 7. Technical Considerations

**Traps that have already cost time in this repo — treat each as a hard constraint:**

- **Migrations are loose `.sql` files.** `postinstall` runs `prisma generate` only; there is no `prisma migrate` in the build. Schema changes are hand-applied, and **the SQL must land in prod before the code that queries it deploys** or every affected request 500s.
- **TS7006 on the any-widened Prisma client.** `findMany`/`groupBy` results make map callbacks implicit `any`. Declare row types explicitly on every new query. This recurs on every new query page.
- **Clerk id ≠ `users.id`.** `getCurrentUser().id` returns the Clerk id; using it as a UUID FK throws P2003. This broke the lekkerweed blog (PR #226). US-006 avoids the class entirely with denormalised author strings.
- **`tenantScopedModels` is opt-in** (`lib/db.ts:49`). Platform models must stay out of it. Note `users` and `posts` are both in it — which is why platform posts are a separate table rather than tenant `posts` with a null `tenantId`.
- **`force-dynamic` on anything reading the database at request time.** At build time `DATABASE_URL` is a dummy and the mock client returns `[]`; without it an empty blog is baked into the static output.
- **Middleware routing.** `/sitemap.xml` and `/robots.txt` reach the apex handlers only because they are in the `isPublicRoute` allowlist (`middleware.ts:8-46`); tenant hosts are rewritten to the store handlers first. Any new public platform route needs the same treatment.
- **PRs merge before CI finishes** on this repo, and `main` auto-deploys. A TypeScript error is a failed deploy. Merging while work is in flight stranded commits twice on 2026-08-15 — land stories in dependency order.

- **`isPublicRoute` is an allowlist, and forgetting it is a repeat failure.** Any new public page or unauthenticated endpoint must be added to `middleware.ts:9-56` or it answers anonymous traffic with a Clerk redirect. This has now bitten three times (robots/sitemap, the Automatos ingest route, and the four routes in US-000). The CI probe in US-000 exists to make the fourth time impossible.

**Dependency order:** **US-000 ships first, alone, before everything** — it is a live prod defect and it makes US-004's work observable. Then A (independent). B is strictly ordered US-006 → 007 → 008/009 → 010/011 → 012 → 013. C depends on B for anything touching posts (US-016, US-018, US-020); US-014/015/017/019 do not. D depends on B.

## 8. Success Metrics

- All 18 `/documents` guides, `/faq` and the three legal pages reachable logged-out and eligible for indexing; leads recording again after having silently recorded nothing since #254 deployed.
- Zero `prose-*` occurrences in `app/`, `components/`, `lib/`; CI enforces it.
- A new post goes from blank to live in under 10 minutes with no engineer and no deploy.
- All 8 existing post URLs return 200 after migration; zero 404s.
- 100% of published posts have a unique `<title>`, a description, a canonical and a sitemap entry — currently 0%.
- Publishing cadence is limited by writing, not by deploys.
- No increase in tenant storefront error rate across the Workstream A rollout.

## 9. Resolved Questions

Closed during PRD review on 2026-08-15, each verified against the tree or prod rather than assumed.

1. **`.tenant-article` scope — RESOLVED: tenant variables.** Built on `--tenant-color-*` with fallbacks to the tenant-remapped shadcn tokens, following the `.legal-document` precedent (`app/globals.css:1582`). Not `.bs-article`, which would put BudStacks green on every operator's blog.
2. **Legacy posts during migration — RESOLVED: stay published as-is.** Live URLs outrank placeholder prose; US-021 rewrites them afterwards. This is what US-012 already specifies.
3. **Canonical host — RESOLVED: apex.** The `www` → apex 301 shipped in SEO US-008 and is live in `middleware.ts` (the `wwwRedirectHost` branch). The remaining `www` issue is Cloudflare-for-SaaS provisioning per domain — an ops item, not a code question. US-017 canonicalises to the apex.
4. **OG images — RESOLVED: one platform default for launch.** Per-route upload is a later addition; US-014 ships a single default.
5. **Ralph or hand-built — RESOLVED, split.** US-000 is hand-landed today. The Workstream A remainder and the mechanical stories in B and C are Ralph-able **once US-007's auth reference is the corrected one**. The prod-SQL-before-deploy steps (US-006, US-014) and all of Workstream D stay human.
6. **Sequencing against the SEO Supercharge run — RESOLVED: nothing in flight.** Both runs completed and merged (#242, hotfix #243, #244 GEO, live-verified 2026-08-14). `seo_redirects` exists (`prisma/schema.prisma:267`) and the JSON-LD engine exists (`lib/seo/article-json-ld.ts`, `lib/seo/breadcrumb-json-ld.ts`) already wired into the tenant Wire page. **US-016, US-018 and US-020 are pure reuse** — the earlier concern about building them from scratch was unfounded.

### Still open

- **Authoring fidelity (US-002).** The editor now wears `.bs-article` while tenant posts publish under `.tenant-article`, so "the authoring view matches the published article" holds for **platform** posts and only structurally for tenant posts — a tenant author sees correct heading rhythm, lists and quotes, but BudStacks' colours rather than their own. Accepted for v1; revisit if operators find it confusing. Recorded here so it is a decision rather than a discovery.

## 10. Review log

**2026-08-15 — independent review against the live tree and prod.** Four findings accepted and folded in above: US-000 added (middleware), US-007's auth reference corrected, US-009's upload gap closed, and six open questions resolved.

Acting on finding 1 turned up **two more routes the review had not reached**: `/faq` and — more costly — `/documents` and every guide beneath it, so US-000 covers seven entries rather than four. Enumerating `app/*/page.tsx` against the allowlist, rather than checking only the routes already suspected, is what surfaced them; that enumeration is now the CI guard.

Two corrections to the review itself, verified with `git show origin/main`:

- **US-001 and US-002 are NOT already shipped.** The review reported `.tenant-article` at `tenant-theme-provider.tsx:257-360` and `bs-article` at `tiptap.tsx:147` as present at HEAD. `origin/main` (`4e65686`) contains **zero** occurrences of `tenant-article`, and still carries `prose prose-lg mx-auto dark:prose-invert` at `the-wire/[postSlug]/page.tsx:205`, `not-prose` at `:210` and `:222`, and the full prose chain at `tiptap.tsx:137`. That work exists only in the uncommitted branch `feat/article-typography`; the review read the working tree and attributed it to HEAD. Workstream A does **not** shrink — US-001 and US-002 are written but unmerged and unverified.
- **US-005's guard does not trip on the `not-prose` comment.** The implemented check strips block and line comments before matching, precisely because this codebase writes block comments without leading asterisks. All seven surviving `prose` mentions were traced individually and are stripped. The concern applied to a naive grep, not to `scripts/ci/check-no-inert-prose-classes.mjs`.
