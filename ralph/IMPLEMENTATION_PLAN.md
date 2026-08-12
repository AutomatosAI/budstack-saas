# Implementation Plan — Email System Phase 2 (ralph/email-authoring-campaigns)

Single source of truth for Ralph progress. Flip `- [ ]` → `- [x]` only on real success (never for BLOCKED).
Stories: `ralph/prd.json` · PRD: `tasks/prd-email-authoring-campaigns.md` · Review: `docs/EMAIL-SYSTEM-REVIEW.md`

## Workstream A — Foundations & fixes

- [x] US-001 Newsletter subscribers model
- [x] US-002 Public subscribe endpoint + wire the storefront stubs
- [x] US-003 Double opt-in confirmation
- [x] US-004 Unsubscribe route + suppression enforcement
- [x] US-005 Durable public image URLs
- [ ] US-006 Test-send endpoint + button
- [ ] US-007 Tenant email-log page
- [ ] US-008 Deterministic email-log linkage
- [ ] US-009 Permission enforcement on email routes

## Workstream B — Non-technical editor

- [ ] US-010 Branded email shell renderer
- [ ] US-011 Save-path render pipeline (JSON → email-safe HTML)
- [ ] US-012 EmailComposer component (TipTap simple mode)
- [ ] US-013 Merge-tag chips
- [ ] US-014 In-editor image upload
- [ ] US-015 Preview modes + test-send integration

## Workstream C — Newsletters & campaigns

- [ ] US-016 Campaign data model
- [ ] US-017 Campaign CRUD + compose UI
- [ ] US-018 Audience selection v1
- [ ] US-019 Fan-out send with rate cap
- [ ] US-020 Compliance headers + enforced footer
- [ ] US-021 Campaign scheduling
- [ ] US-022 Send blog post as newsletter
- [ ] US-023 Marketing consent capture

## Workstream D — CRM-lite

- [ ] US-024 Customer tags
- [ ] US-025 Segments as saved audiences
- [ ] US-026 Campaign results page
- [ ] US-027 Open/click tracking (per-tenant opt-in)
- [ ] US-028 Reorder-reminder automation (MVP)
