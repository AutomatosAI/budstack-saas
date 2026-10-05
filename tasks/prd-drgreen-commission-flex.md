# PRD — BudStacks: Dr Green Commission Flex readiness

| | |
|---|---|
| **Version** | v2 — 2026-10-05 (built; v1 draft the same day) |
| **Owner** | Gerard Kavanagh (CTO; owns and releases BudStacks) |
| **Surface** | `budstack-saas` (Next.js multi-tenant storefront, `nextjs_space/`) |
| **Related** | Dr Green `dr-green-backend/docs/prd/commission-flex.prd.md` and `order-line-price-snapshot.prd.md`; design https://claude.ai/artifact/6X9giM6SSdadKH9oH4d5xk (section B "What changes, by repo") |
| **Depends on** | Nothing. BS-F01..F03 fix defects that exist today and must be live **before** any BudStacks tenant's KEY uses Flex. BS-F04 needs Dr Green Flex Phase A on production. |
| **Compatibility** | BudStacks is one deployment. Dr Green Flex changes no field names: the storefront's price arrives in `retailPrice` and `strainLocations[].retailPrice` as today, already reduced for the tenant's KEY. |
| **Estimate** | 2–3 engineer-days (BS-F01..F03) + 0.5 d (BS-F04) |
| **Branch** | `feat/drgreen-flex-readiness` (from `origin/main` @ `79e0b098`), one commit per story |

---

## 0. Status (2026-10-05)

BS-F01 is built on the branch above with unit tests. Not yet done, and why:

- **Typecheck / lint / unit tests have not been run.** Nothing is executed on the workstation (house rule); CI on this repo runs only on a PR to `main`, and a PR here merges instantly, so opening one is a production deploy. Run before opening the PR: `pnpm -C nextjs_space exec tsc --noEmit && pnpm -C nextjs_space lint && pnpm -C nextjs_space test`.
- **Browser verification** (every "Verify in browser" AC) needs a deployed build; BudStacks has no staging, so it happens on the LekkerWeed/HealingBuds tenants after the deploy, against a test account.

### Corrections found in code while building (v1 → v2)

1. **GET `/dapp/carts` ignores `clientId`.** `GetCartsDto` has only `search` (plus pagination), the whitelist strips the rest, and the list is every client of the key with a non-empty cart, newest first, ten per page (`dr-green-backend src/carts/carts.service.ts getCartList`). `getCart` read `data.clients[0]` — whichever customer of the store touched a cart last — and wrote that cart into the signed-in user's `drgreen_carts` mirror. Fixed with `pickClientCart(response, clientId)` (`lib/drgreen/delivery-quote.ts`), used by `getCart` and the new quote.
2. **There was no "existing checkout quote path".** Nothing in BudStacks read `localPrices.deliveryCharge`, and the catalogue (`/dapp/strains`) does not carry the delivery charge. Added `GET /api/store/[slug]/checkout/quote` (signed `GET /dapp/carts?search=<email>`, picked by client id). **Expect "Calculated by Dr Green" on most checkouts:** BudStacks keeps the basket in the browser and only pushes it to Dr Green at submit, and Dr Green empties the server cart when an order is created, so the customer usually has no server cart to quote from. Showing the real charge every time needs either a Dr Green delivery-quote endpoint (e.g. `deliveryCharge` on the `/dapp/strains` location select) or pushing the basket to Dr Green's cart at checkout load — see §8.

## 1. Introduction / Overview

Dr Green will let a KEY holder lower the price on their own storefront by keeping less commission. The catalogue a BudStacks tenant fetches with its own key will then carry that tenant's price. Three things in BudStacks assume one price for everyone and have to change first; they are wrong today as well, just less visibly.

Verified in code 2026-10-02 (`origin/main` 79e0b098):

- The basket lives in the browser (`lib/cart-store.ts`, zustand persisted to localStorage `budstack-cart`, no TTL) with `price` captured at add-to-cart. Cart, dropdown and checkout totals are `price × quantity` client-side (`cart-store.ts:79-85`); the "Place Order" button total excludes delivery.
- Order submit sends the browser's prices (`app/store/[slug]/checkout/page.tsx:157-176`), the route reconciles availability but does not re-price (`app/api/store/[slug]/orders/submit/route.ts:159-183`), and the local order row is priced from the client-sent values (`lib/drgreen/drgreen-orders.ts:144, 191-234`). `syncOneOrder` never syncs totals (`lib/orders/storefront-orders.ts:96-131`). So order history, confirmation, analytics revenue and packing slips show storefront-computed totals, not what Dr Green charged.
- `fetchProduct`'s 60-second in-memory cache is keyed `${country}:${config.apiUrl}` (`lib/drgreen/doctor-green-api.ts:381-398`), with no tenant or key in the key. With per-KEY prices, one tenant's product page metadata and JSON-LD `Offer.price` could show another tenant's price for up to 60 s.
- `normalizeProduct` already prefers `strainLocations[0].retailPrice` + `location.currency` (`doctor-green-api.ts:275-297`), so the list and product pages pick up a changed price on the next request (`app/api/store/[slug]/products/route.ts` is `force-dynamic`).
- A dormant `-X% OFF` badge keys on `product.discount` (`app/store/[slug]/products/[id]/product-detail-client.tsx:222-232`); Dr Green never sends `discount`.

## 2. Goals

- The amount a customer sees at checkout is the amount Dr Green will charge, line by line, plus Dr Green's delivery charge.
- Local order rows, history, confirmation, analytics and packing slips carry Dr Green's totals.
- No tenant can ever be served another tenant's price from a cache.
- Nothing on a BudStacks storefront presents a price as a discount.

## 3. User stories

### BS-F01: Re-price the basket at checkout — ✅ built
**Description:** As a customer, I want the checkout total to be the price I will be charged, even if a price changed since I added the item.

**Acceptance Criteria:**
- [x] The checkout page fetches the live catalogue (`/api/store/[slug]/products`) on load and whenever the basket changes, and shows each line at the live price; a line whose price differs from the stored basket price shows "Price updated" once and the basket store is updated to the live value. — `lib/checkout/reprice-basket.ts` (pure merge), `app/store/[slug]/checkout/use-checkout-pricing.ts` (fetch keyed on `basketSignature`, so writing the live price back does not refetch), new `replaceItems` on `lib/cart-store.ts`. Place Order is disabled while prices are being checked.
- [x] A product no longer listed is removed from the basket with a message, before submit (today it is dropped silently server-side). Also removes a listed product that is no longer orderable (`isAvailable`/`in_stock` false), which the submit route drops too.
- [x] The order summary shows subtotal, Dr Green's delivery charge (from the server cart `localPrices.deliveryCharge` ~~via the existing checkout quote path~~ via a new `GET /api/store/[slug]/checkout/quote` — there was no existing quote path, see §0 correction 2 — or "calculated by Dr Green" when unavailable) and the total; the Place Order button shows the total including delivery (or "+ delivery" when Dr Green has not quoted it). Summary extracted to `checkout-order-summary.tsx` (page was 777 lines).
- [x] Unit test for the re-price merge (`tests/unit/checkout-reprice-basket.test.ts`, `tests/unit/delivery-quote.test.ts`).
- [ ] Typecheck/lint passes — *pending: run before the PR (see §0).*
- [ ] Verify in browser on a tenant after deploy (no staging) with a test account.

### BS-F02: Local order row priced from Dr Green's response
**Description:** As a tenant admin and a customer, I want order history to show what was charged.

**Acceptance Criteria:**
- [ ] `submitOrder` (`lib/drgreen/drgreen-orders.ts`) prices `order_items.price` and `orders.subtotal/total` from Dr Green's order response (`totalAmount`, `deliveryCharge`, and per-line `localPrice.productAmount` from `GET /dapp/orders/:id` when the create response lacks lines), never from the request body. The client-sent `strain.retailPrice` is ignored for pricing (kept only for the product name/image fallback).
- [ ] `syncOneOrder` also mirrors `totalAmount` and `deliveryCharge` into `subtotal`, `shippingCost`, `total` when they differ (Dr Green is the source of truth).
- [ ] Analytics revenue (`app/api/tenant-admin/analytics/route.ts`) needs no change once rows are correct; confirm with a test fixture.
- [ ] Unit tests: response-priced row; mismatch between client price and Dr Green price → Dr Green wins and the difference is logged at warn.
- [ ] Typecheck/lint passes.

### BS-F03: Tenant-scoped product cache
**Acceptance Criteria:**
- [ ] `fetchProduct` cache key includes the tenant's API key id or tenant id: `${tenantKey}:${country}:${config.apiUrl}`; `invalidateProductCache()` keeps clearing everything.
- [ ] Platform-key fallback tenants (`lib/tenant/tenant-config.ts:85-90`) share the platform key's cache entry, which is correct (they get the platform key's price).
- [ ] Unit test: two configs, same country, different keys → independent entries.
- [ ] Typecheck/lint passes.

### BS-F04: No discount presentation
**Acceptance Criteria:**
- [ ] Remove the `-X% OFF` badge in `product-detail-client.tsx` (or hard-disable it); add a code comment pointing at the Dr Green Flex PRD non-goals.
- [ ] Grep the storefront for strike-through price styling (`line-through` near a price) and remove any found.
- [ ] Verify in browser; typecheck/lint passes.

## 4. Functional requirements

- FR-1: Checkout totals are computed from the live catalogue and Dr Green's delivery charge.
- FR-2: Local order rows are written and synced from Dr Green's totals.
- FR-3: Product cache entries are tenant-scoped.
- FR-4: No was/now, badge or percentage-off appears on any storefront price.

## 5. Non-goals

- Any tenant-admin UI for Flex (the holder sets it in the Dr Green dApp).
- Multi-currency display changes; `lib/exchange-rates.ts` stays as the FX fallback.
- Removing the localStorage basket.

## 6. Technical considerations

- CI runs only on a PR to `main` and a PR merges instantly, so run `pnpm -C nextjs_space exec tsc --noEmit && pnpm -C nextjs_space lint && pnpm -C nextjs_space test` before opening the PR (house rule: nothing runs on the workstation).
- The orders submit schema is `.strict()` at the top level with `cartItems[].passthrough()`; BS-F02 can drop the `strain` object from what the client sends once the server no longer reads prices from it.
- `prisma/schema.prisma:573`: migrations are hand-run SQL; none is needed here.

## 7. Success metrics

- For every new order, `orders.total` equals Dr Green's `totalAmount + deliveryCharge` for the same order.
- Zero product-page `Offer.price` values that differ from the tenant's own catalogue price.

## 8. Open questions (added while building)

- **Delivery quote source (BS-F01).** Dr Green has no per-market delivery quote a storefront can read before an order exists; the server cart only has one while it holds items. Options: (a) Dr Green adds `deliveryCharge` to the `location` select of `/dapp/strains` (one line, no shape change for other consumers); (b) BudStacks pushes the basket to `POST /dapp/carts` on checkout load (side effects on Dr Green's cart; the submit path already re-pushes). (a) is the clean one. Until then checkout shows "Calculated by Dr Green" and the Place Order button says "+ delivery".
