# PRD: Codebase Health — Security, Performance, Dead Code & Build Optimization

> **ARCHIVED 2026-05-29 — partially superseded baseline.** Code-health/boundary items are now tracked in [`../PRDS/REMEDIATION/PRD-209-code-health-boundaries.md`](../PRDS/REMEDIATION/PRD-209-code-health-boundaries.md); security items in PRD-200/204/206/211. **Phase 3 (Performance: N+1 queries, loading skeletons, revalidation, Suspense) and Phase 4 (Build: unused deps, Railway build caching, framer-motion upgrade) are NOT yet adopted into any numbered remediation PRD — this archived doc remains their only home.** Retained per PRD-214 OQ-1.

**Status:** Draft
**Date:** 2026-04-09
**Branch:** `codebase-health` (from `main`)
**Priority:** Critical (security fixes) → High (performance, dead code) → Medium (build, dedup)

---

## 1. Problem Statement

A comprehensive code quality audit of `nextjs_space/` (610 files, ~180 routes) identified:

- **2 CRITICAL + 4 HIGH security vulnerabilities** including file upload bypass and timing attacks
- **~2,500+ lines of dead code** across legacy components, unused UI libraries, and orphan scripts
- **3 major duplication hotspots** — auth boilerplate (43 routes), Dr Green API (5 files / 1,729 lines), admin tables
- **3 HIGH performance issues** — N+1 queries, missing streaming/caching
- **5-minute Railway builds** with no caching and redundant dependencies

## 2. Goals

1. Zero CRITICAL/HIGH security vulnerabilities
2. Remove all confirmed dead code (~2,500 lines)
3. Fix N+1 queries and add caching/streaming
4. Reduce build time from ~5min to ~2-3min
5. Consolidate duplicated patterns for maintainability

## 3. Non-Goals

- Rewriting the Automatos widget SDK (third-party, 64-node community is theirs)
- Migrating off Railway or changing deployment model
- Adding new features — this is strictly cleanup and hardening
- Refactoring the template system architecture (works as designed)

---

## Phase 1: Security Hardening

**Branch:** `codebase-health/phase-1-security`
**Estimated effort:** 1-2 days
**Test:** Security-focused integration tests for each fix

### 1.1 — CRITICAL: File Upload Validation (S1 + S2)

**File:** `lib/upload-validation.ts`

**Problem:**
- Line 44: MIME type trusted from client header — no magic-byte verification. An attacker can upload an executable with `Content-Type: image/png`.
- Lines 19-23: CSS and JSON in allowed upload types. CSS enables stored XSS via `expression()`, `url()`, and `@import`. JSON could be served as JSONP.

**Fix:**
1. Install `file-type` package (`pnpm add file-type`)
2. After receiving upload, read first 4096 bytes and verify magic bytes match claimed MIME type
3. Remove `text/css` and `application/json` from allowed MIME types
4. If CSS/JSON uploads are needed for templates, restrict to super-admin role only and serve with `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`

**Test plan:**
- [ ] Unit test: upload `.exe` renamed to `.png` → rejected
- [ ] Unit test: upload valid PNG → accepted
- [ ] Unit test: upload CSS file as non-super-admin → rejected
- [ ] Integration test: full upload flow with magic-byte check

### 1.2 — HIGH: Encryption Key Derivation (S3)

**File:** `lib/encryption.ts:13`

**Problem:** Uses raw `SHA-256` hash to derive encryption key from password. SHA-256 is fast — attackers can brute-force at billions/sec.

**Fix:**
1. Replace `crypto.createHash('sha256')` with `crypto.scryptSync(password, salt, 32)` using a random 16-byte salt
2. Store salt alongside ciphertext (prepend to encrypted output)
3. Add migration path: detect old format (no salt prefix), decrypt with legacy method, re-encrypt with scrypt
4. Log deprecation warning for legacy-encrypted values

**Test plan:**
- [ ] Unit test: encrypt → decrypt roundtrip with new KDF
- [ ] Unit test: legacy ciphertext still decryptable (migration path)
- [ ] Unit test: re-encryption produces scrypt format

### 1.3 — HIGH: Unauthenticated Tenant Info Disclosure (S4 + S5)

**Files:**
- `app/api/tenant/current/route.ts`
- `app/api/tenant/[slug]/route.ts`

**Problem:** Both routes return tenant configuration (name, settings, template info) without any authentication check. Any anonymous request can enumerate tenants and their settings.

**Fix:**
1. Add `getCurrentUser()` check to both routes
2. Return 401 for unauthenticated requests
3. For public-facing store pages that need tenant data, ensure they use server-side data fetching (not these API routes)
4. Audit: check if any public store pages call these routes client-side — if so, create a separate `/api/public/tenant/[slug]` endpoint that returns only the minimum public fields (name, logo, template slug)

**Test plan:**
- [ ] Integration test: unauthenticated request → 401
- [ ] Integration test: authenticated tenant member → 200 with full data
- [ ] Integration test: authenticated user from different tenant → 403
- [ ] Verify store pages still render (no broken data fetching)

### 1.4 — HIGH: Timing-Safe Webhook Signature Verification (S6)

**File:** `lib/drgreen-webhook-verify.ts:49-60`

**Problem:** Webhook signature compared with `===` (string equality). This is vulnerable to timing attacks — an attacker can brute-force the signature byte-by-byte by measuring response time differences.

**Fix:**
1. Replace `computedSignature === receivedSignature` with:
   ```ts
   crypto.timingSafeEqual(
     Buffer.from(computedSignature, 'hex'),
     Buffer.from(receivedSignature, 'hex')
   )
   ```
2. Add length check before `timingSafeEqual` (it throws on length mismatch)
3. Return same error response for both invalid and missing signatures

**Test plan:**
- [ ] Unit test: valid signature → passes
- [ ] Unit test: invalid signature → fails
- [ ] Unit test: empty/missing signature → fails (not throws)

### 1.5 — MEDIUM: CSP Tightening (S7)

**File:** `next.config.js:83`

**Problem:** Content Security Policy has `unsafe-inline` and `unsafe-eval` in `script-src`, significantly weakening XSS protection.

**Fix:**
1. Replace `unsafe-inline` with nonce-based CSP (Next.js 14 supports `nonce` via `headers()`)
2. Remove `unsafe-eval` — audit for any runtime code evaluation usage (likely from plotly.js or dev tooling)
3. If runtime code evaluation is required by plotly.js, scope it to the specific pages that use plotly via route-level headers

**Test plan:**
- [ ] Verify all pages render without CSP violations in browser console
- [ ] Verify plotly charts still work
- [ ] Verify Automatos widget still loads

### 1.6 — MEDIUM: Tenant-Scoped S3 Uploads (S8)

**File:** `app/api/tenant-admin/upload/route.ts:46`

**Problem:** Upload S3 key is not scoped to the authenticated tenant's prefix. Tenant A could potentially overwrite Tenant B's assets by crafting a specific filename.

**Fix:**
1. Extract tenant ID from authenticated session
2. Force S3 key prefix to `tenants/{tenantId}/uploads/`
3. Strip any path traversal from filename (`../` etc.)
4. Validate final S3 key starts with expected tenant prefix before writing

**Test plan:**
- [ ] Unit test: filename with `../` → sanitized
- [ ] Integration test: upload scoped to correct tenant prefix
- [ ] Integration test: cannot write outside tenant prefix

### 1.7 — MEDIUM: Rate Limiting on Sensitive Endpoints (S9)

**Problem:** No rate limiting on auth-sensitive endpoints (login callbacks, webhook receivers, upload endpoints).

**Fix:**
1. Add rate limiting middleware using existing Redis connection (`ioredis`)
2. Apply to: webhook endpoints (10 req/min), upload endpoints (20 req/min), auth-related endpoints (30 req/min)
3. Return `429 Too Many Requests` with `Retry-After` header

**Test plan:**
- [ ] Unit test: rate limiter allows requests under limit
- [ ] Unit test: rate limiter blocks requests over limit
- [ ] Unit test: rate limiter resets after window expires

### 1.8 — MEDIUM: Error Response Sanitization (S10)

**Problem:** Several API routes return raw error messages (`error.message`) that could leak internal details (DB schema, file paths, stack traces).

**Fix:**
1. Create `lib/api-error.ts` utility that maps known errors to safe messages
2. In production, return generic messages; in development, return full details
3. Audit all `catch` blocks in API routes for raw error exposure

**Test plan:**
- [ ] Unit test: known error types → mapped safe message
- [ ] Unit test: unknown error in production → generic "Internal server error"
- [ ] Unit test: unknown error in development → full message

---

## Phase 2: Dead Code Removal

**Branch:** `codebase-health/phase-2-dead-code`
**Estimated effort:** 0.5-1 day
**Test:** Build succeeds, all existing tests pass, no runtime errors on key pages

### 2.1 — Legacy Landing Components

**Delete entirely:**
- `components/home/` (7 files, ~800 lines) — replaced by S3 template-driven landing pages

**Verify before deletion:**
- [ ] Grep for imports of any `components/home/` files → expect zero
- [ ] Confirm store pages use `TemplateRenderer` not legacy components

### 2.2 — Dead Fallback Components

**Delete:**
- `components/navigation.tsx` (~100 lines) — dead fallback, layout.json always provides nav
- `components/footer.tsx` (~100 lines) — same

**Verify:**
- [ ] Grep for imports → expect only in dead code paths or zero

### 2.3 — Dead Template Registry Exports

**File:** `lib/template-registry.ts`

**Clean up:**
- Remove `TEMPLATE_COMPONENTS`, `TEMPLATE_NAVIGATION`, `TEMPLATE_FOOTER` (all empty `{}`)
- Keep any exports that are actually imported

### 2.4 — Dead Dr Green API Exports

**File:** `lib/doctor-green-api.ts`

**Remove unused exports:**
- `verifyNFT()` — never imported
- `getClientByNFT()` — never imported
- `fetchClientOrders()` — never imported
- `addToCart()` — never imported (cart logic moved to `drgreen-cart.ts`)

### 2.5 — Disabled Route

**Delete:** `app/api/doctor-green/sync-products.disabled/` (~80 lines)

### 2.6 — Mock Data

**Delete:** `lib/mock-data.ts` (~150 lines) — placeholder data for audit-logs

**Verify:**
- [ ] Check if audit-logs page imports it → if so, replace with empty state UI

### 2.7 — Orphan Sidebar Components

**Delete:**
- `DashboardSidebar.tsx` (~150 lines)
- `TenantDashboardSidebar.tsx` (~150 lines)

**Verify:**
- [ ] Grep for imports → expect zero

### 2.8 — Orphan SEO Component

**Delete:** `components/admin/seo/GooglePreview.tsx` (~60 lines)

### 2.9 — One-Off Scripts

**Move to `scripts/_archive/` or delete:**
All 16+ debug/fix/check scripts: `debug_tenants.ts`, `debug_user.ts`, `fix_missing_user.ts`, `revert-tenant-country.ts`, `check-keys.js`, `check-aws-env.ts`, etc.

These are one-time operations that have already been run. Archive rather than delete if there's sentimental value.

### 2.10 — Unused shadcn/ui Components (21)

**Delete from `components/ui/`:**
`hover-card.tsx`, `input-otp.tsx`, `carousel.tsx`, `context-menu.tsx`, `menubar.tsx`, `navigation-menu.tsx`, `radio-group.tsx`, `resizable.tsx`, `scroll-area.tsx`, `slider.tsx`, `toggle.tsx`, `toggle-group.tsx`, `collapsible.tsx`, `aspect-ratio.tsx`, `accordion.tsx`, `alert-dialog.tsx`, `avatar.tsx`, `breadcrumb.tsx`, `command.tsx`, `drawer.tsx`, `sonner.tsx`

**Verify each:**
- [ ] Grep for imports of each component → confirm zero before deleting

**Note:** shadcn/ui components can be re-added in seconds via `npx shadcn-ui@latest add <component>` if needed later.

---

## Phase 3: Performance Optimization

**Branch:** `codebase-health/phase-3-performance`
**Estimated effort:** 1-2 days
**Test:** Before/after timing on key routes, verify data correctness

### 3.1 — HIGH: Fix N+1 Analytics Query (P1)

**File:** `app/api/tenant-admin/analytics/route.ts:160`

**Problem:** Loops over orders doing individual product lookups.

**Fix:**
1. Collect all product IDs from orders
2. Single `prisma.product.findMany({ where: { id: { in: productIds } } })`
3. Build lookup map, then iterate orders

**Test plan:**
- [ ] Integration test: analytics endpoint returns same data as before
- [ ] Log query count: should be 2 instead of N+1

### 3.2 — HIGH: Fix N+1 Order Status Counts (P2)

**File:** `app/api/tenant-admin/orders/route.ts:178`

**Problem:** 5 separate `prisma.order.count()` calls, one per status.

**Fix:**
```ts
const statusCounts = await prisma.order.groupBy({
  by: ['status'],
  _count: true,
  where: { tenantId }
})
```

**Test plan:**
- [ ] Integration test: same status counts returned
- [ ] Query count: 1 instead of 5

### 3.3 — HIGH: Batch Product Reorder (P3)

**File:** `app/api/tenant-admin/products/reorder/route.ts:64`

**Problem:** N individual `prisma.update()` calls for reordering.

**Fix:**
```ts
await prisma.$transaction(
  products.map((p, i) =>
    prisma.product.update({ where: { id: p.id }, data: { sortOrder: i } })
  )
)
```

**Test plan:**
- [ ] Integration test: products reordered correctly
- [ ] Verify transaction rollback on failure

### 3.4 — MEDIUM: Add loading.tsx Skeletons (P4)

**Problem:** Zero `loading.tsx` files — users see blank pages during SSR.

**Add `loading.tsx` to these high-traffic routes:**
1. `app/store/[slug]/loading.tsx` — store homepage skeleton
2. `app/store/[slug]/products/loading.tsx` — product grid skeleton
3. `app/tenant-admin/loading.tsx` — admin dashboard skeleton
4. `app/tenant-admin/products/loading.tsx` — product list skeleton
5. `app/tenant-admin/orders/loading.tsx` — order list skeleton

Each skeleton should use the shadcn `Skeleton` component for consistent shimmer effects.

### 3.5 — MEDIUM: Add Revalidation to Store Pages (P5)

**Problem:** Only 1 page uses `revalidate`. Every store page hits S3 + DB on every request.

**Fix:**
Add to store layout and key store pages:
```ts
export const revalidate = 60 // seconds
```

**Apply to:**
- `app/store/[slug]/layout.tsx` — template data, nav/footer
- `app/store/[slug]/page.tsx` — homepage sections
- `app/store/[slug]/products/page.tsx` — product catalog

**Test plan:**
- [ ] Verify pages serve cached version within 60s window
- [ ] Verify changes appear after revalidation period
- [ ] Verify cart/checkout (dynamic) routes are NOT cached

### 3.6 — MEDIUM: Add Suspense Boundaries (P6)

**Problem:** No Suspense boundaries on data-fetching server components — entire page blocked.

**Fix:** Wrap heavy data-fetching sections in `<Suspense fallback={<Skeleton />}>`:
- Product grids
- Order tables
- Analytics charts
- Blog post lists

---

## Phase 4: Build Optimization

**Branch:** `codebase-health/phase-4-build`
**Estimated effort:** 0.5-1 day
**Test:** Before/after Railway build times

### 4.1 — Remove Unused Dependencies

**Remove from `package.json`:**

| Package | Reason |
|---------|--------|
| `react-use` | Zero imports found in codebase |

**Consolidate:**

| Keep | Remove | Reason |
|------|--------|--------|
| `recharts` | `plotly.js` + `react-plotly.js` | plotly is ~8MB unminified, recharts does same charts. Migrate 2-3 plotly usages to recharts. |
| `date-fns` OR `dayjs` | the other | Two date libraries. Pick one, migrate the other's usages. Audit to determine which has more call sites. |

### 4.2 — Remove Dead Static Assets

**Audit `public/` directory:**
- [ ] Check if `hero-video.mp4` is referenced anywhere → if not, delete (potentially 10-50MB)
- [ ] Check `public/templates/` images → if served from S3 now, delete local copies
- [ ] Check `public/conditions/` images → same audit

### 4.3 — Fix @automatos/widget-sdk Link Dependency

**Current:** `"@automatos/widget-sdk": "link:../../automatos-widget-sdk/packages/react"`

**Problem:** This `link:` path works locally but won't resolve on Railway. The widget is already loaded via `public/automatos-widget.js` (the SDK JS file).

**Fix:**
1. Verify the React wrapper actually needs the npm package or if it just uses the public JS file
2. If needed: publish to npm private registry or inline the wrapper
3. If not needed: remove from `package.json`

### 4.4 — Add Build Caching on Railway

**Option A — Railway cache mounts (recommended):**
Configure Railway to cache:
- `node_modules/` — skip reinstall when lockfile unchanged
- `.next/cache/` — incremental Next.js compilation cache

**Option B — Turborepo:**
1. `pnpm add -Dw turbo`
2. Add `turbo.json` with build pipeline config
3. Enable remote caching (Vercel or self-hosted)
4. Estimated saving: 1-3 min on incremental builds

### 4.5 — Upgrade framer-motion

**Current:** v10.18.0
**Target:** v11.x

v11 has significantly better tree-shaking. Since it's only used in 5 files, migration should be straightforward. Check for breaking API changes in the v11 migration guide.

---

## Phase 5: Deduplication & Code Quality

**Branch:** `codebase-health/phase-5-dedup`
**Estimated effort:** 2-3 days
**Test:** All existing tests pass, new tests for extracted utilities

### 5.1 — Extract Auth Middleware

**Problem:** 43 routes repeat: get user → check null → get tenant → check null → do work. 46 routes use raw `currentUser()` vs `getCurrentUser()` inconsistently.

**Fix:**
Create `lib/api-auth.ts`:
```ts
export function withTenantAuth(handler: AuthenticatedHandler) {
  return async (req: NextRequest) => {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const tenant = await getTenantForUser(user.id)
    if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 403 })
    return handler(req, { user, tenant })
  }
}
```

**Migration:**
1. Create the wrapper
2. Migrate 5 routes as proof of concept
3. If pattern works well, migrate remaining routes in batches of 10

**Standardize:** All routes use `getCurrentUser()` — remove direct `currentUser()` calls.

### 5.2 — Consolidate Dr Green API

**Current state (5 files, 1,729 lines):**
| File | Lines | Status |
|------|-------|--------|
| `lib/doctor-green-api.ts` | 459 | Legacy, partially dead |
| `lib/drgreen-api-client.ts` | 356 | New client, duplicates signing |
| `lib/drgreen-cart.ts` | 267 | Cart operations |
| `lib/drgreen-client-cart.ts` | 245 | Overlapping cart ops |
| `lib/drgreen-orders.ts` | 402 | Order flow |

**Target state (4 files, ~1,000 lines):**
```
lib/drgreen/
  ├── client.ts      — HTTP client + signing (one copy of generateDrGreenSignature)
  ├── cart.ts         — Cart operations (merge drgreen-cart + drgreen-client-cart)
  ├── orders.ts       — Order flow
  └── index.ts        — Public API barrel export
```

**Steps:**
1. Create `lib/drgreen/client.ts` — extract single signing implementation
2. Merge `drgreen-cart.ts` + `drgreen-client-cart.ts` → `lib/drgreen/cart.ts`
3. Move `drgreen-orders.ts` → `lib/drgreen/orders.ts`
4. Delete `doctor-green-api.ts` (dead exports already removed in Phase 2)
5. Delete `drgreen-api-client.ts` (merged into client.ts)
6. Update all imports across codebase
7. Verify with `pnpm build`

### 5.3 — Extract DataTable Component (Optional)

**Problem:** 8+ admin pages repeat search/filter/sort/pagination patterns.

**Fix:**
1. Audit existing table implementations for common props
2. Extract `components/admin/shared/DataTable.tsx` with:
   - Column definitions
   - Search input with debounce
   - Sort state management
   - Pagination controls
   - Loading/empty states
3. Migrate 2-3 tables as proof of concept
4. Migrate rest if pattern proves clean

**Note:** This is the lowest priority item. Only tackle if Phases 1-4 are complete and the team wants to invest in DX.

---

## Testing Strategy

Each phase gets its own branch, its own PR, and its own test pass:

| Phase | Branch | Merge Criteria |
|-------|--------|---------------|
| 1 - Security | `codebase-health/phase-1-security` | All security tests pass, `pnpm build` succeeds, manual test of upload/webhook/auth flows |
| 2 - Dead Code | `codebase-health/phase-2-dead-code` | `pnpm build` succeeds, grep confirms zero remaining imports of deleted files, key pages render |
| 3 - Performance | `codebase-health/phase-3-performance` | `pnpm build` succeeds, before/after query counts logged, loading states visible |
| 4 - Build | `codebase-health/phase-4-build` | Railway build succeeds, build time measured before/after |
| 5 - Dedup | `codebase-health/phase-5-dedup` | `pnpm build` succeeds, all routes return same responses as before |

## Rollback Plan

Each phase is an independent PR. If any phase causes issues in production:
1. Revert the specific PR
2. Investigate and fix
3. Re-deploy

No phase depends on a previous phase being deployed (though Phase 2 dead code removal should happen after Phase 1 security fixes to avoid merge conflicts in the same files).

---

## Metrics

**Before (baseline):**
- Security: 2 CRITICAL, 4 HIGH, 4 MEDIUM vulnerabilities
- Dead code: ~2,500+ lines
- Performance: 3 N+1 queries, 0 loading states, 0 Suspense boundaries, 1 cached page
- Build time: ~5 minutes on Railway
- Duplication: 3 copies of signature generation, 89 inconsistent auth calls

**After (target):**
- Security: 0 CRITICAL, 0 HIGH, 0 MEDIUM
- Dead code: 0 confirmed dead code
- Performance: 0 N+1 queries, 5+ loading states, Suspense on heavy components, store pages cached
- Build time: ~2-3 minutes (with caching)
- Duplication: 1 signing function, 1 auth wrapper pattern, consolidated Dr Green module

---

## Build Analysis Summary

**Current build: ~5 minutes on Railway — within normal range but improvable.**

| Factor | Impact | Fix |
|--------|--------|-----|
| 180 route entry points | Core cost, inherent | Can't reduce without removing routes |
| `output: 'standalone'` tracing | +30-60s | Required for Railway |
| TypeScript type-checking | +30-60s | Keep (catches real bugs) |
| No build cache between deploys | +1-2 min | Railway cache mounts or Turborepo |
| `plotly.js` (~8MB) | +30-60s install | Replace with recharts |
| `react-use` (unused) | +5-10s install | Remove |
| `hero-video.mp4` in public/ | Bloats deploy artifact | Delete if unused |
| `@automatos/widget-sdk` link dep | Broken on Railway | Fix or remove |
| `framer-motion` v10 | Poor tree-shaking | Upgrade to v11 |
| Dual date libs (`date-fns` + `dayjs`) | Redundant weight | Pick one |
| Dual chart libs (`recharts` + `plotly`) | Redundant weight | Pick one |

---

## Appendix: Source Findings

Full analysis artifacts:
- `graphify-out/GRAPH_REPORT.md` — Knowledge graph report (1,065 nodes, 52 communities)
- `graphify-out/graph.html` — Interactive graph visualization
- `graphify-out/graph.json` — GraphRAG-ready JSON

Security scan IDs: S1-S10
Performance scan IDs: P1-P6
