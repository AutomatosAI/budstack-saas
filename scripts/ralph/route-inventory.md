# PRD-203 — Route Inventory (auth posture + chosen wrapper)

Single source of truth for the wrapper rollout. Every `app/api/**/route.ts` is
listed with its **exported HTTP methods**, the **current** auth mechanism
observed, and the **chosen** wrapper (or allow-list) the migration targets.

- **Total route files:** 107
- **Already wrapped today:** 12 (8 super-admin + 3 tenant-admin via `lib/api-auth`; 1 via `lib/with-tenant-context`)
- **To migrate:** 95
- Posture gathered 2026-05-30 by AST/grep over this worktree (no handler bodies were changed in US-001).

| Bucket | Count | Wrapper | Migration story |
| --- | --- | --- | --- |
| Super-admin | 33 | `withSuperAdmin` / `withSuperAdminParams` | US-006 |
| Tenant-admin | 43 | `withTenantAuth` / `withTenantAuthParams` | US-007 (batch 1) + US-008 (batch 2) |
| Any-authenticated | 17 | `withAuth` | US-005 (`customer/profile`) + US-009 |
| Needs human decision | 1 | — (`consultation/submit`) | US-009 |
| Public allow-list | 13 | `AUTH_PUBLIC_ROUTES` | US-009 (confirm, not wrapped) |

`33 + 43 + 17 + 1 + 13 = 107` ✓

---

## Cross-cutting design notes (feed US-003 + US-009)

1. **`withAuth` MUST forward the Next.js route context (`{ params }`).** Today
   `withAuth(handler)` returns `(req) => …` and drops the 2nd arg. Several
   any-authenticated routes are dynamic (`store/[slug]/**`, `tenant/[slug]`) and
   read `params.slug` / `params.orderId` from that 2nd arg. **US-003 must change
   `withAuth` (and confirm `withTenantContext`-style arg forwarding) to pass
   `...args` through**, exactly as `lib/with-tenant-context.ts` already does, or
   those routes break on migration. Param'd routes are tagged `(+params)` below.
2. **Binding target per wrapper (US-003 / AC-1b):** `withTenantAuth*` →
   `user.tenantId`; `withSuperAdmin*` → explicit `null` (deliberate cross-tenant
   system query, `hasTenantContext()` true); `withAuth` → host-resolved tenant
   via `getTenantFromRequest`. Customers have **no Clerk org**, so `withAuth`
   never uses `user.tenantId` — the storefront host tenant is what scopes them.
3. **Default-deny:** anything not on `AUTH_PUBLIC_ROUTES` (`lib/auth-public-routes.ts`)
   MUST be wrapped. The gate (US-002 report-only → US-010 blocking) enforces it.
4. **`getCurrentUser` vs raw `currentUser()`:** ~44 routes call the helper, ~37
   call Clerk's `currentUser()` directly and hand-roll the role check. Both
   collapse into the wrapper context arg (AC-1a) — handlers stop re-resolving the
   user in the body.

---

## Super-admin (33) → `withSuperAdmin` / `withSuperAdminParams` (US-006)

`*Params` chosen whenever the path has a `[id]`/`[slug]` segment. ✓ = already wrapped.

| Route | Methods | Current | Chosen |
| --- | --- | --- | --- |
| super-admin/analytics | GET | currentUser | withSuperAdmin |
| super-admin/audit-logs | GET | ✓ withSuperAdmin | withSuperAdmin |
| super-admin/email-mappings | GET, POST | ✓ withSuperAdmin | withSuperAdmin |
| super-admin/email-templates/[id] | GET, PUT, DELETE | ✓ withSuperAdminParams | withSuperAdminParams |
| super-admin/email-templates | GET, POST | ✓ withSuperAdmin | withSuperAdmin |
| super-admin/learning | GET, POST, PUT, DELETE | getCurrentUser | withSuperAdmin |
| super-admin/platform-settings | GET, POST | getCurrentUser | withSuperAdmin |
| super-admin/settings | GET, POST | getCurrentUser | withSuperAdmin |
| super-admin/submissions/[id]/approve | POST | getCurrentUser | withSuperAdminParams |
| super-admin/submissions/[id]/edit | PUT | getCurrentUser | withSuperAdminParams |
| super-admin/submissions/[id]/reject | POST | getCurrentUser | withSuperAdminParams |
| super-admin/submissions/[id]/request-changes | POST | getCurrentUser | withSuperAdminParams |
| super-admin/submissions/[id] | GET | getCurrentUser | withSuperAdminParams |
| super-admin/submissions | GET | ✓ withSuperAdmin | withSuperAdmin |
| super-admin/templates/[id]/branding | POST | currentUser | withSuperAdminParams |
| super-admin/templates/[id]/detach | POST | currentUser | withSuperAdminParams |
| super-admin/templates/[id] | DELETE, PATCH, PUT | currentUser | withSuperAdminParams |
| super-admin/templates/[id]/update-from-github | POST | currentUser | withSuperAdminParams |
| super-admin/templates/cleanup-s3 | DELETE | currentUser | withSuperAdmin |
| super-admin/templates/clone-from-tenant | POST | currentUser | withSuperAdmin |
| super-admin/templates/create-blank | GET | currentUser | withSuperAdmin |
| super-admin/templates/recover-deleted | POST | currentUser | withSuperAdmin |
| super-admin/templates/trigger-rebuild | POST | currentUser | withSuperAdmin |
| super-admin/templates/upload | POST | currentUser | withSuperAdmin |
| super-admin/tenants/[id]/drgreen-keys | GET, POST | getCurrentUser | withSuperAdminParams |
| super-admin/tenants/[id] | DELETE, GET, PATCH | getCurrentUser | withSuperAdminParams |
| super-admin/tenants/[id]/toggle-active | PATCH | ✓ withSuperAdminParams | withSuperAdminParams |
| super-admin/tenants/[id]/verify-domain | GET | getCurrentUser | withSuperAdminParams |
| super-admin/tenants/bulk | POST | ✓ withSuperAdmin | withSuperAdmin |
| super-admin/tenants/migrate-s3-paths | POST | getCurrentUser | withSuperAdmin |
| super-admin/tenants/reset-templates | GET, POST | getCurrentUser | withSuperAdmin |
| super-admin/tenants | GET, POST | currentUser | withSuperAdmin |
| super-admin/test-smtp | POST | ✓ withSuperAdmin | withSuperAdmin |

Already wrapped: 8 · To migrate: 25.

---

## Tenant-admin (43) → `withTenantAuth` / `withTenantAuthParams` (US-007 + US-008)

Split into two batches in US-007/US-008. ✓ = already wrapped.

| Route | Methods | Current | Chosen |
| --- | --- | --- | --- |
| tenant-admin/analytics | GET | getCurrentUser | withTenantAuth |
| tenant-admin/audit-logs | GET | ✓ withTenantAuth | withTenantAuth |
| tenant-admin/branding | POST, PUT | getCurrentUser | withTenantAuth |
| tenant-admin/branding/upload | POST | getCurrentUser | withTenantAuth |
| tenant-admin/cookie-settings | GET, POST | getCurrentUser | withTenantAuth |
| tenant-admin/customers/[id] | DELETE, GET, PATCH | currentUser | withTenantAuthParams |
| tenant-admin/customers | GET | ✓ withTenantAuth | withTenantAuth |
| tenant-admin/email-mappings | DELETE, GET, POST | getCurrentUser | withTenantAuth |
| tenant-admin/email-templates/[id] | DELETE, GET, PUT | currentUser | withTenantAuthParams |
| tenant-admin/email-templates/clone | POST | currentUser | withTenantAuth |
| tenant-admin/email-templates | GET, POST | getCurrentUser | withTenantAuth |
| tenant-admin/my-templates/[id] | DELETE | currentUser | withTenantAuthParams |
| tenant-admin/orders/[id]/admin-notes | PATCH | currentUser | withTenantAuthParams |
| tenant-admin/orders/[id] | GET | currentUser | withTenantAuthParams |
| tenant-admin/orders/bulk | POST | currentUser | withTenantAuth |
| tenant-admin/orders | GET, PATCH | getCurrentUser | withTenantAuth |
| tenant-admin/posts/[id] | DELETE, GET, PATCH | currentUser | withTenantAuthParams |
| tenant-admin/posts | GET, POST | getCurrentUser | withTenantAuth |
| tenant-admin/products/bulk | POST | getCurrentUser | withTenantAuth |
| tenant-admin/products/list | GET | ✓ withTenantAuth | withTenantAuth |
| tenant-admin/products/reorder | POST | getCurrentUser | withTenantAuth |
| tenant-admin/products/sync | POST | currentUser | withTenantAuth |
| tenant-admin/select-template | POST | getCurrentUser | withTenantAuth |
| tenant-admin/seo/pages | GET, PUT | getCurrentUser | withTenantAuth |
| tenant-admin/seo/posts/[id] | GET, PUT | getCurrentUser | withTenantAuthParams |
| tenant-admin/seo/products/[id] | GET, PUT | getCurrentUser | withTenantAuthParams |
| tenant-admin/settings | POST | getCurrentUser | withTenantAuth |
| tenant-admin/settings/test-smtp | POST | currentUser | withTenantAuth |
| tenant-admin/submissions | GET | getCurrentUser | withTenantAuth |
| tenant-admin/templates/[id]/activate | PATCH | getCurrentUser | withTenantAuthParams |
| tenant-admin/templates/[id]/preview-image | POST | getCurrentUser | withTenantAuthParams |
| tenant-admin/templates/[id]/resubmit | POST | getCurrentUser | withTenantAuthParams |
| tenant-admin/templates/[id]/submit-to-marketplace | POST | getCurrentUser | withTenantAuthParams |
| tenant-admin/templates/[id]/update-from-github | POST | getCurrentUser | withTenantAuthParams |
| tenant-admin/templates/[id]/withdraw-submission | POST | getCurrentUser | withTenantAuthParams |
| tenant-admin/templates/clone | POST | getCurrentUser | withTenantAuth |
| tenant-admin/templates/create-blank | POST | getCurrentUser | withTenantAuth |
| tenant-admin/templates/upload | POST | getCurrentUser | withTenantAuth |
| tenant-admin/tenant | GET, PATCH | getCurrentUser | withTenantAuth |
| tenant-admin/upload | POST | getCurrentUser | withTenantAuth |
| tenant-admin/webhooks/[id]/deliveries | GET | currentUser | withTenantAuthParams |
| tenant-admin/webhooks/[id] | DELETE, PATCH | currentUser | withTenantAuthParams |
| tenant-admin/webhooks | GET, POST | getCurrentUser | withTenantAuth |

Already wrapped: 3 · To migrate: 40. **Suggested split** — US-007 batch 1: the
`[id]`/`Params` routes (customers/[id], email-templates/[id], my-templates/[id],
orders/[id]*, posts/[id], seo/*/[id], templates/[id]/*, webhooks/[id]*) ≈ 20;
US-008 batch 2: the remaining flat routes.

---

## Any-authenticated (17) → `withAuth` (US-005 + US-009)

`(+params)` = dynamic route; depends on the US-003 `withAuth` arg-forwarding fix.
✓ = already bound (via `withTenantContext`, converts to `withAuth` for the role/user check).

| Route | Methods | Current | Chosen | Story |
| --- | --- | --- | --- | --- |
| customer/profile | GET, PATCH | currentUser (unscoped `findFirst({where:{email}})` — LEAK) | withAuth | **US-005** |
| account/delete | DELETE | currentUser (+ role refs) | withAuth | US-009 |
| account/export | GET | currentUser | withAuth | US-009 |
| consultation/status | GET | currentUser + host | withAuth | US-009 |
| orders | GET, POST | currentUser + host | withAuth | US-009 |
| orders/customer | GET | ✓ withTenantContext + currentUser | withAuth | US-009 |
| user/profile | PATCH | getCurrentUser | withAuth | US-009 |
| shop/register | POST | currentUser | withAuth | US-009 |
| onboarding | POST | TENANT_ADMIN + publicMetadata | withAuth | US-009 |
| tenant/[slug] | GET | getCurrentUser | withAuth (+params) | US-009 |
| store/[slug]/cart | GET | getCurrentUser | withAuth (+params) | US-009 |
| store/[slug]/cart/add | POST | currentUser | withAuth (+params) | US-009 |
| store/[slug]/cart/clear | DELETE | currentUser | withAuth (+params) | US-009 |
| store/[slug]/cart/remove | DELETE | currentUser | withAuth (+params) | US-009 |
| store/[slug]/orders | GET | currentUser | withAuth (+params) | US-009 |
| store/[slug]/orders/[orderId] | GET | currentUser | withAuth (+params) | US-009 |
| store/[slug]/orders/submit | POST | currentUser | withAuth (+params) | US-009 |

**Notes for US-009:**
- `onboarding` — references `TENANT_ADMIN` but a freshly-provisioned admin may have
  **no `tenantId` yet**, so `withTenantAuth` (which 403s on a missing tenant) would
  break onboarding. Use `withAuth` and keep its own provisioning logic. Confirm.
- `tenant/[slug]` — currently auth-gated read of a tenant by slug; confirm it should
  not instead be public (it sits under `tenant/`, not `tenant-admin/`).
- `account/delete` — references both roles; verify it remains "any logged-in user
  deletes their own account" rather than an admin action.

---

## Needs human decision (1) — flagged, NOT yet allow-listed (US-009)

| Route | Methods | Current | Question |
| --- | --- | --- | --- |
| consultation/submit | POST | getTenantFromRequest + resolveTenant + publicMetadata (no hard user check) | Public storefront intake (anonymous allowed) → `AUTH_PUBLIC_ROUTES`, **or** customers-only → `withAuth`? It resolves the tenant by host and only *optionally* reads the user. **Default-deny:** if anonymous intake is not required, wrap in `withAuth`. Left OFF the allow-list so the gate keeps flagging it until resolved. |

---

## Public allow-list (13) → `AUTH_PUBLIC_ROUTES` (confirm in US-009, NOT wrapped)

Mirrors `lib/auth-public-routes.ts`. Only genuinely public reads + pre-auth +
signature-verified endpoints. Storefront **writes** (cart/orders/submit) are NOT
here — they are `withAuth`.

| Route | Methods | Reason |
| --- | --- | --- |
| health | GET | Liveness/readiness probe; no tenant/user data. |
| webhooks/clerk | POST | Verifies its own Svix signature (PRD-211). |
| webhooks/drgreen/crypto | POST | Verifies its own provider signature (PRD-211). |
| webhooks/drgreen/fiat | POST | Verifies its own provider signature (PRD-211). |
| webhooks/drgreen/status | POST | Verifies its own provider signature (PRD-211). |
| signup | POST | Pre-auth account creation; no session yet. |
| auth/reset-password | POST | Pre-auth password reset; own token + rate-limit. |
| doctor-green/products | GET | Public storefront product feed (host-resolved). |
| tenant/current | GET | Public storefront bootstrap (tenant by host). |
| tenant/conditions | GET | Public storefront read (conditions list). |
| tenant/conditions/[slug] | GET | Public storefront read (single condition). |
| store/[slug]/products | GET | Public storefront read (product list by slug). |
| store/[slug]/products/featured | GET | Public storefront read (featured by slug). |
