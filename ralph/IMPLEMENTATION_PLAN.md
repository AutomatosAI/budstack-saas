# Implementation Plan — Email System Phase 2 (ralph/email-authoring-campaigns)

Single source of truth for Ralph progress. Flip `- [ ]` → `- [x]` only on real success (never for BLOCKED).
Stories: `ralph/prd.json` · PRD: `tasks/prd-email-authoring-campaigns.md` · Review: `docs/EMAIL-SYSTEM-REVIEW.md`

## Workstream A — Foundations & fixes

- [x] US-001 Newsletter subscribers model
- [x] US-002 Public subscribe endpoint + wire the storefront stubs
- [x] US-003 Double opt-in confirmation
- [x] US-004 Unsubscribe route + suppression enforcement
- [x] US-005 Durable public image URLs
- [x] US-006 Test-send endpoint + button
- [x] US-007 Tenant email-log page
- [x] US-008 Deterministic email-log linkage
- [x] US-009 Permission enforcement on email routes

## Workstream B — Non-technical editor

- [x] US-010 Branded email shell renderer
- [x] US-011 Save-path render pipeline (JSON → email-safe HTML)
- [x] US-012 EmailComposer component (TipTap simple mode)
- [x] US-013 Merge-tag chips
- [x] US-014 In-editor image upload
- [x] US-015 Preview modes + test-send integration

## Workstream C — Newsletters & campaigns

- [x] US-016 Campaign data model
- [x] US-017 Campaign CRUD + compose UI
- [x] US-018 Audience selection v1
- [x] US-019 Fan-out send with rate cap
- [x] US-020 Compliance headers + enforced footer
- [x] US-021 Campaign scheduling
- [x] US-022 Send blog post as newsletter
- [x] US-023 Marketing consent capture (parallel worktree agent; integrated at ae6b12e)

## Workstream D — CRM-lite

- [x] US-024 Customer tags (parallel worktree agent; integrated at cb36836)
- [ ] US-025 Segments as saved audiences
- [ ] US-026 Campaign results page
- [ ] US-027 Open/click tracking (per-tenant opt-in)
- [ ] US-028 Reorder-reminder automation (MVP)
