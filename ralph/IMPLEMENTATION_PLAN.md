# Implementation Plan — Platform content and SEO (ralph/platform-content-seo)

Single source of truth for Ralph progress. Flip `- [ ]` → `- [x]` only on real success (never for BLOCKED).
Stories: `ralph/prd.json` · PRD: `tasks/prd-platform-content-and-seo.md`

**Workstream A — verification (the sweep is built, nobody has looked at it)**
- [x] US-001 Verify the article typography sweep in a browser

**Workstream B — platform Wire: the blog out of code**
- [x] US-002 platform_posts model and migration
- [x] US-003 Extract the Wire HTML sanitiser to lib/
- [x] US-004 Platform posts write API
- [x] US-005 Platform image upload route
- [x] US-006 Super-admin Wire list page
- [x] US-007 Super-admin post editor
- [x] US-008 /blog index reads the database
- [ ] US-009 /blog/[slug] reads the database, with its own metadata
- [ ] US-010 Migrate the two editorial posts
- [ ] US-011 Migrate the six sample posts
- [ ] US-012 Delete the inline post arrays

**Workstream C — platform SEO: budstacks.io manages its own**
- [ ] US-013 platform_seo_settings model and migration
- [ ] US-014 Super-admin platform SEO page
- [ ] US-015 Marketing pages consume the SEO settings
- [ ] US-016 Blog posts enter the platform sitemap
- [ ] US-017 Canonicals across platform marketing routes
- [ ] US-018 Article and BreadcrumbList JSON-LD
- [ ] US-019 Slug changes issue a 301
- [ ] US-020 Platform SEO audit panel

---

## Not in this run

**Workstream D — the six legacy sample posts** are placeholder prose and need rewriting or retiring. That is editorial judgement against framing rules Gerard set (frame the economics, never "passive income"; no revenue promises anywhere), and it is not Ralph's work. US-011 migrates them as-is so their URLs stay live; a human rewrites them afterwards.

## Human gates

- **US-001 is BLOCKED until `feat/article-typography` is merged.** The story checks for `.tenant-article` in `components/tenant-theme-provider.tsx` and aborts if absent.
- **Nothing here reaches production without a human.** Ralph never pushes and never merges; every story lands as a local commit on `ralph/platform-content-seo` for review.
