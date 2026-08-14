# Implementation Plan — SEO Supercharge (ralph/seo-supercharge)

Single source of truth for Ralph progress. Flip `- [ ]` → `- [x]` only on real success (never for BLOCKED).
Stories: `ralph/prd.json` · PRD: `tasks/prd-seo-supercharge.md` · Review: `docs/SEO-SYSTEM-REVIEW.md`

## Workstream A — Basic tier: make SEO real (ungated)

- [x] US-001 Store-layout metadata foundation
- [x] US-002 Static store pages consume pageSeo
- [x] US-003 The Wire post metadata reads post.seo
- [x] US-004 Product detail metadata
- [x] US-005 Conditions SEO wired end-to-end
- [x] US-006 Sitemap correctness + platform sitemap
- [x] US-007 Canonicals everywhere
- [x] US-008 Fix the www.* black-hole
- [x] US-009 Alt-text authoring
- [x] US-010 SEO route hardening

## Workstream B — Plan plumbing (thin, Clerk-carried)

- [x] US-011 Tenant plan resolution + seoPro gate
- [ ] US-012 Super-admin plan control
- [ ] US-013 Upsell UI states

## Workstream C — Pro tier (every story gated seoPro)

- [ ] US-014 JSON-LD engine + Organization/LocalBusiness
- [ ] US-015 Product JSON-LD
- [ ] US-016 Article + BreadcrumbList JSON-LD
- [ ] US-017 FAQPage JSON-LD from conditions
- [ ] US-018 OG image studio — branded generation
- [ ] US-019 OG image studio — real upload
- [ ] US-020 Redirects manager
- [ ] US-021 Slug editing + auto-301 on change
- [ ] US-022 Indexing controls
- [ ] US-023 SEO audit panel
- [ ] US-024 Automatos AI assist — spike + service
- [ ] US-025 AI assist UI
- [ ] US-026 Site verification + GA4 fields
