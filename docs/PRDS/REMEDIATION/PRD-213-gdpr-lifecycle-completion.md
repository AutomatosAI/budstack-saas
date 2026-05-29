# PRD-213 — GDPR Lifecycle Completion (Clerk `user.deleted` wiring, DPA click-through, audited erasure/export)

> **Status:** Proposed
> **Phase:** R5 — Customer Readiness
> **Severity:** HIGH _(GDPR/UK-GDPR exposure on a PHI + payments platform. Not an open auth hole, but a regulator-facing gap: the right-to-erasure path that the self-service endpoint promises is **not honoured for Clerk-side deletions**, and onboarding records no Data Processing Agreement.)_
> **Module(s) touched:** `app/api/webhooks/clerk/route.ts`, `app/api/account/delete/route.ts`, `app/api/account/export/route.ts`, `app/onboarding/onboarding-form.tsx`, `app/api/onboarding/route.ts`, `lib/audit-log.ts`, `lib/redact.ts`, `prisma/schema.prisma` (DPA-acceptance fields), a new `lib/gdpr/erasure.ts`
> **Depends on:** PRD-211 (encryption hardening — erasure must purge/rotate the encrypted Dr Green client linkage cleanly) and PRD-208 (audit table immutability) — both **soft**; this PRD works against the current `audit_logs` model.
> **Blocks:** First paying enterprise customer + any GDPR/DPA line in a security questionnaire.
> **Owner:** Gerard + Claude. Legal/DPO sign-off: Gerard's DPO advisor.
> **Last updated:** 2026-05-29

---

## 1. Problem

BudStacks already ships **most** of a GDPR lifecycle — the gaps are at the edges, and one of them is a hard right-to-erasure violation.

1. **Clerk `user.deleted` webhook is a no-op (HIGH — Article 17 violation).** `app/api/webhooks/clerk/route.ts:127-136` handles the `user.deleted` event by logging a string and returning 200:
   ```ts
   if (eventType === "user.deleted") {
     const { id } = evt.data;
     // … we match by email and delete event might not have it …
     console.log("User deleted event received. Manual cleanup might be required …");
   }
   ```
   When a user is deleted in Clerk (admin action, account-closure, or Clerk-side GDPR request), **nothing happens in our database** — their email, name, phone, address, and Dr Green client linkage persist indefinitely in `users`. The self-service `DELETE /api/account/delete` path *does* anonymise correctly, but any deletion originating in Clerk silently leaves PII behind. This is the headline finding.
2. **No DPA click-through at onboarding (HIGH — Article 28).** A `/dpa` page exists (`app/dpa/page.tsx`), but `app/onboarding/onboarding-form.tsx` contains **zero** terms/DPA/consent acceptance control (grep for `terms|agree|dpa|consent|checkbox` returns nothing). A tenant becomes a data controller deploying our processor infrastructure without ever recording acceptance of the Data Processing Agreement. There is no timestamp, no version, no audit row proving the agreement was accepted. (This is the legal PRD's **US-001** requirement.)
3. **Erasure/export are audited individually but not via one canonical, log-purging flow (MEDIUM).** `DELETE /api/account/delete` and `GET /api/account/export` both already call `createAuditLog(...)` (`lib/audit-log.ts`, actions `ACCOUNT_DELETED_GDPR_SELF` / `ACCOUNT_DATA_EXPORTED`) and use `apiError()` from `lib/api-error.ts` — so the first-pass "not centrally audited" framing is **partly stale**. The real gaps are: (a) the two routes duplicate the resolve-user / anonymise / audit logic that the Clerk webhook now also needs, so it must be lifted into one shared `lib/gdpr/erasure.ts`; (b) erasure anonymises the DB row but **does not address PII already written to plaintext logs** (owned by PRD-215) — erasure is incomplete while log sinks retain emails/KYC fields; (c) admin-assisted deletion via `app/api/tenant-admin/customers/[id]/route.ts` must run the same audited path.
4. **Erasure does not sever the Dr Green linkage (MEDIUM).** The self-service delete nulls local PII but leaves `drGreenClientId` populated, so the anonymised record still points at a live external medical profile. Erasure must record (and, where the Dr Green API supports it, request) downstream deletion, and at minimum drop the local linkage so the anonymised user cannot be re-identified through it.

This PRD: wires `user.deleted` to a real audited erasure handler; adds a versioned DPA click-through to onboarding with an audit row; consolidates erasure/export into one tested `lib/gdpr/erasure.ts`; and closes the Dr Green linkage + cross-references PRD-215 for log redaction.

## 2. Users / personas

| Role | How they benefit |
|---|---|
| **Storefront customer (data subject)** | Deletion in Clerk actually erases their PII; export returns a complete, audited copy of their data |
| **Tenant admin (data controller)** | Records a signed DPA at onboarding; assisted customer-deletion uses the same audited erasure path |
| **Gerard / DPO** | Can produce an audit trail for any erasure/export and prove DPA acceptance per tenant |
| **Enterprise prospect** | "How do you handle right-to-erasure and the DPA?" has a demonstrable, audited answer |

## 3. User stories

- As a **data subject**, when my account is deleted (whether I click delete, an admin removes me, or Clerk deletes me), my personal data is anonymised everywhere we control it, and the event is recorded.
- As a **tenant**, I cannot complete onboarding without accepting the current DPA version, and that acceptance is stored with a timestamp.
- As the **DPO**, for any erasure or export I can retrieve an immutable `audit_logs` row showing who, when, what, and from which IP — with PII in the metadata redacted by `lib/redact.ts`.
- As a **regulator**, the erasure flow demonstrably removes the local Dr Green linkage so an anonymised record cannot be re-identified.

## 4. Acceptance criteria

**Clerk `user.deleted` wiring:**

- [ ] **AC-1** `app/api/webhooks/clerk/route.ts` `user.deleted` branch calls the new `eraseUser({ clerkUserId, reason: "clerk_user_deleted" })` from `lib/gdpr/erasure.ts` instead of logging a string. It resolves the local user by Clerk id first, falling back to the stored email, and anonymises whatever it finds.
- [ ] **AC-1a** To make Clerk-id resolution reliable, the `user.created`/`user.updated` branch persists the Clerk user id on the local record (a `clerkUserId String? @unique` column, or the existing `id` convention `user_${id}` — decided in §13 OQ-1). Erasure no longer depends on the delete payload carrying an email.
- [ ] **AC-1b** If no local user is found, the handler records an `audit_logs` row (`action: "account.erasure_noop_user_not_found"`) rather than silently returning — so a missed mapping is visible, not invisible.

**DPA click-through at onboarding:**

- [ ] **AC-2** `app/onboarding/onboarding-form.tsx` adds a required DPA-acceptance control (checkbox + link to `/dpa`) that blocks submission until checked. The submit payload carries `dpaVersion` and `dpaAcceptedAt`.
- [ ] **AC-2a** `app/api/onboarding/route.ts` Zod-validates the DPA fields, rejects creation if `dpaVersion` is missing or not the current version, and persists `dpaAcceptedVersion` + `dpaAcceptedAt` (+ accepting user id) on the tenant.
- [ ] **AC-2b** A `createAuditLog({ action: "tenant.dpa_accepted", entityType: "Tenant", … })` row is written on acceptance, with the DPA version in metadata.

**Consolidated, audited erasure/export:**

- [ ] **AC-3** A new `lib/gdpr/erasure.ts` exports `eraseUser(opts)` and `exportUser(opts)`. The existing `DELETE /api/account/delete` and `GET /api/account/export` are refactored to call these — no duplicated resolve/anonymise/audit logic. Behaviour (anonymisation marker, order/consultation FK retention, rate limits, `confirm: "DELETE"`) is preserved exactly.
- [ ] **AC-3a** `app/api/tenant-admin/customers/[id]/route.ts` DELETE (admin-assisted erasure) calls `eraseUser({ … reason: "admin_assisted" })` so all three erasure entry points (self, admin, Clerk) share one audited path.
- [ ] **AC-3b** Every erasure/export writes an `audit_logs` row via `createAuditLog` with PII in metadata redacted by `lib/redact.ts` (already the case for the existing two routes — assert it holds for all three entry points).

**Sever the Dr Green linkage:**

- [ ] **AC-4** `eraseUser` nulls `drGreenClientId` (and any other external-provider linkage on `users`) as part of anonymisation, and records in the audit metadata whether a downstream Dr Green deletion was requested/possible (`drGreenLinkageCleared: true`, `drGreenRemoteDeletionRequested: boolean`). Where the Dr Green API exposes a delete/anonymise endpoint, call it best-effort (never blocking local anonymisation — same pattern as the existing Clerk teardown at `account/delete/route.ts:94-105`).

**Erasure completeness across logs (cross-PRD):**

- [ ] **AC-5** This PRD references PRD-215 for the structured-logger + redaction work and asserts the dependency in the erasure runbook: erasure is only "complete" once PII is no longer written to plaintext logs (PRD-215) and log retention is bounded. No PII-bearing `console.*` is introduced by this PRD's code.

## 4.1 Design framework conformance

One new UI surface: the DPA-acceptance control in the onboarding form. It must use existing form primitives (checkbox + link), match the onboarding form's current styling, and add no template-specific values.

- [ ] **AC-6** DPA checkbox uses the existing form/checkbox primitives; no new tokens.
- [x] Data-driven template rule respected — DPA text is platform-level legal copy (linked `/dpa`), not tenant template content.
- [x] No hardcoded tenant/template values added to platform code.

## 5. Scope

**In scope:** wire `user.deleted` → `eraseUser`; persist Clerk id for reliable mapping; DPA click-through + tenant DPA-acceptance fields + audit row; `lib/gdpr/erasure.ts` consolidation of self/admin/Clerk erasure + export; sever Dr Green linkage on erasure.

**Out of scope:**
- Structured logger + PII redaction in plaintext logs → **PRD-215** (this PRD depends on it for erasure completeness but does not build it).
- Encryption versioned-key handling for the Dr Green linkage → **PRD-211**.
- Audit-table DB-level immutability trigger / hash chain → **PRD-208** (this PRD relies on the application-level immutability policy already documented in `lib/audit-log.ts`).
- Cookie-consent / marketing-consent management (separate from the Article 28 DPA) → out of suite.

## 6. Non-functional requirements

| NFR | Requirement |
|---|---|
| Compliance | Erasure honours GDPR Art. 17; export honours Art. 15/20; DPA records Art. 28 acceptance |
| Auditability | Every erasure/export/DPA-acceptance writes one immutable, PII-redacted `audit_logs` row |
| Reliability | Clerk teardown / Dr Green remote deletion are best-effort and never block the legally-significant local anonymisation |
| Data minimisation | Anonymised records retain only what tenants are legally required to keep (orders/consultations via FK), with all direct identifiers nulled |
| Idempotency | `eraseUser` is safe to call twice (e.g. self-delete then Clerk webhook) — second call is a no-op that still audits |

## 7. Success metrics

- `user.deleted` webhook anonymises the matching local user in 100% of test cases (previously 0%).
- 100% of erasure/export/DPA events produce an `audit_logs` row (verified in integration tests).
- 0 onboarding completions without a recorded `dpaAcceptedVersion` post-ship.
- 0 anonymised users retain a non-null `drGreenClientId`.
- 0 PII-bearing `console.*` lines introduced (CI grep gate, shared with PRD-215).

## 8. API surface

| Method | Path | Change |
|---|---|---|
| POST | `/api/webhooks/clerk` | `user.deleted` now performs audited erasure (no external contract change) |
| DELETE | `/api/account/delete` | Refactored onto `eraseUser`; behaviour unchanged |
| GET | `/api/account/export` | Refactored onto `exportUser`; behaviour unchanged |
| DELETE | `/api/tenant-admin/customers/[id]` | Admin-assisted erasure now routes through `eraseUser` |
| POST | `/api/onboarding` | Requires + persists `dpaVersion` / `dpaAcceptedAt`; rejects stale/missing DPA |

No new public endpoints. All error paths use `apiError()` from `lib/api-error.ts`.

## 9. Data model changes

| Model | Change |
|---|---|
| `users` | Add `clerkUserId String? @unique` (if not adopting the `user_${id}` convention — OQ-1) to make `user.deleted` mapping reliable |
| `tenants` | Add `dpaAcceptedVersion String?`, `dpaAcceptedAt DateTime?`, `dpaAcceptedByUserId String?` |

Migration is additive (nullable columns) — no backfill required, though existing tenants should be prompted to accept the DPA on next admin login (tracked in §13 OQ-3). Erasure nulls `drGreenClientId` (existing column) — no schema change for that.

## 10. Events emitted / consumed

| Event | Direction | Payload | Subscribers |
|---|---|---|---|
| `account.deleted_gdpr_self` | emit (audit) | `{ targetUserId, clerkDeleted, drGreenLinkageCleared }` | `audit_logs` |
| `account.erasure_clerk_user_deleted` | emit (audit) | `{ clerkUserId, matchedLocalUser: boolean }` | `audit_logs` |
| `account.erasure_admin_assisted` | emit (audit) | `{ targetUserId, actingAdminId }` | `audit_logs` |
| `account.data_exported` | emit (audit) | `{ recordCounts }` | `audit_logs` |
| `tenant.dpa_accepted` | emit (audit) | `{ tenantId, dpaVersion }` | `audit_logs` |

(`createAuditLog` is the sink today; PRD-215 may later forward these to an alerting/event channel.)

## 11. UI / UX

- **Onboarding form:** a required DPA-acceptance checkbox with an inline link to `/dpa`. Submit is disabled until checked. On a stale DPA version the API rejects with a vetted message routed via `apiError()`.
- **Account settings (existing):** no change to the self-service delete/export UI; only the backend is consolidated.

## 12. Test plan

**Unit (Vitest — stood up in PRD-207):**
- `gdpr-erasure.test.ts` — `eraseUser` nulls all direct identifiers + `drGreenClientId`, retains order/consultation FKs, is idempotent, and writes an audit row; `exportUser` returns the expected shape and audits.
- `redact.test.ts` (extend) — erasure/DPA audit metadata is redacted (emails/names/phones stripped) by `sanitizeForLogging`.
- `onboarding-dpa.schema.test.ts` — Zod rejects missing/stale `dpaVersion`; accepts the current version.

**Integration (testcontainers Postgres — PRD-207):**
- `clerk-user-deleted.route.test.ts` — posting a signed `user.deleted` event anonymises the matching local user and writes the audit row; an unmatched id writes the `erasure_noop_user_not_found` row.
- `account-erasure.integration.test.ts` — self, admin, and Clerk entry points all converge on the same anonymised end-state and each audit.
- `onboarding-dpa.integration.test.ts` — onboarding without DPA acceptance is rejected; with it, tenant persists `dpaAcceptedVersion` + audit row.

**E2E (Playwright):**
- `gdpr-erasure.spec.ts` — a seeded customer deletes their account; assert the profile is anonymised and login is revoked.
- `onboarding-dpa.spec.ts` — onboarding submit is blocked until the DPA checkbox is ticked.

**Coverage target:** 95% on `lib/gdpr/erasure.ts` (compliance-critical); 90% on the DPA onboarding path.

## 13. Open questions

- [ ] **OQ-1** Clerk-id mapping — add a dedicated `clerkUserId @unique` column, or rely on the existing `id = user_${clerkId}` convention used in the webhook? Owner: Gerard. Resolution: prefer a dedicated nullable unique column for clarity and to decouple from the id format; backfill from `id` where it matches the convention.
- [ ] **OQ-2** Does the Dr Green API expose a client delete/anonymise endpoint, or only deactivation? Owner: Gerard (Dr Green integration). Resolution: if delete is unavailable, record `drGreenRemoteDeletionRequested: false` + clear local linkage; document the residual-data position in `/dpa`.
- [ ] **OQ-3** How are **existing** tenants prompted to accept the DPA (no acceptance on file)? Owner: Gerard + DPO. Resolution: gate tenant-admin on a one-time DPA-acceptance modal on next login; record the same audit row.
- [ ] **OQ-4** Retention window for anonymised order/consultation records (legal-hold duration)? Owner: DPO. Resolution: document the retention period in `/dpa` and the erasure runbook; out-of-band cleanup job enforces it (per `lib/audit-log.ts` retention policy).

## 14. Dependencies

**Strict:** None — can begin against the current schema.

**Soft:**
- **PRD-211** — encryption versioned-key flow so severing the Dr Green linkage does not orphan encrypted key material.
- **PRD-215** — structured logger + PII redaction; erasure is only *complete* once PII stops being written to plaintext logs. This PRD must reference PRD-215 in the erasure runbook.
- **PRD-208** — DB-level audit immutability (trigger/hash chain) strengthens the audit trail this PRD relies on.
- **PRD-207** — Vitest + testcontainers harness for the tests above.

## 15. Estimated effort

- **`user.deleted` wiring + Clerk-id mapping/migration:** 5 hours
- **`lib/gdpr/erasure.ts` consolidation (self/admin/Clerk + export) + Dr Green linkage:** 8 hours
- **DPA click-through (form + API + schema fields + audit):** 6 hours
- **Tests (unit + integration + E2E):** 9 hours
- **Erasure runbook + DPA-version doc + DPO review loop:** 4 hours
- **Total:** ≈ 32 hours (≈ 4 days for 1 dev + Claude pair)

## 16. References

- Existing code: `app/api/webhooks/clerk/route.ts:127-136` (the no-op), `app/api/account/delete/route.ts` (audited anonymisation; `apiError` + `createAuditLog`), `app/api/account/export/route.ts` (audited export), `lib/audit-log.ts` (`createAuditLog`, `AUDIT_ACTIONS.ACCOUNT_DELETED_GDPR_SELF`/`ACCOUNT_DATA_EXPORTED`, immutability policy), `lib/redact.ts` (`sanitizeForLogging`), `app/onboarding/onboarding-form.tsx` (no DPA control), `app/api/onboarding/route.ts`, `app/dpa/page.tsx`, `prisma/schema.prisma` (`tenants` model `:418`, `users` model)
- Standards: GDPR Art. 15 (access), Art. 17 (erasure), Art. 20 (portability), Art. 28 (processor/DPA); [Clerk webhook events](https://clerk.com/docs/integrations/webhooks/overview) (`user.deleted`)
- Cross-PRD: PRD-215 (logger + PII redaction — erasure completeness), PRD-211 (encryption + Dr Green linkage), PRD-208 (audit immutability)
- Legal: existing legal PRD requirement **US-001** (DPA at onboarding)
- 2026-05-29 review: "Clerk `user.deleted` no-op = GDPR violation"; "DPA click-through at onboarding missing"; "Account-delete/export rate-limited but not audited centrally" _(refined here — the two self-service routes **are** audited; the gap is the Clerk/admin paths + log retention)_

## 17. Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-05-29 | Claude (with Gerard) | Initial draft from 2026-05-29 review. |
| 0.2 | 2026-05-29 | Claude (Opus 4.8) | Verified against code: `user.deleted` no-op confirmed at `clerk/route.ts:127-136`; confirmed `account/delete` + `account/export` **already** call `createAuditLog` + `apiError` (refined the "not audited" finding to target the Clerk/admin entry points + log retention); confirmed `/dpa` page exists but onboarding form has no acceptance control; confirmed `lib/redact.ts` + `audit_logs` model exist. Added `lib/gdpr/erasure.ts` consolidation, Clerk-id mapping, Dr Green linkage severance, and DPA-acceptance schema fields. |
