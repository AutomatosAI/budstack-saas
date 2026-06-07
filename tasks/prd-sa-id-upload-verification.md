# PRD — South Africa ID-Upload Verification on Budstacks Tenant Stores

| | |
|---|---|
| **Version** | v1 — Draft, pending review |
| **Date** | 2026-06-07 |
| **Owner** | Gerard Kavanagh (CTO) |
| **Surface** | `budstack-saas` (Next.js multi-tenant storefront) |
| **Related** | `Design: Identity v2 — Secure ID Document Upload (Phase 2)` (Dr Green NestJS backend, branch `feat/identity-v2-sa-id`) |
| **Depends on** | Dr Green identity endpoints deployed to staging **and** Dr Green global `SA_ID_ENABLED` turned on (config, not code — owned by Gerard/legal) |

---

## 1. Introduction / Overview

Today, **every** customer on a Budstacks tenant store must complete the full medical onboarding — the multi-step consultation (`ClientOnboarding.tsx`) plus a First-AML KYC application — before they become orderable. Approval flips Dr Green's `isKYCVerified` flag, and only then does the order gate pass (`orders/submit/route.ts:100`).

South-African law does **not** mandate KYC for cannabis sales, but some stores want it anyway (different provincial rules, their own risk appetite). So this is a **per-tenant choice**, ZA only: a store operator picks **one** of two mutually-exclusive verification modes for all their customers —

- **KYC/AML mode** — today's flow, completely unchanged.
- **ID-Upload mode** — the customer skips the consultation **and** the KYC link, and instead uploads a valid government ID (passport / national ID / driving licence). Dr Green stores it privately, a Dr Green admin reviews it, and approval flips the **same** `isKYCVerified` flag.

Because approval reuses `isKYCVerified`, **the order gate and the KYC status poll need zero changes** — an approved ID looks identical downstream to a passed KYC. Budstacks is a **pure pass-through**: it forwards the upload to Dr Green over the existing storefront auth and **stores no document image and no document number**. All PII custody, review, and storage stay on the Dr Green side.

This PRD is the **Budstacks-side counterpart** to the Dr Green Identity-v2 design doc: the tenant setting, the slim onboarding fork, the upload UI, and the API/signing contract Budstacks consumes from Dr Green. No new Dr Green code is required — the integration uses the existing apiKey + signature storefront auth.

### What changes for the customer

```
BEFORE (every ZA customer, today):
  register → multi-step consultation → apply First-AML KYC
  → [wait / email] → KYC pass → isKYCVerified=true → orderable

AFTER (only when the ZA tenant has chosen ID-Upload mode):
  register (minimal details) → upload a valid ID → "pending review"
  → Dr Green admin approves → isKYCVerified=true → orderable

KYC/AML mode is byte-for-byte unchanged. A tenant runs one mode or the other — never both, never neither.
```

---

## 2. Goals

- Give **ZA tenants** a per-tenant, **mutually-exclusive** choice between **KYC/AML** (today) and **ID-Upload**.
- In ID-Upload mode, let a ZA customer become orderable by uploading a valid ID — skipping the consultation and the KYC link.
- **Reuse `isKYCVerified`** so the order gate (`orders/submit/route.ts:100`) and the KYC poll (`app/actions/kyc-check.ts:119-120`) need **zero** changes.
- Keep Budstacks a **pass-through with zero ID data at rest** — never persist the image or the document number. Dr Green owns storage and review.
- **No new Dr Green code.** Integrate via the existing apiKey + signature storefront path, replicating Dr Green's exact multipart canonicalisation.
- Ship behind flags (Dr Green global `SA_ID_ENABLED` **and** a Budstacks per-tenant toggle), South-Africa-first.

---

## 3. Key Architecture Decisions

These five decisions shape the whole design. They are made here (auto mode) with rationale, verified against the Dr Green `feat/identity-v2-sa-id` source, and restated in **§10 Open Questions** so they can be overridden before build.

### D1 — Budstacks uploads via the existing **apiKey + signature** storefront path; **no Dr Green change** *(not a client JWT)*
The customer uploads to a Budstacks server route; Budstacks forwards the file to Dr Green `POST /api/v1/identity/documents` signed with the tenant's existing secp256k1 key.
- **Why:** Dr Green's `DualAuthGuard` accepts either a login JWT or apiKey + signature (`daap.jwt.strategy.ts:27-115`). Budstacks has no way to mint a Dr Green client JWT (customers are Clerk-authed; Dr Green login is wallet-nonce based — `auth.controller.ts` `/auth/nonce` → `/auth/signIn`), and **no apiKey→JWT exchange exists**. The apiKey path is what Budstacks already uses for every Dr Green call (`lib/drgreen-api-client.ts:222-285`), keeps the secret **server-side**, and — verified in code — the identity service explicitly supports it: when the guard parses multipart it populates `req.files`, and the service falls back to it (`identity.service.ts:71`). So this path works end-to-end with no Dr Green work.
- **Implication:** Budstacks must replicate Dr Green's **exact** multipart signing recipe (see §8.2 / D-crux). The login-JWT path (cleaner, no body signing) is deferred to a future option (§10).

### D2 — Dr Green owns **review and storage**; Budstacks stores **nothing about the document** *(pass-through only)*
Budstacks forwards the upload and forgets it. It never persists the image, the document number, the S3 key, or a presigned URL.
- **Why:** The review endpoints require a Dr Green **admin** JWT with the `ClientVerification` permission (`identity.controller.ts:44-59`, `identity.service.ts:264-275`) — Budstacks tenant admins are Clerk users without that role. Keeping storage + review on Dr Green keeps all ID PII off Budstacks (no new compliance surface).
- **Implication:** Budstacks reads back only `isKYCVerified` via the existing poll. The single piece of local state Budstacks may keep is a **non-PII "ID submitted, pending review" marker** so the customer sees a pending state (the Dr Green doc-list endpoint is admin-only, so the customer cannot query their own document status) — see §8.4 and §10.

### D3 — Verification mode is **per-tenant, ZA-only, and mutually exclusive** *(one or the other, not both/none)*
A ZA tenant sets `verificationMode = "KYC" | "ID_UPLOAD"`. The customer flow forks on it.
- **Why:** Explicit product decision — SA stores self-select based on their own legal posture. Non-ZA tenants are unaffected and never see the option.
- **Implication:** A tenant-admin setting (ZA-only visibility) plus a fork in the registration/onboarding path. Default is **KYC** to preserve today's behaviour until a store opts in.

### D4 — **Reuse `isKYCVerified`**; no changes to the gate, the poll, the schema, or the KYC flow *(SA is the only KYC-bypass market)*
An approved ID sets the identical verified flag a KYC pass sets.
- **Why:** SA is the only country bypassing KYC; reusing the flag means the entire downstream — order gate, status caching, dashboards — is untouched and low-risk.
- **Implication:** "Valid, approved ID == verified." Everything after approval is identical to the KYC path.

### D5 — The customer still becomes a **Dr Green Client**; ID-Upload mode removes the **consultation + KYC link**, not client creation *(slim register, not no register)*
Even in ID-Upload mode, ordering needs a Dr Green `clientId` + cart, and the upload endpoint scopes the document to a client in the caller's NFT (`identity.service.ts:76-82`).
- **Why:** No client record → nothing to attach the document to and nothing to order. What the customer skips is the *medical consultation* and the *First-AML application*, not the client record.
- **Implication / RESOLVED:** A **slim registration** creates the Dr Green client via `POST /dapp/clients` with `verificationType: "ID"` and **no `medicalRecord`**. Dr Green's `feat/identity-v2-sa-id` now makes `medicalRecord` optional on the ID path (`CreateClientDto` `@ValidateIf(o => o.verificationType !== VerificationType.ID)` — `request.dto.ts:549-556`; service skip `client.service.ts:107`; `verification.config.ts`). The skip is honoured **only** when `SA_ID_ENABLED` is on **and** shipping `countryCode === "ZAF"` (ISO-3166 alpha-3 — **not** `"ZA"`). BudStack currently sends `"ZA"`, so US-005 must map ZA→`"ZAF"`. See design doc §5.0 and §10 Q1.

---

## 4. User Stories

Build order is top-to-bottom, risk-first (each story is one focused session). "Verify in browser" = preview deploy or `dev-browser` skill (repo convention, not local execution).

### US-001: Dr Green identity client + exact multipart signing (the risky seam, first)
**Description:** As a developer, I need a typed client that uploads an identity document to Dr Green and signs the request **exactly** the way Dr Green's `DualAuthGuard` verifies it, so everything else can build on a proven seam.

**Acceptance Criteria:**
- [ ] New module `lib/drgreen-identity.ts` exposes `uploadIdentityDocument({ clientId, documentType, documentNumber, file: Buffer, mimeType, config })` → `{ id, documentType, reviewStatus, createdAt }`.
- [ ] A pure helper `buildIdentityUploadSignaturePayload({ clientId, documentType, documentNumber, fileBuffer })` returns the **exact** string Dr Green signs: `JSON.stringify(formData)` where `formData` is the text fields in multipart order **then** `file` last, and `file` is a Node `Buffer` (so it serialises as `{"type":"Buffer","data":[…]}`). This string is **signed**, but the **transmitted** body is `multipart/form-data` — they are deliberately different (see §8.2).
- [ ] Reuses the existing signer `generateDrGreenSignature(payload, secretKey)` (`lib/drgreen-api-client.ts:142`) and sends headers `x-auth-apikey` + `x-auth-signature` + the multipart body. Runs on the **Node runtime** (not Edge) — a `Uint8Array`/`Blob` would serialise differently and fail verification.
- [ ] Unit test **reconstructs the verifier**: it builds `formData` the way `daap.jwt.strategy.ts:182-221` does and asserts our payload string is byte-identical, for both an image and a PDF.
- [ ] Endpoint path + field names isolated and marked `// CONTRACT: Dr Green identity v2` so a contract change is a one-file edit.
- [ ] Typecheck / lint passes.

### US-002: Staging contract validation (kill the integration risk before any UI)
**Description:** As a developer, I want to prove our signed upload is accepted by the **real** Dr Green staging endpoint before building UI on top of it.

**Acceptance Criteria:**
- [ ] A throwaway script (`scripts/_spike/verify-id-upload.ts`, not shipped) signs a sample multipart per US-001 and `POST`s to staging `/api/v1/identity/documents` with a real ZA test client's `clientId`, using a tenant's apiKey/secret.
- [ ] Returns **201 PENDING**; a deliberately wrong MIME returns **400**; flag-off returns **403** — matching the design doc's test guide.
- [ ] Findings recorded in the PR description (any field-order / serialisation gotchas). **Dependency:** Dr Green staging has `STG_SA_ID_ENABLED=true` and a known ZA test client (§10).
- [ ] Gate: US-004+ do not start until this returns 201.

### US-003: Per-tenant verification-mode setting (ZA-only, mutually exclusive)
**Description:** As a ZA store operator, I want to choose KYC/AML **or** ID-Upload for my store.

**Acceptance Criteria:**
- [ ] `verificationMode: "KYC" | "ID_UPLOAD"` stored in the existing `tenants.settings` Json (`prisma/schema.prisma:425`) — **no migration**. Absent/non-ZA ⇒ treated as `"KYC"`.
- [ ] The control renders in `app/tenant-admin/settings/settings-form.tsx` **only** when `tenant.countryCode === "ZA"` (`schema.prisma:428`), as a mutually-exclusive radio (never both, never neither), saved via the existing settings endpoint.
- [ ] Helper `getTenantVerificationMode(tenant)` centralises the read so UI + API share one rule.
- [ ] Verify in browser: a ZA tenant sees the toggle and can switch; a non-ZA tenant never sees it.
- [ ] Typecheck / lint passes.

### US-004: Server proxy upload route (Budstacks → Dr Green), stores nothing
**Description:** As the storefront, I need a server route that takes the customer's file and forwards it to Dr Green, persisting no document data.

**Acceptance Criteria:**
- [ ] New route `POST /api/store/[slug]/verify/id-document` — auth = the Clerk session customer (401 otherwise).
- [ ] Guards: tenant is ZA **and** `verificationMode === "ID_UPLOAD"` **and** the global flag is on (US-007); else 4xx with clear copy.
- [ ] Validates the file server-side (mirror Dr Green: `image/jpeg | image/png | application/pdf`, ≤ 10 MB) and that `documentType ∈ {ID, PASSPORT, DRIVING_LICENCE}` and `documentNumber` ≤ 100 chars.
- [ ] Resolves the customer's Dr Green `clientId` (via `users.drGreenClientId`, same as `kyc-check.ts`); calls `uploadIdentityDocument` (US-001) with the tenant's Dr Green config.
- [ ] Persists **nothing about the document** — only an optional non-PII `pending` marker (D2 / §8.4). Returns sanitized `{ status: "PENDING" }` (no key, no URL, no number).
- [ ] Errors go through `apiError(...)` (never leak Dr Green internals — mirror `shop/register/route.ts:160-168`).
- [ ] Unit test: happy path returns PENDING and stores no doc data; wrong MIME / oversize / wrong-mode / no-client return the right codes.
- [ ] Typecheck / lint passes.

### US-005: Slim ID-Upload registration (fork on mode; skip the consultation)
**Description:** As a ZA customer of an ID-Upload store, I want a short sign-up that doesn't make me fill in the consultation.

**Acceptance Criteria:**
- [ ] When the tenant is in `ID_UPLOAD` mode, the registration path collects only what `createClient` + shipping need (personal details + shipping address) and **omits the consultation/medical steps**.
- [ ] Extends `createClient` (`lib/doctor-green-api.ts:578`) to send `verificationType: "ID"`, shipping `countryCode: "ZAF"` (map ZA→ZAF), and **omit `medicalRecord`** on the ID path. Verified Dr Green accepts this on `feat/identity-v2-sa-id` (`request.dto.ts:549-556`, `client.service.ts:107`). The skip requires `SA_ID_ENABLED` on **and** `countryCode === "ZAF"` — sending `"ZA"` causes a 400 ("medical record required").
- [ ] KYC mode keeps the existing `ClientOnboarding` wizard untouched.
- [ ] Verify in browser: ID-Upload tenant → short form, no consultation; KYC tenant → existing wizard.
- [ ] Typecheck / lint passes.

### US-006: Customer upload UI + pending/verified status
**Description:** As a ZA customer, after the slim sign-up I want to upload my ID and see where I stand.

**Acceptance Criteria:**
- [ ] An upload component (file picker + `documentType` select + `documentNumber`) with **client-side** pre-checks mirroring the server (jpeg/png/pdf, ≤ 10 MB) for fast feedback; server remains source of truth.
- [ ] Surfaces in two places: as the final step of the slim registration (US-005) and as a "Verify your identity" card on the dashboard (`app/store/[slug]/dashboard/page.tsx`) for un-verified returning customers in ID-Upload mode.
- [ ] After a successful upload: show **"Pending review — no auto-approval"**; the customer becomes orderable only once the existing poll reports `isKYCVerified` (`kyc-check.ts`). On a Dr Green **reject**, Dr Green emails the customer; the same upload UI lets them re-upload (no new endpoint).
- [ ] Uses tenant theme tokens (`--tenant-color-*`) and is mobile-first, consistent with `ClientOnboarding`.
- [ ] Verify in browser: upload → pending; (after a simulated approve) → orderable.
- [ ] Typecheck / lint passes.

### US-007: Flags + gating (global mirror + per-tenant + ZA + mutual exclusivity)
**Description:** As the platform, I want ID-Upload shown only when it will actually work.

**Acceptance Criteria:**
- [ ] Budstacks env flag `SA_ID_UPLOAD_ENABLED` mirrors Dr Green's global `SA_ID_ENABLED` so we never show an upload path that Dr Green would 403 (the Dr Green flag is global, not per-tenant, and not readable by us).
- [ ] ID-Upload UX is shown only when `SA_ID_UPLOAD_ENABLED` **and** tenant is ZA **and** `verificationMode === "ID_UPLOAD"`. Otherwise the KYC/consultation flow is used, unchanged.
- [ ] Mutual exclusivity enforced server-side (a tenant can't be in both modes); the order gate and KYC poll are confirmed **unmodified**.
- [ ] Verify in browser: flag off ⇒ ID-Upload hidden everywhere (ZA tenants fall back to KYC); flag on + ZA + ID_UPLOAD ⇒ shown.
- [ ] Typecheck / lint passes.

### US-008: Tests — unit + E2E
**Description:** As a developer, I want the new path covered and the old path protected.

**Acceptance Criteria:**
- [ ] Unit (≥ 80 % on new modules): signing-payload reconstruction (US-001), proxy-route validation + mode/flag gating + "stores nothing" (US-004), `getTenantVerificationMode` (KYC default, ZA-only), slim-register medicalRecord handling (US-005).
- [ ] Regression: an explicit test asserts the order gate and `checkUserKycStatus` are unchanged for KYC-mode tenants.
- [ ] E2E (Playwright): ID-Upload ZA tenant → slim register → upload ID → "pending" → (simulate Dr Green approve / `isKYCVerified=true`) → customer can place an order. And: KYC-mode tenant flow still works end-to-end.
- [ ] Tests run in CI (not locally).

---

## 5. Functional Requirements

- **FR-1** A ZA tenant must be able to select exactly one verification mode (`KYC` or `ID_UPLOAD`) in tenant-admin; non-ZA tenants must not see the option and are always `KYC`.
- **FR-2** In `ID_UPLOAD` mode, the customer registration must omit the consultation/medical steps and still create a Dr Green client sufficient to order and ship (D5).
- **FR-3** The customer must be able to upload an ID (`ID | PASSPORT | DRIVING_LICENCE`) + document number; Budstacks must validate type/size (`image/jpeg|image/png|application/pdf`, ≤ 10 MB) server-side before forwarding.
- **FR-4** Budstacks must forward the upload to Dr Green `POST /api/v1/identity/documents` using apiKey + signature, signing the **exact** canonical payload Dr Green verifies (§8.2).
- **FR-5** Budstacks must persist **no** document image, number, S3 key, or preview URL; at most a non-PII pending marker.
- **FR-6** After upload, the customer must see a "pending review" state; they become orderable **only** when the existing poll reports `isKYCVerified` (no auto-approval, no new status source).
- **FR-7** Approval/verification must flow through the **unchanged** `isKYCVerified` path — the order gate (`orders/submit/route.ts:100`) and `checkUserKycStatus` are not modified.
- **FR-8** ID-Upload must be offered only when `SA_ID_UPLOAD_ENABLED` (Budstacks) **and** tenant ZA **and** `verificationMode === "ID_UPLOAD"`; otherwise the KYC/consultation flow is used unchanged.
- **FR-9** A rejected document must let the customer re-upload via the same flow (Dr Green sends the re-upload email).
- **FR-10** Budstacks must hold **no** ID-document storage/KMS credentials; all storage, encryption, presigned previews, and review stay in Dr Green.

---

## 6. Non-Goals (Out of Scope)

- **OCR / MRZ checksum / face-match / automated fake-detection.** Dr Green Phase 3 (self-hosted, no PII egress).
- **Budstacks storing or displaying the ID image or document number**, or generating presigned previews.
- **Budstacks-side admin review of IDs.** Dr Green owns review (admin JWT + `ClientVerification`).
- **Any change to `isKYCVerified` semantics, the order gate, the KYC poll, or the consultation/First-AML flow** for KYC-mode tenants.
- **Non-ZA markets.** Everything outside ZA keeps the current KYC/consultation flow; no toggle is shown.
- **The login-JWT upload path / wallet-nonce login** (Option B) — deferred (§10).
- **Document-expiry capture, re-upload caps** — Dr Green open questions, not Budstacks.
- **Removing First-AML / the consultation.** Both remain for KYC-mode and non-ZA tenants.

---

## 7. Design Considerations

- **Reuse onboarding styling + theme tokens.** The upload UI must use the same `Card`/`Button`/`Form` components and `--tenant-color-*` vars as `ClientOnboarding.tsx`, so each tenant's branding holds.
- **"Pending review" is explicit.** No auto-approval; copy must say a human review is required and the customer will be emailed. Mirror the existing "Registration Submitted" completion screen tone.
- **Slim register is genuinely short.** Personal + shipping only; don't reintroduce medical fields by habit.
- **Reassuring reject copy.** "Your ID couldn't be verified (e.g. blurry photo). Please upload a clearer copy." Re-upload uses the same component.
- **Mobile-first** (repo convention) for both the slim register and the dashboard verify card.

---

## 8. Technical Considerations

### 8.1 Current seams (Budstacks)
| Concern | Location |
|---|---|
| KYC status poll (reused, unchanged) | `app/actions/kyc-check.ts:119-120` |
| Order gate (reused, unchanged) | `app/api/store/[slug]/orders/submit/route.ts:100` |
| Client onboarding wizard (KYC mode) | `components/shop/ClientOnboarding.tsx` (ZA already listed `:78`) |
| Register → `createClient` | `app/api/shop/register/route.ts` (`medicalRecord` required `:26`) |
| Dr Green client lib | `lib/doctor-green-api.ts` (`createClient :578`, `fetchClient :450`) |
| Dr Green auth/signing (extend for multipart) | `lib/drgreen-api-client.ts:142` (`generateDrGreenSignature`), `:222-285` (`callDrGreenAPI`) |
| Tenant settings (Json, no migration) | `tenants.settings` (`prisma/schema.prisma:425`); `countryCode` (`:428`) |
| Tenant-admin settings form | `app/tenant-admin/settings/settings-form.tsx` |
| Safe API error wrapper | `lib/api-error.ts` (`apiError`) |

### 8.2 Dr Green identity contract (verified from `feat/identity-v2-sa-id`)
Budstacks uses **only** `POST /api/v1/identity/documents`. The admin list/review endpoints are Dr Green's.

**The signing crux (D-crux).** `DualAuthGuard.verifyPayload` (`daap.jwt.strategy.ts:170-242`) handles multipart by:
1. parsing the form with `formidable`; each text field → `formData[name] = fields[name][0]` (a string), in body order;
2. each file → read into a **Node `Buffer`**, `formData[name] = buffer` (files looped **after** fields, so `file` is always last);
3. `data = JSON.stringify(formData)` — **this string is what's signed**;
4. `verifySignature` (`:261-273`): `apiKey` = base64(PEM **public** key); `crypto.createVerify("SHA256").update(data).verify(PEM, base64(signature))`.

So Budstacks must sign:
```
JSON.stringify({ clientId, documentType, documentNumber, file })
   // text fields in send-order, file LAST, file is a Node Buffer
   // → serialises as {"clientId":"…","documentType":"ID","documentNumber":"…",
   //                   "file":{"type":"Buffer","data":[…bytes…]}}
```
…with `generateDrGreenSignature` (SHA-256 + secp256k1 DER — already compatible with Node's verifier), and **transmit a multipart body** carrying the same fields. **Key subtlety:** unlike every existing call where the signed string *is* the JSON body, here the **signed string ≠ the transmitted body**. Run on the Node runtime (Buffer serialisation). The identity service reads the guard-populated `req.files` when multer is bypassed (`identity.service.ts:71`), so the apiKey path is fully supported.

### 8.3 Budstacks proxy route (proposed)
```
POST /api/store/[slug]/verify/id-document        (Clerk session customer)
body:  multipart/form-data { file, documentType, documentNumber }
server: validate → resolve users.drGreenClientId → tenant Dr Green config
        → uploadIdentityDocument(...) → forward to Dr Green
200:    { status: "PENDING" }            // sanitized; nothing about the doc stored
4xx:    wrong mode / not ZA / flag off / bad file / no client
```

### 8.4 Data model
**No migration.** `tenants.settings.verificationMode` holds the mode. **No document data is stored** (D2). The only open local state is a non-PII **pending marker** so the customer sees "pending review" (the Dr Green doc-list is admin-only). Options (pick in §10): (a) reuse the existing `consultation_questionnaires` row's status plumbing that `kyc-check.ts` already understands as `PENDING`; (b) a single `users.idUploadPendingAt` timestamp. Both are non-PII and compatible with "store nothing about the document."

### 8.5 Two-flag dependency
- **Dr Green global `SA_ID_ENABLED`** (per-environment, owned by Dr Green/legal) decides whether uploads are *accepted at all* (`identity.service.ts:64`). Budstacks cannot set it.
- **Budstacks `SA_ID_UPLOAD_ENABLED` + per-tenant `verificationMode`** decide whether the UI is *shown*.
Both must align; the Budstacks env mirror prevents showing a path Dr Green would 403.

### 8.6 Verification reflection (unchanged)
After Dr Green approves, `isKYCVerified` flips; `checkUserKycStatus` already detects `isKYCVerified === true || adminApproval === 'VERIFIED'` and caches it (`kyc-check.ts:119-175`). No new polling.

---

## 9. Success Metrics

- **ID-Upload adoption:** number of ZA tenants choosing ID-Upload mode.
- **Time-to-verified** for ID-Upload customers drops from KYC/First-AML timescales (days) to review-turnaround (minutes–hours).
- **Upload → approved conversion** on ID-Upload stores.
- **Zero ID data at rest in Budstacks** — no image, number, key, or preview in Budstacks DB/logs (verified in code review).
- **Zero regression** to the KYC path: order gate + `checkUserKycStatus` behaviour identical for KYC-mode tenants (asserted by test).

---

## 10. Open Questions / Decisions to Confirm

1. **SA client creation — RESOLVED (design doc §5.0, implemented on `feat/identity-v2-sa-id`).** Create the SA client via `POST /dapp/clients` with `verificationType: "ID"`, shipping `countryCode: "ZAF"`, and **no `medicalRecord`**. Dr Green makes the record optional on the ID path (`request.dto.ts:549-556` `@ValidateIf`, `client.service.ts:107`, `verification.config.ts` `SA_COUNTRY_CODE="ZAF"`). The skip fires only when `SA_ID_ENABLED` on **and** `countryCode === "ZAF"` (ISO-3 — BudStack sends `"ZA"` today, must map to `"ZAF"`, else 400). *Side-check still open: confirm whether today's `ClientOnboarding → /api/shop/register` path actually creates clients (its partial record cast to `any`, `shop/register/route.ts:136-142`, would otherwise hit the KYC-path `medicalRecord` requirement).*
2. **Pending marker — RESOLVED (Gerard, 2026-06-07):** keep a non-PII "pending review" marker **just like KYC** — reuse the `consultation_questionnaires` status plumbing that `kyc-check.ts` already reads as `PENDING`. After a successful upload (and at slim-register time) ensure a minimal row exists so the customer sees "pending" and the verified-cache path works unchanged. No document data stored.
3. **Dr Green `SA_ID_ENABLED` rollout:** who flips it on staging/prod and when (legal sign-off gates prod per the design doc)? US-002 needs it **on in staging** + a known ZA test client.
4. **Budstacks flag mirror (US-007):** confirm `SA_ID_UPLOAD_ENABLED` env mirror vs assuming-on for ZA. *Default: env mirror.*
5. **Document types:** offer all three (`ID | PASSPORT | DRIVING_LICENCE`)? *Default: all three.*
6. **Default mode for ZA tenants:** `KYC` until they opt in? *Default: KYC.*
7. **Minimal required fields** for an orderable + shippable ZA client (DOB? full shipping?) — confirm against Dr Green client + shipping requirements.
8. **Login-JWT path (deferred):** worth asking Dr Green for a storefront→client-JWT exchange later to drop multipart signing entirely? *Default: defer; D1 needs nothing from them.*

---

## 11. Appendix — References

- Dr Green design doc: `dr-green-identity-v2/docs/design/identity-v2-id-upload.design.md` (branch `feat/identity-v2-sa-id`).
- Dr Green identity module: `src/identity/identity.controller.ts`, `src/identity/identity.service.ts`, `src/identity/kms-crypto.service.ts`.
- Dr Green auth guard / **signing recipe**: `src/strategy/daap.jwt.strategy.ts:170-273` (multipart canonicalisation + `verifySignature`).
- Dr Green flag gate: `src/identity/identity.service.ts:64` (`isSaIdVerificationEnabled`).
- Budstacks signing to extend: `lib/drgreen-api-client.ts:142` (`generateDrGreenSignature`), `:222-285` (`callDrGreenAPI`).
- Budstacks reused-unchanged: `app/actions/kyc-check.ts`, `app/api/store/[slug]/orders/submit/route.ts:100`.
- Budstacks register / onboarding to fork: `app/api/shop/register/route.ts`, `components/shop/ClientOnboarding.tsx`.
- Sibling PRD (format + Dr Green integration pattern): `tasks/prd-paycloud-direct-checkout.md`.

---

## 12. Implementation notes (as built — 2026-06-07)

Deviations from the assumptions in the body above, discovered while building:

- **Real registration seam = the consultation flow, not `shop/register`.** `register/page.tsx` redirects to `/consultation`; the live endpoint is `POST /api/consultation/submit` (it creates the Clerk user, the local `users` row, the questionnaire, calls Dr Green `/dapp/clients`, **and persists `users.drGreenClientId`**). `components/shop/ClientOnboarding.tsx`, `/api/shop/register`, and `doctor-green-api.ts createClient` (→ `/client`, a route that doesn't exist on Dr Green) are **dead code**. The fork was applied to `/api/consultation/submit`.
- **Client create:** new `createSaIdClient` (`lib/drgreen-identity.ts`) → `/dapp/clients` with `verificationType:"ID"` + shipping `countryCode:"ZAF"` (via the existing `toAlpha3`) + no `medicalRecord`. Verified implemented on Dr Green `feat/identity-v2-sa-id`.
- **Pending state is UI-derived (no migration).** `consultation_questionnaires` requires `password` + ~15 fields and ID-mode customers have a `drGreenClientId` (so they bypass `kyc-check`'s questionnaire-PENDING branch). Instead: the dashboard shows the upload card for unverified ID-mode customers, and "pending review" after a successful upload. A future `users.idDocumentStatus` column could distinguish "not-uploaded" vs "uploaded-pending" on return.
- **Auth flow:** slim register → "log in" → dashboard upload (decoupled; no mid-flow Clerk sign-in). The upload route is Clerk-authed.
- **Order gate + `checkUserKycStatus` untouched** → KYC-mode tenants are unaffected (regression guarantee by non-modification).

**Files added:** `lib/drgreen-identity.ts`, `lib/verification-mode.ts`, `app/api/store/[slug]/verify/id-document/route.ts`, `app/actions/verification-mode.ts`, `components/shop/IdDocumentUpload.tsx`, `components/shop/IdUploadRegistration.tsx`, `scripts/_spike/verify-id-upload.ts`, unit tests + `tests/sa-id-upload.spec.ts` (E2E scaffold).
**Files changed:** `app/api/consultation/submit/route.ts` (ID fork), `app/api/tenant-admin/settings/route.ts` + `app/tenant-admin/settings/settings-form.tsx` (toggle), `app/store/[slug]/consultation/page.tsx` + `app/store/[slug]/dashboard/page.tsx` (entry + card).

**Verification status:** 22 new unit tests green (incl. an offline crypto round-trip proving the signature); `tsc` + `lint` clean. **Outstanding:** (1) US-002 — run the spike against Dr Green staging (`STG_SA_ID_ENABLED=true` + ZA test client); (2) browser QA of the UI on a preview deploy (Clerk + tenant context can't run locally); (3) set `SA_ID_UPLOAD_ENABLED=true` on Budstacks once Dr Green's flag is on.
