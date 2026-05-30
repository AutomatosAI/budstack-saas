# PRD-204 Input Validation Sweep — Implementation Plan

Single source of truth for Ralph progress. Flip `- [ ]` → `- [x]` ONLY on real success
(never for a BLOCKED marker). Stories execute in priority order.

Branch: `ralph/prd-204-input-validation-sweep` (worktree at
`/Users/gkavanagh/Development/HealingBuds/budstack-saas-prd-204`, off main `af77b24`).
App in `nextjs_space/` (pnpm). Source PRD:
`docs/PRDS/REMEDIATION/PRD-204-input-validation-sweep.md`.

## Grounded reality (verified on this branch off main)
- **41 dynamic route files** under `app/api/**/[*]/`. Breakdown:
  - slug-based (parseSlug): `store/[slug]/*` = 9 files (cart add/clear/remove/route,
    orders route/submit, orders/[orderId]/route [+parseUuid on orderId], products route/featured);
    `tenant/[slug]/route`, `tenant/conditions/[slug]/route` = 2 files.
  - id-based (parseUuid): super-admin `[id]` = 14 files; tenant-admin `[id]` = 16 files.
- **OQ-1 RESOLVED**: dynamic ids are UUID-format (Prisma `@default(uuid())` ×5,
  `dbgenerated("gen_random_uuid()")` ×1, app-side `crypto.randomUUID()` for the ~17 no-default
  models). Non-UUID ids are only the singletons `"config"`/`"platform"` (NOT reached via an
  `[id]` route). → use a **lenient any-version UUID regex** to avoid false rejections.
- `lib/utils.ts` `deepMerge(base, overrides)` has **no key filter** → JSON.parse'd `__proto__`
  is an OWN enumerable key, so `Object.keys` includes it and `result["__proto__"]=val` hits the
  proto setter (prototype pollution). Fix = skip DANGEROUS_KEYS at every level.
- `lib/api-error.ts` exists: `ApiError(message, status=500, safeForClient=true)` (throwable),
  `apiError(error, opts)` honours `error.status` for ApiError instances (so a thrown
  `ApiError(.,400)` surfaces as a clean 400), `apiValidationError(message, route?)` → 400.
- `app/api/customer/profile/route.ts` PATCH: `await request.json()` → fields written straight to
  Prisma, NO Zod/caps, bare `catch {500}`. `address` is free-form Json.
- `super-admin/tenants/[id]/route.ts` PATCH: settings merged by **shallow spread**
  (`{ ...existingSettings, ...(settings||{}), ...domainMeta }` ~line 258), `settings` unvalidated;
  `params.id` used raw in `prisma.tenants.findUnique/update/delete`.
- **56** `request.json()`/`req.json()` body sites; **37/91** route files already import `apiError`
  (the rest use bare `catch {500}` — swap to `apiError(error,{route})` on touch so parse-helper
  400s propagate). `zod@3.23.8` available. `lib/validation/` does NOT exist yet (create it).
- PRD-207 (vitest/playwright) NOT merged → tests can't run; gate on `tsc --noEmit` + `pnpm build`.
  Unit/integration/E2E from PRD §12 deferred to when PRD-207 lands.

## Stories

- [x] US-001 — `parseUuid` + `parseSlug` helpers in `lib/validation/parse-uuid.ts` (AC-1)
- [x] US-002 — Fix `deepMerge` prototype pollution (DANGEROUS_KEYS skip) (AC-2)
- [x] US-003 — `parseJsonBody` body-size-cap helper in `lib/validation/body.ts` (AC-6)
- [x] US-004 — Strict `tenant-settings` schema + wire `super-admin/tenants/[id]` (parseUuid + settings) (AC-4)
- [ ] US-005 — Validate `customer/profile` PATCH with Zod + caps (AC-3)
- [ ] US-006 — parseSlug/parseUuid rollout: `store/[slug]/*` (9 files) (AC-1a)
- [ ] US-007 — parseSlug rollout: `tenant/[slug]` + `tenant/conditions/[slug]` (AC-1a)
- [ ] US-008 — parseUuid rollout: super-admin `[id]` routes (13 files, ex tenants/[id]/route.ts) (AC-1a)
- [ ] US-009 — parseUuid rollout: tenant-admin `[id]` routes (16 files) (AC-1a)
- [ ] US-010 — Zod + parseJsonBody on public store body routes (AC-5, AC-6)
- [ ] US-011 — Zod + parseJsonBody on tenant-admin write routes (AC-5)
- [ ] US-012 — Zod + parseJsonBody on super-admin write routes + uploads guard (AC-5, AC-6a) → RALPH_COMPLETE

## Notes
- US-006..009 depend on US-001; US-005/010/011/012 depend on US-003; US-004 depends on US-001+003.
- Route-ownership boundary: US-004 fully owns `super-admin/tenants/[id]/route.ts` (parseUuid +
  settings schema); US-008 owns the 3 SIBLING `tenants/[id]/*` sub-routes (drgreen-keys,
  toggle-active, verify-domain). Each route file touched by exactly one story.
- New thrown error: `parseUuid`/`parseSlug` throw `ApiError('Invalid request', 400)`; because
  `apiError()` honours `error.status` for ApiError instances, handlers that already wrap in
  `apiError(error,{route})` surface a clean 400. Bare-catch handlers must adopt that wrap on touch.
- **US-004 risk**: `.strict()` 400s on any unknown settings key → could break legitimate saves.
  Enumerate EVERY key via grep before writing the schema (no DB to test against). Mark all keys
  optional; `.strict()` only to reject truly unknown blobs (the PRD-208 hardening goal).
- Do NOT refactor route auth (`getCurrentUser` vs Clerk `currentUser()`) — that is PRD-203 scope.
- AC-6a: upload routes must KEEP magic-byte + max-file-size validation — verify, do not regress.
- No DB reachable locally; all validation is `tsc --noEmit` + `pnpm build` (stub env per ci.yml:
  DATABASE_URL, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, NEXT_PUBLIC_BASE_DOMAIN,
  NEXTAUTH_SECRET, ENCRYPTION_KEY).
