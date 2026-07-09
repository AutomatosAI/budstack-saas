# PRD-219 — Admin & Storefront Fulfilment Bug Cluster (Prisma relation names)

> **Status:** Proposed
> **Phase:** R6 — CX Review 2026-07-10 (see [index addendum](./REMEDIATION-INDEX.md#addendum--2026-07-10-cx-review-additions-r6))
> **Severity:** HIGH _(two customer/operator-visible 500s live in production today; both are one-line query bugs with a merged in-repo precedent for the fix — PR #187)_
> **Module(s) touched:** `app/api/tenant-admin/webhooks/route.ts`, `lib/drgreen/drgreen-orders.ts`
> **Depends on:** nothing — execution-ready.
> **Blocks:** PRD-220 AC-B (admin visibility work assumes the admin pages it lands on actually load); smooth day-2 operation for every new tenant.
> **Owner:** Gerard + Claude.
> **Last updated:** 2026-07-10

---

## 1. Problem

The Prisma schema names relations in snake_case (`order_items`, `webhook_deliveries`, `users` — `prisma/schema.prisma:221,627,251,654`), but the API layer deliberately exposes transformed camel/simple names (`items`, `user`, `deliveries`) in its JSON responses. Because `prisma` is exported as `any` from `lib/db.ts`, nothing stops a handler from copying the *response* names back into a Prisma `include`/`select` — which compiles, then throws `PrismaClientValidationError` ("Unknown field `items`") at runtime → 500.

**PR #187 (merged 2026-07-09) fixed one of the three surfaces** — the admin order-status PATCH — and established the fix pattern: rename the `include` keys to the real relation names, then map the result back to the public response shape. Two surfaces remain broken on `main`:

| # | Surface | Bug | Blast radius |
|---|---|---|---|
| 1 | `GET /api/tenant-admin/webhooks` — `app/api/tenant-admin/webhooks/route.ts:30` | `_count: { select: { deliveries: true } }` — relation is `webhook_deliveries` | The **entire tenant-admin Webhooks/Integrations page is dead** (`app/tenant-admin/webhooks/page.tsx` renders from this endpoint and expects `_count.deliveries`) |
| 2 | `getOrder()` — `lib/drgreen/drgreen-orders.ts:375` and `:401` | `include: { items: true }` — relation is `order_items` (the `createOrder()` path in the *same file* already uses `order_items` correctly at `:217–227`) | `GET /api/store/[slug]/orders/[orderId]` **500s for customers** ("Failed to get order"), and the Dr Green **PAID payment-status sync side-effect never runs** (it lives inside the same function, `:397–403`) |

Note the storefront order-confirmation **RSC page** (`app/store/[slug]/orders/[orderId]/page.tsx:20`) queries correctly with `order_items` — so the page shell renders while its API sibling 500s. That asymmetry is exactly how this class of bug hides.

## 2. Users / personas

- **Tenant operator (admin):** cannot open the Webhooks page at all; cannot see delivery counts or manage integrations.
- **Patient / customer:** order-detail fetches fail; payment status shown can stay stale (`PENDING`) even after PayCloud/Dr Green marks the order `PAID`, because the sync path is unreachable.
- **Platform (us):** every new tenant onboarded hits both within their first day of real use.

## 3. User stories

1. As a tenant admin, I open **Tenant Admin → Webhooks** and see my webhooks with delivery counts, not an error state.
2. As a customer, I open my order from the storefront and see current items and payment status.
3. As the platform, when a customer views an order that Dr Green has marked `PAID`, our local `paymentStatus` syncs to `PAID` on that read (existing intended behaviour, currently dead code).

## 4. Acceptance criteria

**AC-1 — Webhooks list loads.** `GET /api/tenant-admin/webhooks` returns 200 with each webhook carrying `_count.deliveries` (mapped from the real `webhook_deliveries` relation count). `app/tenant-admin/webhooks/page.tsx` is **not** changed — the API keeps its public shape, per the #187 precedent.

**AC-2 — `getOrder()` queries the real relation.** Both `include` sites (`drgreen-orders.ts:375,401`) use `order_items`. All three return paths of `getOrder()` (early local return, PAID-sync update return, final return) expose a consistent public shape: `items` populated (mapped from `order_items`), matching what `GET /api/store/[slug]/orders/[orderId]` consumers already expect from the admin GET convention.

**AC-3 — PAID sync works again.** With a Dr Green order in `PAID` and a local row in `PENDING`, calling the store order-detail endpoint updates local `paymentStatus` to `PAID` and returns the updated order.

**AC-4 — Regression guard for the whole class.** A unit test validates, via Prisma DMMF (offline, no DB), that the `include`/`select` relation keys used by the fixed call-sites exist on the corresponding models — and the test is written so new call-sites can be added to its table in one line. _Durable fix (typed Prisma client instead of `any`) stays with PRD-208; cross-referenced there._

**AC-5 — Grep sweep comes back clean.** One pass over `app/` + `lib/` for `include`/`select` blocks referencing `items:`, `user:`, `deliveries:` against models whose relations are snake_case, to confirm these are the last two instances (initial sweep during PRD drafting found no others; the AC is to re-verify at merge time).

## 5. Scope

**In scope:** the two query fixes + response-shape mapping; DMMF regression test; merge-time sweep.

**Out of scope:** renaming Prisma relations to camelCase (schema migration risk for zero CX gain); typing the Prisma client (PRD-208); webhook delivery UX improvements (PRD-215/220).

## 6. Test plan

- Unit: DMMF relation-name test (AC-4).
- Integration (existing harness): webhooks GET returns 200 + `_count.deliveries` for a seeded tenant; store order GET returns 200 with `items[]`; PAID-sync test with mocked `callDrGreenAPI` returning `paymentStatus: "PAID"`.
- Manual on prod after deploy: open Webhooks page on the newest tenant; open a real order detail.

## 7. Rollout

Single PR, no migration, no env change. Deploy = Railway auto-deploy on merge to `main`. Verify the two URLs above immediately after `✓ Ready`.

**Effort:** ~0.5 day including tests.

---

## Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-07-10 | Claude (with Gerard) | Drafted from the 2026-07-10 CX review; scope reduced by PR #187 which shipped the admin order-status PATCH fix and set the fix pattern. |
