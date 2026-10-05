# PRD — BudStacks: capture Dr Green affiliate codes at sign-up

| | |
|---|---|
| **Version** | v1 draft 2026-10-05 |
| **Owner** | Gerard Kavanagh (CTO; owns and releases BudStacks) |
| **Surface** | `budstack-saas` (`nextjs_space/`) |
| **Related** | Dr Green `dr-green-backend/docs/prd/affiliate-codes.prd.md` (US-A04 defines the field); design https://claude.ai/artifact/6X9giM6SSdadKH9oH4d5xk (section C) |
| **Depends on** | Can ship before Dr Green Phase A: the backend strips unknown DTO fields (`ValidationPipe({ whitelist: true })`), so `affiliateCode` is ignored until the backend accepts it. End-to-end verification needs Dr Green Phase A on staging. |
| **Estimate** | 2 engineer-days |

## 0. Status

In progress on `feat/drgreen-affiliate-capture` (from `origin/main` @ `79e0b098`), one commit per story. Typecheck / lint / unit tests have not been run (house rule: nothing executes on the workstation; a PR to `main` is a production deploy). Run before opening the PR: `pnpm -C nextjs_space exec tsc --noEmit && pnpm -C nextjs_space lint && pnpm -C nextjs_space test`.

## 1. Introduction / Overview

A Dr Green KEY holder hands out tracking codes; a customer who arrives at a BudStacks storefront with `?ref=CODE` (or types the code at sign-up) should be linked to it on the Dr Green side. BudStacks only captures and forwards; it stores the code for its own records but makes no decision on it. A code never changes a price.

Verified in code 2026-10-02 (`origin/main` 79e0b098):

- `/store/[slug]/register` client-redirects to `/consultation` and drops the query string (`app/store/[slug]/register/page.tsx:19-24`); `middleware.ts` reads no search params or cookies for attribution; the consultation page reads none.
- `consultationSchema` is a strict `z.object` that strips unknown keys (`app/api/consultation/submit/route.ts:63-132`); the forms spread `formData` (`components/consultation/consultation-form.tsx:124-133`, `id-upload-form.tsx:137-149`).
- Dr Green client payloads are built in `lib/drgreen/kyc-client-payload.ts:114-172` (KYC) and `lib/drgreen-identity.ts:304-344` (SA ID); `consentSource` shows the pattern for an optional attribution field.
- No `referral`/`affiliate`/`utm` handling exists; `users` has `marketingConsentSource` and `title` from BS-302/303 as the nearest precedent.

## 2. Goals

- A `?ref=` on any storefront URL survives to sign-up and is sent to Dr Green with the new client.
- A customer can also type a code on the sign-up form; a typed code wins.
- BudStacks keeps the code on the local user for the tenant admin's reference.

## 3. User stories

### BS-A01: Remember the landing code — ✅ built
**Acceptance Criteria:**
- [x] In `middleware.ts` (or the storefront `app/store/[slug]/layout.tsx` if middleware cannot set cookies on that path), when `?ref=` matches `^[A-Za-z0-9][A-Za-z0-9-]{2,18}[A-Za-z0-9]$`, set cookie `bs_ref` = upper-cased value, 30 days, `SameSite=Lax`, `HttpOnly`, `Secure`, path `/`. Malformed values set nothing. — *Middleware: `withReferralCookie` adds the Set-Cookie to the three storefront page responses only (subdomain rewrite, custom-domain rewrite, path-based `/store/<slug>/…`); rewrite target, headers and CSP unchanged. A layout cannot set cookies in Next 14 (Server Components are read-only), so middleware is the only server-side place. Host-only cookie; `Secure` in production (same rule as the impersonation cookie, so plain-http local dev still works).*
- [x] The `register` → `consultation` redirect preserves the query string so direct `/register?ref=` links work.
- [x] Cookie consent: the cookie is strictly functional (needed to complete the sign-up the visitor started); document it in the cookie policy list in `lib/cookie-utils.ts` under the necessary category. — *There was no list; `STOREFRONT_COOKIES` added (the two consent cookies + `bs_ref`, all `essential`). See §0 on whether "strictly necessary" holds.*
- [x] Unit test for the matcher (`tests/unit/affiliate-referral-cookie.test.ts`: matcher, normalise, set/skip/clear, essential listing).
- [ ] Typecheck/lint passes — *pending: run before the PR (see §0).*

### BS-A02: Sign-up field and forwarding — ✅ built
**Acceptance Criteria:**
- [x] The consultation contact step and the ID-upload form gain an optional "Referral code (optional)" input, pre-filled from `bs_ref` (read server-side and passed as an initial value), with the helper text "Does not change any price." — *Both forms render `ContactDetailsStep`, so the input lives there once. `consultation/page.tsx` reads `?ref=` on the same request first (middleware sets the cookie on that response, so it is not on the request yet), then the `bs_ref` cookie.*
- [x] `consultationSchema` gains `affiliateCode: z.string().regex(...).max(20).optional()`; the route sets `affiliateCodeSource = 'typed'` when the submitted value differs from the cookie, else `'link'`. — *`affiliateCodeField` (`lib/affiliate/affiliate-code-schema.ts`) = `"" | z.string().trim().regex(...).max(20)`, optional. The submitted field is the only source of the code: a customer who clears the pre-filled field sends nothing, cookie or not. Comparison is case-insensitive; the code is forwarded upper-cased.*
- [x] `buildKycClientPayload` and `createSaIdClient` add `affiliateCode` and `affiliateCodeSource` only when present (same shape as `consentSource`). — *Both through `affiliatePayloadFields`: the two keys travel together or not at all.*
- [x] The cookie is cleared on successful sign-up. — *On the 200 response only; a Dr Green refusal keeps it so the retry still carries the code.*
- [x] Unit tests: link-only, typed-overrides-link, malformed-typed-rejected-with-field-error (not a 400 on the whole form), absent = unchanged payload. — *`tests/unit/affiliate-attribution.test.ts`, `consultation-submit-affiliate.test.ts` (route, both paths, cookie cleared/kept), `kyc-client-payload.test.ts` and `drgreen-sa-client.test.ts` (absent = byte-identical payload). Malformed: the form shows the error inline on the input and will not advance until it is fixed or cleared; if one still reaches the route, `parseSignUpWithOptionalAffiliateCode` records the field issue, drops the code and lets the sign-up complete (Dr Green FR-2).*
- [ ] Typecheck/lint passes — *pending (see §0).*
- [ ] Verify in browser after deploy.

### BS-A03: Local record
**Acceptance Criteria:**
- [ ] `users` gains `affiliateCode String?` and `affiliateCodeSource String?` (hand-run SQL per `prisma/schema.prisma:573` convention; additive).
- [ ] Tenant-admin customers table shows the code as a read-only column and the CSV includes it.
- [ ] Verify in browser; typecheck/lint passes.

## 4. Functional requirements

- FR-1: `?ref=` is captured once, validated, and kept 30 days.
- FR-2: Sign-up forwards `affiliateCode` + `affiliateCodeSource` to Dr Green when present; never blocks sign-up.
- FR-3: The code is stored locally for reference only.

## 5. Non-goals

- Any price, discount or reward tied to a code (Dr Green PRD non-goals; CPA s38 risk).
- Capturing a code at checkout for existing customers (Dr Green links at sign-up only).
- Showing marketers anything.

## 6. Technical considerations

- Run `pnpm -C nextjs_space exec tsc --noEmit && pnpm -C nextjs_space lint && pnpm -C nextjs_space test` before the PR; a PR to `main` is a production deploy.
- The orders submit schema is `.strict()`; no change needed since the code is not sent at checkout.

## 7. Success metrics

- A test sign-up via `?ref=TEST-CODE` against Dr Green staging shows the code on the client in the dApp.
