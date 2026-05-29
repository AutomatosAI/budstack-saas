# BudStacks → Dr Green Integration Flow

How BudStacks orchestrates the Dr Green API calls. This is our application flow, not the raw API docs (see `DR_GREEN_API_GUIDE.md` for that).

---

## Architecture Overview

```
Browser → Next.js API Routes → Helper Libraries → Dr Green API
                                    ↓
                              Local Postgres DB
                              (orders, carts, users)
```

**Key files:**
| File | Purpose |
|---|---|
| `lib/drgreen-api-client.ts` | Low-level HTTP + ECDSA signing |
| `lib/doctor-green-api.ts` | High-level API methods (fetchProducts, createClient, etc.) |
| `lib/drgreen-client-cart.ts` | clientCartId resolution + Redis caching |
| `lib/drgreen-cart.ts` | Cart operations (add, get, remove, clear) |
| `lib/drgreen-orders.ts` | Order submission (the 3-step flow) |
| `lib/tenant-config.ts` | Loads Dr Green API keys per tenant from DB |

---

## Credentials

Each tenant has their own Dr Green API key + secret key stored encrypted in the `tenants` table. Retrieved via:

```
getTenantDrGreenConfig(tenantId) → { apiKey, secretKey, apiUrl }
```

There are NO global Dr Green credentials. Every API call must pass the tenant's config.

---

## Flow 1: Patient Registration (Consultation Submission)

**Trigger:** User submits consultation questionnaire
**Route:** `POST /api/consultation/submit`

```
1. User fills out medical questionnaire in the storefront
2. BudStacks saves ConsultationQuestionnaire to local DB
3. BudStacks calls POST /dapp/clients/ on Dr Green with:
   - firstName, lastName, email, phone
   - shipping address
   - medicalRecord (mapped from questionnaire answers)
4. Dr Green returns { clientId, kycLink }
5. BudStacks saves:
   - clientId → users.drGreenClientId (this is the Dr Green UUID)
   - kycLink → consultation_questionnaires.kycLink
6. User is redirected to KYC verification link
```

**After this step, the user has a `drGreenClientId` in our DB — required for all cart/order operations.**

---

## Flow 2: Browse Products

**Route:** `GET /api/store/[slug]/products` or `GET /api/doctor-green/products`

```
1. Fetch tenant's Dr Green config
2. Call GET /strains?countryCode={alpha3}&take=100&page=1
3. Normalize each product:
   - Resolve image URLs (relative S3 paths → full URLs)
   - Calculate stock from strainLocations
   - Convert EUR price to local currency via exchange rates
4. Return normalized product list to frontend
```

**Note:** `GET /strains/{id}` doesn't work (auth issue). We fetch the full list and filter client-side.

---

## Flow 3: Add to Cart

**Route:** `POST /api/store/[slug]/cart/add`
**Helper:** `lib/drgreen-cart.ts` → `addToCart()`

```
1. Validate user has drGreenClientId (must have completed consultation)
2. Get clientCartId:
   a. Check Redis cache (key: drgreen:clientCartId:{clientId}, TTL 5 min)
   b. If cache miss → GET /dapp/clients/{clientId} → extract data.clientCart[0].id
   c. If that 401s → GET /dapp/clients?take=200&page=1 → filter by clientId
   d. Cache the result in Redis
3. Call POST /dapp/carts with:
   {
     "items": [{ "strainId": "...", "quantity": <total_grams> }],
     "clientCartId": "<cart-uuid>"   ← NOT clientId!
   }
4. Parse response → sync cart items to local drgreen_carts table
5. Return cart state to frontend
```

**Quantity calculation:** `quantity = userQuantity × sizeInGrams` (e.g. 2 units × 5g = 10)

---

## Flow 4: Place Order

**Route:** `POST /api/store/[slug]/orders/submit`
**Helper:** `lib/drgreen-orders.ts` → `submitOrder()`

This is the critical 3-step flow:

```
Step 0: Get clientCartId
  - Same resolution as Flow 3 (Redis cache → API → list fallback)
  - If null → error "Could not retrieve cart from Dr. Green"

Step 1: Add items to Dr Green cart
  - POST /dapp/carts
  - Body: { items: [{ strainId, quantity }], clientCartId }
  - We re-add items from our local cart to ensure Dr Green's cart matches

Step 2: Place the order
  - POST /dapp/orders
  - Body: { clientId }   ← the client UUID, NOT clientCartId
  - Dr Green converts the current cart into an order server-side
  - Response: { data: { id: "<order-uuid>", invoiceNumber: "..." } }

Step 3: Local cleanup
  - Save order to local orders table with drGreenOrderId
  - Create order_items records
  - Delete local drgreen_carts record
  - Invalidate Redis clientCartId cache (Dr Green may assign new cart)
  - Fire-and-forget: DELETE /dapp/carts/{cartId} to clean up Dr Green side
```

---

## Flow 5: View Orders

**Route:** `GET /api/store/[slug]/orders`

```
1. Query local orders table (we store all order data locally)
2. Optionally sync status from Dr Green:
   - GET /dapp/orders/{drGreenOrderId}
   - If Dr Green says paymentStatus=PAID and we say PENDING → update local
```

---

## Flow 6: Admin Updates Customer Email

**Route:** `PATCH /api/tenant-admin/customers/[id]`

```
1. Validate admin role (TENANT_ADMIN or SUPER_ADMIN)
2. Validate new email format + uniqueness in local DB
3. Sync to Clerk:
   - Find Clerk user by old email
   - Add new email (verified: true)
   - Set new email as primary
   - Remove old email
4. Sync to Dr Green:
   - Find client by stored drGreenClientId, or fallback: list all and match by email
   - PATCH /dapp/clients/{clientId} with { email: newEmail }
5. Update local DB:
   - users.email
   - consultation_questionnaires.email
6. Audit log with sync results for both systems
```

Each sync (Clerk, Dr Green, local) is independent and non-blocking — if one fails, the others still proceed.

---

## Flow 7: Cart Management (Get / Remove / Clear)

**Get cart:** `GET /api/store/[slug]/cart`
```
GET /dapp/carts?orderBy=desc&take=10&page=1&clientId={clientId}
→ Sync response to local drgreen_carts table
```

**Remove item:** `DELETE /api/store/[slug]/cart/remove`
```
DELETE /dapp/carts/{cartId}?strainId={strainId}
Sign body: { cartId, strainId }
→ Then refresh cart from API
```

**Clear cart:** `DELETE /api/store/[slug]/cart/clear`
```
DELETE /dapp/carts/{cartId}
Sign body: { cartId }
→ Delete local drgreen_carts record
```

---

## Data Model (Local DB)

```
users
  ├── drGreenClientId    → Dr Green client UUID (set after consultation)
  └── email, name, etc.

drgreen_carts
  ├── userId, tenantId   → composite unique key
  ├── drGreenCartId      → Dr Green cart UUID (from POST /dapp/carts response)
  └── items (JSON)       → cached cart items with strain data

orders
  ├── drGreenOrderId     → Dr Green order UUID
  ├── drGreenInvoiceNum  → Dr Green invoice number
  ├── status             → PENDING, CONFIRMED, SHIPPED, etc.
  ├── paymentStatus      → PENDING, PAID
  └── order_items[]      → line items with productId, quantity, price

consultation_questionnaires
  ├── email              → patient email (updated if admin changes it)
  ├── kycLink            → Dr Green KYC verification URL
  └── medical fields...
```

---

## Error Handling

- **MISSING_CREDENTIALS** → tenant doesn't have Dr Green API keys configured
- **"User must complete consultation"** → no drGreenClientId on user record
- **"Could not retrieve cart"** → clientCartId resolution failed (both strategies)
- **401 from Dr Green** → usually a signing issue or the GET-by-ID endpoint bug
- **Response shape varies** → we check 6+ nesting patterns for client list responses

---

## Redis Caching

Only one thing is cached: `clientCartId` per client.

```
Key:    drgreen:clientCartId:{clientId}
Value:  the cart UUID string
TTL:    300 seconds (5 minutes)
```

Invalidated after order placement (Dr Green may assign a new cart post-order).
No Redis in dev environment — falls through to API every time.
