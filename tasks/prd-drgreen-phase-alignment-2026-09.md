# PRD — BudStacks alignment with the Dr Green September 2026 phases

| | |
|---|---|
| **Version** | v2 — 2026-09-18 (v1 draft 2026-09-17) |
| **Owner** | Gerard Kavanagh (CTO; owns and releases BudStacks) |
| **Surface** | `budstack-saas` (Next.js multi-tenant storefront, `nextjs_space/`) |
| **Related** | Dr Green phased plan `dr-green-backend/docs/prd/2026-09-phased-plan.md`; Phase 2 `phase-2-identity-validation-comms.prd.md`; Phase 3 `phase-3-consent-salutation.prd.md`; Phase 4 `phase-4-order-integrity.prd.md` |
| **Depends on** | Dr Green backend releases per phase (see each story's "needs backend" note). BudStacks stories marked *independent* can ship first. |
| **Compatibility** | BudStacks is a single deployment Gerard controls, so no version skew. The Dr Green backend strips unknown DTO fields (`ValidationPipe({ whitelist: true })`, `src/main.ts:75-78`), so new optional fields sent early are ignored, never rejected. |
| **Branch** | `feat/drgreen-phase-alignment-2026-09` (from `origin/main` @ `edb35005`): `9659646e` Phase 2 · `ba56f136` Phase 3 · `4f0bd38f` Phase 4 |

---

## 0. Status (2026-09-18)

All eleven stories are built on the branch above, one commit per phase, with unit tests. Not yet done, and why:

- **Typecheck / lint / unit tests have not been run.** Nothing is executed on the workstation (house rule); CI on this repo runs only on a PR to `main`, and a PR here merges instantly, so opening one is a production deploy. Run before opening the PR: `pnpm -C nextjs_space exec tsc --noEmit && pnpm -C nextjs_space lint && pnpm -C nextjs_space test`.
- **Browser verification** (every "Verify in browser" AC) needs a deployed build; BudStacks has no staging, so it happens on the LekkerWeed/HealingBuds tenants after the deploy, against a test account.
- **BS-205 staging confirmation** needs Dr Green Phase 2 US-208 (link resolution) on Dr Green staging; not released.
- **BS-304 end-to-end** needs Dr Green Phase 3 US-302 (`PATCH /dapp/clients/:id/marketing-consent`); until then the toggle is local-first and reports `forwarded: false`.
- **Consent copy** is the legal placeholder (`lib/customers/marketing-consent.ts`), one constant to change when Ricardo/legal confirm.

### Corrections found in code while building (v1 → v2)

1. **Dr Green's vector file did not exist** (`docs/design/sa-id-test-vectors.json`) and the backend has no validator yet. BudStacks authored the 29 synthetic vectors; the canonical copy is written to `dr-green-backend/docs/design/sa-id-test-vectors.json` (uncommitted on `develop`, beside the phase PRDs) and Dr Green US-201 / plugin 1.3.0 must adopt it, not the other way round.
2. **`users.marketingConsentAt` already existed** (Email Phase 2, US-023) and is the consent test for four readers — campaign audience, saved segments, newsletter unsubscribe, tenant-admin toggle. `consultation_questionnaires` never had a consent column, so there was nothing to backfill. The v1 AC's separate `marketingConsent Boolean` was **not** added (two columns for one fact is how a withdrawn customer gets mailed); Phase 3 adds `marketingConsentSource` and `title` only.
3. **Campaign sending was already consent-only** (`lib/email/campaign-audience-query.ts` → `marketingConsentAt: { not: null }`, `segment-query.ts` the same, the recipients export lists rows materialised from that audience; newsletter subscribers are a separate double-opt-in). BS-305's "campaign sending" clause needed documentation, not code.
4. **`IdUploadRegistration.tsx` does not exist.** The shop path is `components/shop/ClientOnboarding.tsx` → `POST /api/shop/register`, which posted to Dr Green `/client` — a route no controller serves — and is not rendered by any page. It is fixed to `/dapp/clients` and carries consent/title, but it is dead UI today.
5. **Tenant country is not in `getTenantDrGreenConfig`** (keys + URL only). The SA rule keys off `isSaIdEligibleTenant(tenant)` (`tenant.countryCode === "ZA"`), which is what PRD §6 asked for anyway.
6. **`package.json` had no `version`.** One was added (`1.0.0`) for the capability header; `APP_VERSION` overrides.
7. **The consultation submit route was 793 lines against an 800-line lint ceiling.** The KYC client-payload builder was lifted to `lib/drgreen/kyc-client-payload.ts` (behaviour-preserving, unit-tested) to make room.

## 1. Introduction / Overview

The Dr Green September 2026 review produced six phases. Three of them touch the storefront: identity validation and communications (Phase 2), marketing consent and salutation (Phase 3), and catalogue integrity (Phase 4). This PRD is the BudStacks counterpart for those three. Phases 0 and 1 are WordPress, dApp and backend only; Phase 5 is paused.

BudStacks stays a pure pass-through for identity documents: it validates, forwards, and stores nothing about the document. Nothing in this PRD changes that.

### What changes for the customer

- Typing a South African ID number that cannot be valid is caught on the form, before anything is uploaded, with one clear message.
- Registration asks how they wish to be addressed and whether they want marketing, unticked by default. They can change the marketing choice in their store settings.
- Products that cannot be ordered no longer appear on the storefront.

### What changes for the tenant admin

- The customers table and its CSV export show consent, with a "Consented only" filter. Campaign recipients are limited to consented customers (already the case; now documented and visible).

### Verified in code 2026-09-17 (v1), corrected 2026-09-18 where noted

- Document uploads originate from `components/consultation/steps/id-upload-step.tsx` (via `id-upload-form.tsx`), `components/shop/IdDocumentUpload.tsx` (orphaned — no page renders it) and `components/shop/ReUploadIdDocument.tsx`; they reach Dr Green through `app/api/store/[slug]/verify/id-document/route.ts` and the inline `idDocument` object in `app/api/consultation/submit/route.ts`. `lib/drgreen-identity.ts` builds the upload headers by hand.
- BudStacks sends no email on ID upload, so Dr Green's new "ID received" email will be the only one.
- The consultation contact step already had an unticked marketing-consent checkbox stored on **`users.marketingConsentAt`** (not on the questionnaire — v1 was wrong) and never forwarded. The shop onboarding schema had only a terms `consent` field; the shop register route created the Dr Green client with `createClient` against a dead endpoint and forwarded no consent.
- `fetchProducts` called `/strains` through `doctorGreenRequest`, which already signs with the tenant key; `normalizeProduct` checked the strain-level `isActive` only when a strain had no locations.
- `orders.shippingInfo Json?` already snapshots the delivery address at submit, so Dr Green's Phase 4 address snapshot needs no BudStacks change.

## 2. Goals

- Same SA ID rules and the same error copy as Dr Green and the WordPress plugin, proven by one shared vector file.
- BudStacks always gets Dr Green's strict validation by declaring itself with the capability header.
- Consent and title captured on every registration path and forwarded to Dr Green; withdrawable by the customer.
- Tenant marketing tooling respects consent.
- Storefront catalogue matches what Dr Green will accept at order time.

## 3. User stories

### Phase 2 alignment — identity

#### BS-201: SA ID validator and shared vectors *(independent)* — ✅ built
**Description:** As a developer, I need one validator so both upload routes and all three upload components apply the same rules.

**Acceptance Criteria:**
- [x] `lib/verification/sa-id.ts` exports `validateSouthAfricanId(input)` returning `{ valid: true, normalised }` or `{ valid: false, reason: 'length' | 'digits' | 'date' | 'citizenship' | 'checksum' }`. Rules: strip spaces; 13 digits; digits 1–6 a real date in the 1900s or 2000s not in the future (either century accepted); digit 11 in {0,1,2}; Luhn over all 13. Digit 12 not enforced. Checks run in that order; the first failure is the reason.
- [x] `lib/verification/__tests__/sa-id-vectors.json` — 29 synthetic vectors (9 valid, 20 invalid, every reason and the check order covered); `tests/unit/sa-id.test.ts` runs every vector and fails if any disagrees. Canonical copy written to `dr-green-backend/docs/design/sa-id-test-vectors.json` for US-201/US-203 to adopt. No real number in either repo.
- [ ] Typecheck/lint passes — *pending: run before the PR (see §0).*

#### BS-202: Enforce in both upload routes *(independent)* — ✅ built
**Description:** As the storefront, I refuse an impossible ID number before uploading it.

**Acceptance Criteria:**
- [x] The verify proxy's meta schema is built per request with `superRefine(saIdDocumentRefinement(enforce))`; the consultation submit applies the same refinement to the parsed `idDocument` once the tenant is known, **before** any account, questionnaire or Dr Green client exists. `enforce` = `isSaIdEligibleTenant(tenant)` and `documentType === "ID"`.
- [x] Failure returns 400 `{ code: "SA_ID_INVALID", error: "That does not look like a valid South African ID number. Check the 13 digits and try again." }` and records **no** `UPLOAD_FAILED` outcome (tests).
- [x] Passport and driving licence, and non-SA tenants, are unaffected (tests on both routes). A valid number is forwarded space-stripped.
- [ ] Typecheck/lint passes — *pending.*

#### BS-203: Inline form validation and error display *(independent)* — ✅ built, browser check pending
**Acceptance Criteria:**
- [x] `id-upload-step.tsx`, `IdDocumentUpload.tsx` and `ReUploadIdDocument.tsx` validate on blur and on submit when the selected type is ID (`saIdFieldError`), showing the same copy inline on the number field.
- [x] The ID option is labelled "South African ID" (`validateSaId` prop, default on — these components only mount on ID-upload tenants, which are ZA-only by construction).
- [x] A 400 with `code: "SA_ID_INVALID"` from either route, or from Dr Green through the proxy, is shown inline on the number field rather than as the generic failed-upload banner (`id-upload-form.tsx` keeps the customer on step 3).
- [ ] Verify in browser (LekkerWeed/HealingBuds after deploy; no staging).
- [ ] Typecheck/lint passes — *pending.*

#### BS-204: Capability header on Dr Green calls *(independent; needed for Dr Green strict mode)* — ✅ built
**Acceptance Criteria:**
- [x] `lib/drgreen/client-version.ts` → `X-DRG-Client: budstacks/<version>` on every call: `callDrGreenAPI` (all JSON/GET calls, so `doctorGreenRequest`, `createSaIdClient`, `switchClientToIdVerification`, consent) and the multipart `uploadIdentityDocument`. Version from `package.json` (`APP_VERSION` overrides), sanitised to Dr Green's `[A-Za-z0-9./_-]`, ≤64 chars.
- [x] Outside the signed payload: `tests/unit/drgreen-client-header.test.ts` verifies the JSON, query-string and multipart signatures against the payload Dr Green reconstructs, with the header present.
- [x] Dr Green's `SA_ID_INVALID` from the proxy is mapped to the same 400 and recorded as `UPLOAD_FAILED` with the customer copy; `kyc-check` surfaces it (allow-listed copy only) and the dashboard shows "Reason: …" beside the re-upload card.
- [ ] Typecheck/lint passes — *pending.*

#### BS-205: Re-upload link lands on the tenant dashboard *(config, no code)* — 🟡 documented, staging pending
**Acceptance Criteria:**
- [x] `docs/guides/SUPER_ADMIN_MANUAL.md` → "South African ID-upload tenants — Dr Green key checklist": the key must list the storefront host (and custom domain) in its allowed return hosts on the Dr Green dApp Keys page; wildcards are skipped by the resolver.
- [ ] Confirmed on staging: a rejected customer on a tenant with no branding lands on `https://<tenant host>/dashboard` — *needs Dr Green Phase 2 US-208 on staging (not released).*

### Phase 3 alignment — consent and salutation

#### BS-301: Forward consent, source and title to Dr Green *(safe to ship early)* — ✅ built
**Acceptance Criteria:**
- [x] All three client-create paths send `title`, `marketingConsent` and `consentSource`: consultation submit KYC branch (`buildKycClientPayload`, `"budstacks-consultation"`), `createSaIdClient` (`"budstacks-id-upload"`), shop register `createClient` (`"budstacks-shop-register"`). `marketingConsent` is always a boolean (explicit true only); `title`/`consentSource` only when set.
- [x] No conditional code; Dr Green strips the fields until US-301/302 is released.
- [ ] Typecheck/lint passes — *pending.*

#### BS-302: Marketing consent on every registration path *(independent; copy gated on legal)* — ✅ built (AC corrected)
**Acceptance Criteria:**
- [x] Shop onboarding (`onboarding-schema.ts` medical step, `MedicalStep.tsx`) gains an optional `marketingConsent` beside the required terms `consent`; the consultation path keeps its checkbox.
- [x] ~~`users.marketingConsent Boolean`~~ **Corrected:** `users.marketingConsentAt` already is the consent test; added `users.marketingConsentSource String?` (migration `20260918000000_phase3_title_consent_source`, idempotent). No backfill needed.
- [x] Copy = `marketingConsentCopy(storeName)` — "Keep me informed about products and offers from {store name} by email or SMS" (placeholder until legal confirms; SMS inclusion open).
- [ ] Verify in browser.
- [ ] Typecheck/lint passes — *pending.*

#### BS-303: Title field *(independent)* — ✅ built
**Acceptance Criteria:**
- [x] Optional title select (Mr, Mrs, Ms, Mx, Dr, Prof — `lib/customers/titles.ts`, one constant) on the consultation contact step and the shop personal-details step; stored on `users.title`; forwarded per BS-301.
- [ ] Verify in browser.
- [ ] Typecheck/lint passes — *pending.*

#### BS-304: Customer consent toggle in store settings *(needs backend Phase 3 US-302)* — ✅ built (local-first)
**Acceptance Criteria:**
- [x] `app/store/[slug]/settings/page.tsx` shows "Marketing emails and SMS" with the current state and a Switch.
- [x] `GET`/`PATCH /api/store/[slug]/consent` (`withAuth`) resolves the caller's own row and `drGreenClientId`. **Decision:** the local column is written first and unconditionally (a withdrawal never depends on a partner API), the audit row is written, then Dr Green `PATCH /dapp/clients/:clientId/marketing-consent` is called best-effort; 404/409 are mapped to a customer-safe `warning` in a 200 response with `forwarded: false` (the route is not on Dr Green production yet, and BudStacks campaigns are BudStacks' own exposure).
- [x] Route tests mirror the switch-to-id tests (grant, withdraw, Dr Green 404 and 409, local-only account, bad body, 401/404).
- [ ] Verify in browser.
- [ ] Typecheck/lint passes — *pending.*

#### BS-305: Tenant admin respects consent *(independent)* — ✅ built
**Acceptance Criteria:**
- [x] `customers-table.tsx`: Marketing column, "Consented only" filter (`?consent=yes`, server-side `marketingConsentAt: { not: null }`), consented-count pill; the CSV export includes "Marketing consent" (yes/no) and "Consent given" and, because it exports the on-screen page, honours the filter.
- [x] Campaign sending and `campaigns/[id]/recipients/export` — **verified already consent-only** (`campaign-audience-query.ts` `consentedCustomers`, `segment-query.ts`, recipients materialised from that audience; `tests/unit/campaign-audience.test.ts` "reads consented customers only"). No change; the help guide (`lib/documents/guides/customers.ts`) now says so.
- [x] Anonymised (erased) customers: `buildAnonymizedUserData` nulls `marketingConsentAt`, `marketingConsentSource`, `title` (test).
- [ ] Verify in browser (tenant admin).
- [ ] Typecheck/lint passes — *pending.*

### Phase 4 alignment — catalogue

#### BS-401: Storefront reads the filtered catalogue *(independent)* — ✅ built
**Acceptance Criteria:**
- [x] `fetchProducts` calls `/dapp/strains` with the same query (`countryCode` alpha-3, `orderBy`, `take`, `page`); `doctorGreenRequest` already signs.
- [x] A strain-level `isActive === false` is **delisted** (filtered out of the list), and `normalizeProduct` gates both the location and the legacy no-location branch on it.
- [x] The product-detail fallback (cached list) still resolves; an inactive strain is absent from listing and detail (`tests/unit/fetch-products-catalogue.test.ts`).
- [ ] Verify in browser.
- [ ] Typecheck/lint passes — *pending.*

No BudStacks change for Dr Green's order address snapshot (BudStacks already stores `orders.shippingInfo` at submit) or for the order-rejection email (Dr Green emails the customer directly).

## 4. Functional requirements

- FR-1: SA ID validation applies only to document type ID on South African tenants, with the shared rules and copy.
- FR-2: Every Dr Green call from BudStacks carries `X-DRG-Client`.
- FR-3: Every registration path captures consent (default false) and title and forwards them.
- FR-4: Customers can change consent from store settings; the change reaches Dr Green when its endpoint exists, and always takes effect locally.
- FR-5: Tenant marketing tools and exports are limited to consented customers.
- FR-6: The storefront catalogue excludes inactive and unavailable products.

## 5. Non-goals

- Storing document images or numbers on BudStacks (unchanged pass-through).
- Deriving anything from the ID number; no date of birth, sex or citizenship.
- Exposing ID numbers in any tenant export.
- Courier tracking (Dr Green Phase 5 is paused).
- A retrospective consent campaign for existing customers (operations decision).
- Reviving the orphaned shop onboarding UI (`ClientOnboarding.tsx`); it is fixed and consent-aware but no page renders it.

## 6. Technical considerations

- The `/identity/documents` signature is computed over the multipart fields; the header is added to the fetch headers only and never enters that payload (tested).
- Tenant country comes from the tenant row (`isSaIdEligibleTenant`), not from the customer's address.
- Dr Green strips unknown fields, so BS-301 deploys before the backend without errors; consent only persists on Dr Green once Phase 3 US-301/302 are on production.
- The title list is one constant (`lib/customers/titles.ts`) reused by both forms and both routes; the consent copy and sources are one module (`lib/customers/marketing-consent.ts`).
- `marketingConsentAt` stays the single consent test; `marketingConsentSource` is attribution only.
- The consultation submit route sits at 758 lines against the 800-line lint ceiling; put new logic in lib modules, not the route.

## 7. Success metrics

- Zero `SA_ID_INVALID` responses from Dr Green for BudStacks uploads after BS-202 ships (all caught on the form).
- Every new registration carries an explicit consent value.
- Campaign recipient counts equal consented counts.
- Zero "not active" 409s at order submit from storefront carts.

## 8. Open questions

- Final consent copy and whether SMS is included (Ricardo/legal) — one constant to change.
- Whether existing customers are asked for consent on next login.
- ~~Current behaviour of campaign sending with respect to consent~~ — verified consent-only (BS-305).
- Whether the "ID received" email should also be mirrored as a dashboard status on BudStacks (today the local `UPLOADED` flag already covers it).
- Whether BS-304 should retry a failed Dr Green forward (a sweep) once US-302 is released, or whether the next customer toggle is enough.
