# PRD-201 Destructive Super-Admin Endpoint Removal & CSRF Defence-in-Depth — Implementation Plan

Single source of truth for Ralph progress. Flip `- [ ]` → `- [x]` ONLY on real success
(never for a BLOCKED marker). Stories execute in priority order.

Branch: `ralph/prd-201-destructive-endpoint-csrf-hardening` (worktree at
`/Users/gkavanagh/Development/HealingBuds/budstack-saas-prd-201`, off main `af77b24`).
App in `nextjs_space/` (pnpm). Source PRD:
`docs/PRDS/REMEDIATION/PRD-201-destructive-endpoint-csrf-hardening.md`.

## Grounded reality (verified on this branch off main)
- `app/api/super-admin/tenants/reset-templates/route.ts` = the only destructive GET-wipe
  (GET ?subdomain&confirm=yes → S3+DB wipe; POST just calls GET; leaks `steps[]`). Nothing imports it.
- `RESERVED_SUBDOMAINS` lives INLINE in `app/api/onboarding/route.ts:28` (a `Set`), with
  `isValidSubdomain()` at :37. `_cd` is NOT in the set. No shared `lib/reserved-subdomains.ts` exists.
- Super-admin tenant **rename** (`tenants/[id]` PATCH) checks uniqueness only — NO format/reserved check.
- Tenant **DELETE** (`tenants/[id]`) already DELETE-method + writes `audit_logs`, but returns
  `cleanupErrors[]` (Clerk org IDs + error strings) to the client.
- `cleanup-s3` (DELETE) accepts any `?prefix=templates/...` incl. bare `templates/` → over-broad wipe.
- `lib/api-error.ts` exists (`ApiError`, `apiError`, `apiValidationError`) — returns `{ error }`, no `code` field.
- Inventory: the only destructive GET was reset-templates; tenant/template DELETE + learning DELETE +
  cleanup-s3 DELETE + recover-deleted/migrate-s3-paths/detach POST are already non-GET.
- PRD-207 (vitest/playwright) NOT merged → tests can't run; gate on `tsc --noEmit` + `pnpm build`.
  Unit/integration/E2E test files from the PRD §12 plan are deferred to when PRD-207 lands.

## Stories

- [x] US-001 — Delete the one-time `reset-templates` wipe route (AC-1, AC-2 primary, AC-5a)
- [x] US-002 — Security guard module: `requireSameOrigin` + `requireConfirmation` (AC-4, AC-3; new codes)
- [x] US-003 — Extract + harden `RESERVED_SUBDOMAINS` into `lib/reserved-subdomains.ts` + add `_cd` (AC-6)
- [x] US-004 — Enforce reserved + format on super-admin tenant rename (AC-7)
- [ ] US-005 — Apply `requireSameOrigin` to all destructive super-admin handlers (AC-4 100%, AC-2)
- [ ] US-006 — Tenant DELETE: typed `{ confirm }` body + stop `cleanupErrors` leak (AC-3, AC-5)
- [ ] US-007 — Scope + harden `cleanup-s3`: prefix guard + confirmation + audit line (AC-1a, AC-3, AC-8) → RALPH_COMPLETE

## Notes
- US-004 depends on US-003. US-005/006/007 depend on US-002. US-007 is the final story.
- New error codes returned as `{ error, code }`: `CROSS_ORIGIN_BLOCKED` (403), `RESERVED_SUBDOMAIN` (400),
  `CONFIRMATION_MISMATCH` (400). `lib/api-error.ts` envelope has no `code` field → add it inline in the guards.
- OQ-1 (retire reset capability entirely) taken as YES per PRD "best outcome" — route deleted, no POST reimpl.
- Do NOT refactor route auth (`getCurrentUser` vs Clerk `currentUser()`) — that is PRD-203 scope.
- No DB reachable locally; all validation is `tsc --noEmit` + `pnpm build` (stub env per ci.yml).
