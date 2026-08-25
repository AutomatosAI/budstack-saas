# PRD: Customer Approval-Status Visibility (BudStacks ↔ Dr Green)

## Introduction

When a customer signs up on a BudStacks tenant storefront they are submitted to Dr Green for approval and can sit in PENDING until manually approved. Customers can already see their own status (storefront dashboard calls Dr Green live per-session), but **tenant admins cannot see who is approved and who isn't** — the tenant-admin Customers pages show no approval state at all.

The local mirror of approval state already exists (`consultation_questionnaires.isKycVerified` / `.adminApproval`, maintained by the customer-side status check and by an inbound webhook receiver), and Dr Green already exposes a partner-scoped bulk status endpoint (`GET /api/v1/dapp/clients`). This PRD wires the three missing pieces:

- **Phase 1 (budstack-saas):** show last-known status on the tenant-admin Customers list + detail pages, after fixing two pre-existing data bugs that would make any badge lie.
- **Phase 2 (budstack-saas):** a pull-based "Refresh from Dr Green" that bulk-syncs the mirror via the existing partner API.
- **Phase 3 (dr-green-backend):** outbound client-status webhooks so the mirror updates in near-real-time without polling — the budstack receiver for these events already exists and is signature-verified; today nothing sends them.

Spans two repos: `budstack-saas` (Phases 1–2) and `dr-green-backend` (Phase 3). Dr Green remains the **system of record**; BudStacks only mirrors.

## Goals

- Tenant admins see per-customer verification status (Verified / Pending / Rejected / ID upload failed / Not submitted) on the Customers list, detail page, and CSV export.
- Status vocabulary is consistent end-to-end (`VERIFIED | PENDING | REJECTED`, matching Dr Green's enum) — fixing the live bug where the purchase gate and the dashboard disagree.
- Every registration path persists `drGreenClientId` so no customer is permanently "pending" by accident.
- Admins can refresh all statuses for their tenant in one action costing ≤ a handful of upstream calls (no per-row API calls, ever).
- Dr Green pushes client-status changes to partners so the mirror stays fresh without manual refresh.

## Decisions already made (from review discussion)

- The dead `verifyKyc` local-approve API gets **no UI** — approving locally would diverge from the system of record.
- Freshness is **pull-based in Phase 2** (no push exists yet) and **push-based in Phase 3** (new outbound webhooks in dr-green-backend, copying its existing payments-webhook dispatcher pattern).
- The single-client Dr Green endpoint is never used for lists (historic 401s force an up-to-80-request scan fallback, and it over-fetches `medicalRecord` PII).

## User Stories

### Phase 1 — Status on tenant-admin pages (budstack-saas)

#### US-001: Normalise adminApproval vocabulary
**Description:** As the platform, I need one status vocabulary so every reader renders the same truth.

**Acceptance Criteria:**
- [ ] All local writes of `adminApproval` use Dr Green's enum values (`VERIFIED`, not `APPROVED`): `app/actions/kyc-check.ts` (2 sites), `app/api/tenant-admin/customers/[id]/route.ts` (verifyKyc path).
- [ ] A shared canonicaliser (lib) maps legacy `"APPROVED"` → `VERIFIED` on read; all readers (`RestrictedRegionGate`, `/api/consultation/status` consumers, new admin UI) use it.
- [ ] Data backfill migration: `UPDATE consultation_questionnaires SET "adminApproval" = 'VERIFIED' WHERE "adminApproval" = 'APPROVED'`.
- [ ] Unit tests cover the canonicaliser (VERIFIED/APPROVED/PENDING/REJECTED/unknown).
- [ ] Typecheck passes (CI).

#### US-002: Persist drGreenClientId on the shop/register path
**Description:** As the platform, I need every registration path to store the Dr Green client id so status sync can reach every customer.

**Acceptance Criteria:**
- [ ] `POST /api/shop/register` persists `drGreenClientId` (and `tenantId`) onto `users` after `createClient`, matching `consultation/submit` behaviour.
- [ ] Failure to persist does not fail the registration (log + continue), mirroring existing best-effort conventions.
- [ ] Typecheck passes (CI).

#### US-003: Status derivation helper
**Description:** As a developer, I need one function that turns mirror fields into a display status so list, detail, CSV and gate agree.

**Acceptance Criteria:**
- [ ] `lib/customers/verification-status.ts` (or equivalent) exports `deriveVerificationStatus({ isKycVerified, adminApproval, idDocumentStatus, submittedToDrGreen, hasQuestionnaire })` → `VERIFIED | PENDING | REJECTED | ID_UPLOAD_FAILED | NOT_SUBMITTED`.
- [ ] Precedence: no questionnaire → NOT_SUBMITTED; rejected → REJECTED; upload-failed → ID_UPLOAD_FAILED; verified (isKycVerified OR canonical adminApproval=VERIFIED, matching `kyc-check.ts`'s read) → VERIFIED; else PENDING.
- [ ] Unit tests for each branch.
- [ ] Typecheck passes (CI).

#### US-004: Status pills on the Customers list + CSV
**Description:** As a tenant admin, I want to see each customer's approval status at a glance so I know who is cleared to order.

**Acceptance Criteria:**
- [ ] List page selects `isKycVerified`, `adminApproval` from the questionnaire fetch it already performs (zero additional queries) and maps a `verificationStatus` per row.
- [ ] `customers-table.tsx` renders a status pill per row (Verified=green, Pending=amber, Rejected=red, ID upload failed=red variant, Not submitted=grey), reusing the existing `RowPill` pattern.
- [ ] CSV export gains a `Status` column.
- [ ] Erased customers remain filtered out (existing `@deleted.local` filter untouched).
- [ ] Typecheck passes (CI); verify on staging after deploy (list renders pills for a tenant with mixed statuses).

#### US-005: Status summary counts on the list header
**Description:** As a tenant admin, I want Verified/Pending/Rejected counts so I can gauge the approval backlog.

**Acceptance Criteria:**
- [ ] Header stat chips: Verified / Pending / Rejected (+ Not submitted folded into Pending or shown separately — implementer's call, consistent with US-003 derivation), computed locally from the questionnaire rows already loaded (no new queries or upstream calls).
- [ ] Counts respect the erasure filter.
- [ ] Typecheck passes (CI); verify on staging after deploy.

#### US-006: Status card on the customer detail page
**Description:** As a tenant admin, I want a customer's verification detail (status, mode, last update, KYC link) when I open their record.

**Acceptance Criteria:**
- [ ] Detail page loads the customer's questionnaire (by tenantId + lowercased email) and renders: status pill, verification mode (KYC / ID upload), `idDocumentStatus` when present, last-updated timestamp (`updatedAt`), and the `kycLink` (copyable) when the customer is unverified on the KYC path.
- [ ] No Dr Green API call is made from this page.
- [ ] Rejection shows status + date only (no rejection note — see Open Questions).
- [ ] Typecheck passes (CI); verify on staging after deploy.

### Phase 2 — Pull refresh (budstack-saas)

#### US-007: Bulk status sweep client
**Description:** As a developer, I need a function that fetches all client statuses for a tenant from Dr Green in a few paginated calls.

**Acceptance Criteria:**
- [ ] `lib/drgreen/client-status-sweep.ts` pages `GET /dapp/clients` (take=200, ascending pages until `pageMetaDto` exhausted; hard cap ~40 pages) using the existing `callDrGreenAPI` signing (GET signature over the exact query string serialisation).
- [ ] Returns rows keyed by client id AND lowercased email, each `{ clientId, email, adminApproval, isKYCVerified, isActive, verificationType, verifiedAt, rejectedAt }`.
- [ ] Handles the single-wrap list envelope (`data.clients` + `data.pageMetaDto`) with the same defensive extraction used elsewhere.
- [ ] Never calls the single-client endpoint; never touches `medicalRecord`.
- [ ] Unit tests: pagination loop, envelope extraction, empty tenant.
- [ ] Typecheck passes (CI).

#### US-008: Refresh action + upsert
**Description:** As a tenant admin, I want a "Refresh from Dr Green" action that updates every customer's mirrored status now.

**Acceptance Criteria:**
- [ ] Tenant-admin server action (or API route) guarded by the same permission as the Customers page; uses `getTenantDrGreenConfig(tenantId)`; missing credentials → clear, non-crashing error state.
- [ ] Sweep results update `consultation_questionnaires` matched by `drGreenClientId` first, else `(tenantId, lowercased email)`; writes `isKycVerified`, canonical `adminApproval`; never invents rows for unknown clients.
- [ ] Records sync completion time per tenant (new nullable `tenants.drGreenStatusSyncedAt` column via migration).
- [ ] Per-tenant throttle: refresh no-ops (with message) if last sync < 60s ago.
- [ ] Audit-log entry on each refresh (actor, counts updated).
- [ ] Unit tests: matching precedence, canonicalisation on write, throttle.
- [ ] Typecheck passes (CI).

#### US-009: Refresh UI + staleness label
**Description:** As a tenant admin, I want to trigger the refresh and see how fresh the data is.

**Acceptance Criteria:**
- [ ] "Refresh from Dr Green" button on the Customers list header; disabled while running; success/error toast with updated-row count.
- [ ] "Statuses last synced &lt;relative time&gt;" label (or "never — showing last-known from customer activity") near the button.
- [ ] Page data reloads after a successful refresh.
- [ ] Typecheck passes (CI); verify on staging after deploy (refresh updates a known-changed status).

### Phase 3 — Outbound status webhooks (dr-green-backend)

#### US-010: Dispatch client-status events on transitions
**Description:** As a partner platform, I want Dr Green to notify me when a client's approval state changes so my mirror stays fresh without polling.

**Acceptance Criteria:**
- [ ] Events emitted on: single approve (`client.approved`), single reject (`client.rejected`), bulk approve/reject (one event per client), KYC flag set by First-AML webhook/cron (`kyc.verified`), and document-path approval (which routes through the same status update).
- [ ] Dispatch is best-effort/async: a webhook failure never fails or delays the admin action; outcomes are logged (reuse the payments dispatcher's logging pattern).
- [ ] Partner endpoint + secret resolution reuses the existing per-partner mechanism the payments webhook dispatcher already uses (per-key hosts model); clients whose nftId has no configured partner endpoint are skipped silently.
- [ ] Payload includes at minimum: event name, clientId, nftId, adminApproval, isKYCVerified, timestamps; **no medical/PII payload**.
- [ ] Signature and event names match the budstack receiver contract (`/api/webhooks/drgreen/status` + `drgreen-webhook-verify`) — verified against that code, not assumed.
- [ ] Unit tests per repo conventions for the dispatch hook points.
- [ ] Repo CI green.

#### US-011: End-to-end contract verification
**Description:** As the platform owner, I need proof the events Dr Green sends are the events BudStacks consumes.

**Acceptance Criteria:**
- [ ] Event names/payloads asserted equal on both sides (shared fixture committed to both repos or documented in this PRD's PRs).
- [ ] budstack `status-event-handlers` accepts every emitted event without code change, OR the minimal receiver adjustments ship in the budstack PR (note: `kyc.rejected` currently logs/emails without a DB write — leave as-is unless contract requires otherwise).
- [ ] Staging smoke: approve a test client in Dr Green admin → budstack questionnaire row shows VERIFIED without the customer logging in.

## Functional Requirements

- FR-1: All `adminApproval` writes in budstack use `VERIFIED | PENDING | REJECTED`; reads canonicalise legacy `APPROVED` → `VERIFIED`. A one-off backfill migrates stored `APPROVED` rows.
- FR-2: `/api/shop/register` persists `drGreenClientId` + `tenantId` onto `users`.
- FR-3: The Customers list derives status exclusively from local mirror data already fetched by the page; zero upstream calls on render.
- FR-4: Status pill, CSV column, header counts, and detail card all derive from one shared helper (US-003).
- FR-5: Refresh sweeps `GET /dapp/clients` paginated (≤ 200/page), upserts the mirror, stamps `tenants.drGreenStatusSyncedAt`, and is throttled to ≥ 60s between runs per tenant.
- FR-6: dr-green-backend emits signed `client.approved` / `client.rejected` / `kyc.verified` events to the partner endpoint configured for the client's nftId, asynchronously, with logging; admin flows never block on dispatch.
- FR-7: No surface introduced by this PRD fetches or stores `medicalRecord` or any Article 9 data (existing prohibition — see `consultation_questionnaires` schema comment).

## Non-Goals (Out of Scope)

- No local approve/reject UI for tenant admins (Dr Green admin remains the only approval surface; `verifyKyc` API stays UI-less).
- No per-row or per-render live Dr Green calls from admin pages.
- No status filter tabs on the Customers list in this iteration (the email-join makes pre-pagination filtering non-trivial; revisit after Phase 3 lands).
- No scheduled/cron auto-sync in budstack (manual refresh + webhooks cover it; revisit if webhook delivery proves unreliable).
- No realtime UI push (page reload/refresh shows new state).
- No display of Dr Green `rejectionNote` to tenant admins (privacy call — see Open Questions).

## Technical Considerations

- **Join fragility:** `consultation_questionnaires` has no `userId` FK; joins are `(tenantId, lower(email))`. `kyc-check` migrates questionnaire tenantIds when users move tenants. Prefer `drGreenClientId` matching wherever available.
- **Signing:** Dr Green GET requests sign the exact `URLSearchParams` serialisation of the query — pagination params must be serialised once and signed as-sent (`drgreen-api-client.ts` rules).
- **Envelope:** list responses are single-wrapped (`data.clients`/`data.pageMetaDto`); several other endpoints double-wrap (`data.data`) — use the established defensive extraction.
- **Known upstream quirk:** `/dapp/clients/:id` historically 401'd, which is why per-client lookups fall back to an expensive scan — the sweep must use the list endpoint only.
- **Erasure:** erased users (`@deleted.local`) stay excluded from all new surfaces and counts.
- **dr-green-backend hook placement:** status transitions concentrate in `client.service.ts` (`updateClientStatus`, `approveClients`, `rejectClients`) and the KYC repository update; document approval delegates into `updateClientStatus`, so a single well-placed dispatch point covers the ID path.
- **Deploy models:** budstack merge-to-main auto-deploys (Railway); dr-green-backend flows develop → staging, main → prod — Phase 3 PR targets `develop`.

## Success Metrics

- A tenant admin can answer "is this customer approved?" from the Customers list with zero support contact.
- Refresh for a tenant with ≤ 600 customers completes in ≤ 3 upstream calls.
- With Phase 3 live: Dr Green approval → budstack mirror updated in under a minute, with no customer login and no manual refresh.
- Zero increase in per-render Dr Green API traffic from admin pages.

## Implementation notes (as-built)

Deviations from the ACs above, made during implementation for grounded reasons:

- **US-008 sync marker/throttle:** no `tenants.drGreenStatusSyncedAt` column. This repo's migrations are hand-run SQL with no automated runner, and declaring a schema column the DB lacks breaks *every* tenants query at deploy (merge = instant Railway deploy). The latest `customer.status_refreshed` audit-log row is the marker and throttle instead — durable, tenant-scoped, zero deploy hazard. The throttle row is written BEFORE the sweep (post-review fix: writing it after left the whole sweep duration as a concurrency race window).
- **US-008 permission:** gated on `canEditCustomers`, not `canViewCustomers` — the customer_support/manager presets hold the view grant as explicitly read-only, and this action writes the KYC/approval mirror.
- **US-010 dispatcher:** dr-green-backend has NO existing outbound webhook mechanism (the "payments dispatcher" assumption was wrong — all its webhooks are inbound; budstack's receiver was aspirational). Built new as a plain env-configured function module (`src/webhooks/partner-status-webhook.ts`) rather than an @Injectable, because the natural call sites are re-provided across many modules' flat provider arrays and a new constructor dependency breaks Nest boot unless every array is updated. Config: `PARTNER_STATUS_WEBHOOK_URL` + `PARTNER_STATUS_WEBHOOK_SECRET` (must equal budstack's `DRGREEN_WEBHOOK_SECRET`) + optional `PARTNER_STATUS_WEBHOOK_NFT_IDS` allowlist. Dispatch is OFF until the env pair is set on both sides. Single attempt, fire-and-forget, logged; retries deliberately omitted — the pull refresh covers missed deliveries.
- **Duplicate-email contract:** payloads carry `data.emailsSent`, truthful per call site (admin approve/reject paths email the client; the First-AML KYC pass does not). The budstack receiver skips its own customer email only when the flag is true — so standard-KYC customers now get a KYC-pass email (from budstack) where previously neither platform sent one.
- `rejectionReason`/`rejectionNote` added to budstack's log-redaction list (`lib/security/redact.ts`) — the webhooks are the first flow delivering that admin free-text into budstack's own log tables.

## Security review outcomes

- 🔴 **Pre-existing (NOT introduced here), rollout-blocking:** `POST /api/consultation/submit` is unauthenticated and, for a caller-supplied email that matches an EXISTING user, overwrites that user's `tenantId` and `drGreenClientId` — letting an attacker bind a victim's account to the attacker's own (approvable) Dr Green client. The new badge/sync makes that spoofed approval more visible and more trusted. **Fix that route (bind to the authenticated session; never re-stamp an existing user's linkage from an anonymous call) before setting the Phase 3 env vars or promoting the admin badge as authoritative.** Tracked as its own follow-up.
- Shared platform webhook secret = platform-wide blast radius if leaked; keep a rotation runbook and watch for repeated 401s on the status webhook route (probing signal).

## Open Questions

- Show Dr Green `rejectionNote` to tenant admins on the detail page? (It can contain sensitive wording aimed at the customer; default here is status + date only.)
- Status filter tabs on the list — worth the join rework once webhooks keep the mirror fresh?
- Should Phase 2's refresh also backfill missing `users.drGreenClientId` by email match (self-healing the `/api/shop/register` history)? Default: yes if trivially safe during upsert.
