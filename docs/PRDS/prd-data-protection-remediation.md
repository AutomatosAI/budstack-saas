# PRD: Data Protection Remediation

**Status:** Draft — ready for implementation
**Created:** 2026-07-27
**Predecessor:** [prd-legal-compliance-framework.md](./prd-legal-compliance-framework.md) — this PRD executes the "Article 9 special-category data handling" goal (§2) that the framework PRD declared but did not deliver, and closes gaps that PRD never addressed.

---

## 1. Introduction

A data protection reviewer acting for our operators has blocked BudStacks template work pending closure of five gaps. Investigation of the codebase confirmed the gaps are real and found one more that was not on their list.

**What was found:**

1. **BudStacks stores Article 9 special-category health data it never reads.** `consultation_questionnaires` holds 15 health columns per patient — psychiatric history, cancer treatment, liver disease, alcohol and drug-services history, prescribed medications, cannabis consumption. The Dr Green payload is built from the **request body**, not the stored row, so persistence serves no function. This is write-only liability.

2. **That data is exposed on an API with no consumer.** `GET /api/tenant-admin/customers/[id]` queries six medical fields and returns them as `medicalHistory` to the admin client. The client never renders them. Any operator — including a non-clinical one — can read their customers' cancer and psychiatric status by calling the endpoint directly.

3. **Every tenant storefront serves the BudStacks corporate privacy policy.** `app/store/[slug]/privacy/page.tsx` is a two-line re-export of `app/privacy/page.tsx`. Combined with the custom-domain rewrite in `middleware.ts`, `healingbuds.com/privacy` names **BudStacks** as controller with BudStacks' contact details. Operators are controllers of their own patients' data and cannot discharge their Article 13 duty through our policy.

4. **The sub-processor list contradicts the actual commercial relationship.** `app/legal/subprocessors/page.tsx` lists "Dr. Green API" as a BudStacks sub-processor. The NFT licence is operator↔Dr Green and the two companies are unrelated. As written, we assert responsibility for Dr Green's onward transfer chain — which is why the reviewer asked us about a UAE entity (Upcann SW FZCO) we have no relationship with.

5. **No Article 27 UK representative is named** in any document.

6. **The sub-processor notification duty has no mechanism.** The DPA §6 promises 30 days' notice and a 14-day objection window. Delivery is a mailbox operators must opt into. Nothing is wired to the subscriber list.

**Decisions taken** (2026-07-27, with Gerard):

| Decision | Choice |
|---|---|
| Policy authoring model | Locked master template + tenant identity fields |
| Dr Green relationship | **Independent controller** (controller-to-controller handover) |
| Failed-submission behaviour | Hard delete; patient re-enters |
| v1 purge scope | Article 9 medical fields only |

---

## 2. Goals

- **Hold no Article 9 data at rest.** BudStacks stores zero special-category health data after this ships.
- **Close the unconsumed API exposure** returning medical fields to operator clients.
- **Give every operator a privacy policy that names them**, served on their own domain, without letting them draft it unsupervised.
- **Make the platform/operator/Dr Green boundary consistent** across code, sub-processor list, DPA and collection-point notice.
- **Make the 30-day sub-processor notification actually fire**, tied to the subscriber list rather than a mailbox.
- **Produce an audit-grade remediation record** the reviewer can accept as evidence.

---

## 3. User Stories

### Workstream 1 — Article 9 purge (ship first, standalone PR)

> Ordered deliberately: kill the live exposure before touching schema.

#### US-001: Remove medical fields from the tenant-admin customer API
**Description:** As a patient, I need my psychiatric and oncology history to be unreachable by my storefront operator, who has no lawful basis to see it.

**Acceptance Criteria:**
- [ ] The `medicalHistory` query block at `app/api/tenant-admin/customers/[id]/route.ts:140-157` is deleted.
- [ ] `medicalHistory` is removed from the JSON response body.
- [ ] Any TypeScript consumer of the `medicalHistory` response field is updated; `app/tenant-admin/customers/[id]/page.tsx` confirmed not to reference it.
- [ ] KYC/approval fields the UI *does* use (`kycLink`, `isKycVerified`, `adminApproval`) remain available — via the existing questionnaire lookup, not the deleted block.
- [ ] Typecheck and lint pass in CI.

#### US-002: Stop persisting Article 9 fields at consultation submit
**Description:** As BudStacks, we must not write health data we never read.

**Acceptance Criteria:**
- [ ] The 15 Article 9 fields are removed from the `prisma.consultation_questionnaires.create()` call at `app/api/consultation/submit/route.ts:306-322`.
- [ ] The Zod request schema (lines 80-96) is **unchanged** — the form still submits these fields and they are still validated.
- [ ] The Dr Green payload build (line 447 onward) is unchanged and still reads from `body`, verified by test.
- [ ] `lib/security/redact.ts` coverage of these field names is retained for log safety.
- [ ] Typecheck and lint pass in CI.

#### US-003: Drop the columns and purge existing rows
**Description:** As BudStacks, we must destroy the health data already on disk, not merely stop adding to it.

**Acceptance Criteria:**
- [ ] Prisma migration drops all 15 columns from `consultation_questionnaires`: `medicalConditions`, `otherCondition`, `prescribedMedications`, `prescribedSupplements`, `hasHeartProblems`, `hasCancerTreatment`, `hasImmunosuppressants`, `hasLiverDisease`, `hasPsychiatricHistory`, `hasAlcoholAbuse`, `hasDrugServices`, `alcoholUnitsPerWeek`, `cannabisReducesMeds`, `cannabisFrequency`, `cannabisAmountPerDay`.
- [ ] Corresponding fields removed from `prisma/schema.prisma`.
- [ ] **Pre-flight count captured before the drop:** total rows, rows with `submittedToDrGreen = true`, rows with `submittedToDrGreen = false`. The false set is data that exists *only* in BudStacks and will be irrecoverably lost — this is accepted per the hard-delete decision, but must be counted and reported.
- [ ] Migration runs on staging first; row counts recorded before and after.
- [ ] Post-migration verification query confirms zero Article 9 columns remain on the table.
- [ ] Backups containing the dropped columns are identified and their expiry date recorded (see FR-6).

#### US-004: Regression guard against reintroduction
**Description:** As BudStacks, we need this to stay fixed after the next feature lands.

**Acceptance Criteria:**
- [ ] Unit test asserts the consultation submit path persists no field whose name appears on the Article 9 denylist.
- [ ] Test fails if any denylisted field is added back to the `create()` call.
- [ ] Denylist lives in one exported constant, shared with `lib/security/redact.ts` so the two cannot drift.
- [ ] Test runs in CI on every PR.

#### US-005: Produce the remediation evidence record
**Description:** As the operators' data protection reviewer, I need documentary evidence the purge happened, not an assurance that it did.

**Acceptance Criteria:**
- [ ] Markdown record committed to `docs/compliance/` containing: date, fields removed, pre- and post-migration row counts, count of rows whose data existed only in BudStacks, migration commit SHA, backup expiry date.
- [ ] Record states the lawful basis conclusion: the data had no consumer and no retention justification (Art 5(1)(c) data minimisation).
- [ ] Linked from the legal changelog.

---

### Workstream 2 — Per-tenant privacy policy

#### US-006: Tenant legal profile data model
**Description:** As a developer, I need somewhere to store each operator's controller identity so their policy can name them.

**Acceptance Criteria:**
- [ ] New `tenant_legal_profiles` table: `id`, `tenantId` (unique FK), `controllerLegalName`, `registeredAddress`, `privacyContactEmail`, `icoRegistrationNumber` (nullable), `dpoName` (nullable), `dpoContact` (nullable), `ukRepresentative` (nullable), `publishedAt` (nullable), `templateVersion`, `createdAt`, `updatedAt`.
- [ ] Prisma model added; migration generated.
- [ ] Tenant-scoped access enforced by the existing `$extends` scoping. **Note the known trap:** that extension rewrites `findUnique` to `findFirst` without flattening compound keys — use `findFirst` with flat fields.
- [ ] Typecheck passes in CI.

#### US-007: Versioned master policy template
**Description:** As BudStacks, we need one counsel-approved policy body that every tenant inherits, so counsel reviews one document rather than N.

**Acceptance Criteria:**
- [ ] Master template stored as a versioned artefact with named merge tokens: `{{controllerLegalName}}`, `{{registeredAddress}}`, `{{privacyContactEmail}}`, `{{icoRegistrationNumber}}`, `{{dpoContact}}`, `{{ukRepresentative}}`.
- [ ] Template version is a semver string recorded on each tenant's profile at publish time.
- [ ] Template documents the controller-to-controller handover to Dr Green (see US-013).
- [ ] Rendering a template with an unfilled required token fails loudly rather than emitting an empty string or a literal `{{token}}`.
- [ ] Unit tests cover: all tokens populated, missing required token, optional token absent.

#### US-008: Tenant admin legal settings UI
**Description:** As an operator, I want to enter my company details so my storefront's privacy policy names my company, not BudStacks.

**Acceptance Criteria:**
- [ ] New page under `app/tenant-admin/legal/` with fields from US-006.
- [ ] Policy body shown read-only, labelled as managed by BudStacks with its version number.
- [ ] Required fields validated with Zod before save: legal name, registered address, privacy contact email (valid email format).
- [ ] "Preview" renders the merged policy exactly as the storefront will serve it.
- [ ] "Publish" sets `publishedAt` and stamps `templateVersion`.
- [ ] Unpublished state clearly indicated, with a warning that the storefront is currently serving a fallback.
- [ ] Sidebar navigation entry added.
- [ ] Verified in a browser against staging.

#### US-009: Serve the per-domain policy
**Description:** As a patient on healingbuds.com, I need to see HealingBuds' privacy policy, naming HealingBuds as controller.

**Acceptance Criteria:**
- [ ] `app/store/[slug]/privacy/page.tsx` no longer re-exports the platform policy.
- [ ] It resolves the tenant from the route segment (both subdomain and hashed custom-domain forms per `middleware.ts`) and renders the merged template.
- [ ] Page shows "Last updated" from `publishedAt`.
- [ ] **Fallback when unpublished:** a notice stating the operator has not yet published a policy, with the operator's contact route — never the BudStacks corporate policy.
- [ ] Verified in a browser against staging on both a subdomain and a custom domain.
- [ ] Typecheck and lint pass in CI.

#### US-010: Block storefront publication without a policy
**Description:** As BudStacks, we should not let a storefront take patient data with no privacy notice in place.

**Acceptance Criteria:**
- [ ] Tenant onboarding/activation surfaces an outstanding task when no legal profile is published.
- [ ] Consultation form submission is blocked with a clear operator-facing error when the tenant has no published policy.
- [ ] Existing live tenants are exempted via a grace period flag so this does not break production on deploy; grace expiry date recorded in the PR description.

---

### Workstream 3 — Sub-processor register and notification

#### US-011: Move the sub-processor list into the database
**Description:** As a developer, I need the list to be data so it can be changed without a deploy and can drive notifications.

**Acceptance Criteria:**
- [ ] New `subprocessors` table: `id`, `name`, `purpose`, `region`, `transferMechanism`, `dpaUrl` (nullable), `status` (`active` | `pending` | `retired`), `effectiveFrom`, `announcedAt` (nullable), `createdAt`, `updatedAt`.
- [ ] Seed migration carries over the current entries from `app/legal/subprocessors/page.tsx` — **excluding Dr Green** (see US-013).
- [ ] `app/legal/subprocessors/page.tsx` renders from the table; hardcoded array deleted.
- [ ] Page continues to render for anonymous visitors.

#### US-012: Platform admin CRUD for the register
**Description:** As a BudStacks platform admin, I want to add or retire a vendor and have the notification clock start automatically.

**Acceptance Criteria:**
- [ ] Super-admin-only UI to create, edit, and retire entries; gated by the existing permission system, not a role string check.
- [ ] Creating an entry sets `status = pending` and `effectiveFrom` to today + 30 days by default.
- [ ] `effectiveFrom` cannot be set fewer than 30 days ahead without an explicit override, and the override is written to the audit log.
- [ ] All changes recorded in `audit_logs`.

#### US-013: 30-day advance notification to subscribers
**Description:** As an operator, I need to hear about a new sub-processor before it starts processing my patients' data, so I can exercise the objection right the DPA gives me.

**Acceptance Criteria:**
- [ ] On transition to `pending`, an email is queued to the billing/legal contact of **every active tenant** — not an opt-in list.
- [ ] Email states vendor, purpose, region, transfer mechanism, effective date, and how to object.
- [ ] A legal changelog entry is created automatically.
- [ ] `announcedAt` stamped when the notification is sent.
- [ ] Entry flips `pending` → `active` on `effectiveFrom`.
- [ ] Delivery recorded in `email_logs`; failures retried and surfaced to platform admins.
- [ ] **Known landmine:** the email worker requires `tsconfig.json` in the runner image and will crash-loop without it; and `TENANT_CONTEXT_STRICT=true` will crash a cross-tenant worker unless it bypasses tenant scoping. Both must be handled for a job that iterates all tenants.

#### US-014: Objection capture
**Description:** As an operator, I want my objection recorded against the specific vendor, not lost in an inbox.

**Acceptance Criteria:**
- [ ] Objection form linked from the notification email and the sub-processor page.
- [ ] New `subprocessor_objections` table: `id`, `subprocessorId`, `tenantId`, `raisedByUserId`, `reason`, `status`, `createdAt`, `resolvedAt`.
- [ ] Objections raised more than 14 days after `announcedAt` are accepted but flagged as out-of-window, per DPA §6.
- [ ] Platform admins see open objections; resolution is recorded.

---

### Workstream 4 — Document corrections

#### US-015: Reflect the independent-controller position
**Description:** As BudStacks, our documents must state the Dr Green relationship consistently, so we stop inheriting a transfer chain we have no part in.

**Acceptance Criteria:**
- [ ] Dr Green removed from the sub-processor register (US-011 seed).
- [ ] DPA amended to describe the Dr Green handover as controller-to-controller, not sub-processing.
- [ ] Master policy template (US-007) discloses at collection point that consultation data is transmitted to Dr Green as a **separate, independent controller**, with a link to Dr Green's own privacy notice.
- [ ] Consultation form shows the same disclosure before submission.
- [ ] **Gate:** not merged until Dr Green confirms the position in writing (see Open Questions).

#### US-016: Article 27 UK representative
**Description:** As a UK data subject, I need a UK contact point named in the privacy notice if the controller sits outside the UK.

**Acceptance Criteria:**
- [ ] Establishment status of BudStacks confirmed and recorded in `docs/compliance/`. **If BudStacks is UK-established, no Article 27 representative is required and this story closes as not-applicable, with that conclusion documented.**
- [ ] If required: representative named with full contact details in the DPA and the master policy template.
- [ ] `ukRepresentative` field on the tenant legal profile carries the operator's own representative where they have one.
- [ ] The DRG Investor Portal privacy policy is a **separate property** — raised as a ticket against that repo, not fixed here.

#### US-017: Counsel sign-off and removal of draft banners
**Description:** As an operator, I cannot rely on a DPA that the site itself declares non-binding.

**Acceptance Criteria:**
- [ ] All artefacts amended by this PRD sent for counsel review as one bundle.
- [ ] On sign-off, `LegalDraftNotice` removed from `/privacy`, `/dpa`, `/legal/subprocessors`, `/terms`, `/aup`, `/cookies`.
- [ ] Replaced with a reviewed-by line and review date.
- [ ] Legal changelog entry recording the version that achieved sign-off.

---

## 4. Functional Requirements

- **FR-1:** The system must not persist any Article 9 special-category health data in the BudStacks database.
- **FR-2:** No API response may include Article 9 health data for any caller, including tenant admins.
- **FR-3:** Health data submitted by a patient must be forwarded to Dr Green from the in-memory request body and discarded after the response.
- **FR-4:** When Dr Green submission fails, the system must surface a resubmission path to the patient and must not retain the payload.
- **FR-5:** The system must destroy Article 9 data already at rest via schema migration, and record counts before and after.
- **FR-6:** Backups predating the purge must be identified and left to expire on their existing schedule; the expiry date must be documented.
- **FR-7:** Each tenant must have a legal profile carrying its controller identity.
- **FR-8:** Each storefront domain must serve a privacy policy naming that tenant's controller entity.
- **FR-9:** The policy body must be a BudStacks-managed versioned template; tenants supply merge values only and cannot edit the body.
- **FR-10:** A storefront without a published policy must serve a fallback notice, never the BudStacks corporate policy.
- **FR-11:** The sub-processor list must be database-backed and editable without deployment.
- **FR-12:** Adding or replacing a sub-processor must notify every active tenant at least 30 days before the effective date.
- **FR-13:** Notifications must go to all active tenants, not an opt-in subscriber list.
- **FR-14:** Operators must be able to object to a sub-processor, and objections must be recorded against that vendor.
- **FR-15:** Dr Green must not appear as a BudStacks sub-processor.
- **FR-16:** The transfer of consultation data to Dr Green must be disclosed at collection point as a controller-to-controller transfer.
- **FR-17:** Every legal document change must produce a changelog entry.

---

## 5. Non-Goals

- **Removing local `orders` / `order_items`.** Larger blast radius; makes tenant admin dependent on Dr Green API uptime, and there is existing status desync with no BudStacks-side reconciliation. Assess separately.
- **Trimming duplicated identity fields** (address, DOB, gender). Deferred to a v2 minimisation pass.
- **Free-text policy editing by tenants.** Explicitly rejected — reintroduces per-tenant drafting risk.
- **The CannExpert subscriber agreement variation.** Contract work, not engineering. Tracked externally.
- **Dr Green's own retention and deletion behaviour.** Outside our control; raised as an open question.
- **The DRG Investor Portal privacy policy.** Separate property and repository.
- **Cookie consent changes.** Already covered by the framework PRD.
- **Jurisdictions beyond UK / EU / South Africa.**

---

## 6. Design Considerations

- Tenant legal settings should follow the existing `app/tenant-admin/` page conventions (branding, SEO) for layout and form patterns.
- The storefront privacy page must inherit storefront theming, not BudStacks platform chrome — it renders under the tenant's brand on the tenant's domain.
- Reuse the existing `LegalDraftNotice` pattern for the "policy not yet published" fallback so the visual language of legal warnings stays consistent.
- The sub-processor table markup already exists in `app/legal/subprocessors/page.tsx`; keep the presentation and swap only the data source.

---

## 7. Technical Considerations

- **Migration is destructive and irreversible.** Run on staging first, capture counts, and confirm Dr Green holds the data for `submittedToDrGreen = true` rows before dropping in production.
- **Prisma tenant scoping trap:** the `$extends` scoping rewrites `findUnique` to `findFirst` but does not flatten compound `@@unique` keys, producing `Unknown argument` 500s. Use `findFirst` with flat fields on new tenant-scoped models.
- **Custom-domain routing:** `middleware.ts` rewrites custom domains to a host-scoped `/store/cd-<hash>/…` segment for ISR cache-keying. Tenant resolution on the privacy page must handle both that form and the subdomain form.
- **Email worker:** requires `tsconfig.json` in the runner image; `TENANT_CONTEXT_STRICT=true` will crash a worker that iterates all tenants unless it bypasses tenant scoping.
- **Prisma client is typed as `any` in places** — do not rely on the compiler to catch field removals; the US-004 regression test is the real guard.
- Deployment is Railway on merge to `main`; the destructive migration should land in its own PR, separately from feature work.

---

## 8. Success Metrics

- Zero Article 9 columns present in the BudStacks schema, verified by post-migration query.
- Zero API responses containing health data, verified by the US-004 regression test.
- 100% of active tenants have a published legal profile at the end of the grace period.
- Every storefront domain serves a policy naming its own controller — spot-checked across all live custom domains.
- Sub-processor notification demonstrably fires 30 days ahead on a staging dry-run before any real change is announced.
- The reviewer's items (a)–(e) each have a documented answer; the remediation record is accepted as evidence.

---

## 9. Open Questions

1. **Dr Green written confirmation.** US-015 is gated on Dr Green confirming in writing that the patient relationship is controller-to-controller and the NFT licence is operator↔Dr Green. Until then the position is asserted only by us.
2. **Dr Green retention and deletion.** Does Dr Green delete on request, and does their retention clock start where ours ends? If we purge and theirs is indefinite, we have improved our position without improving the patient's. **The reviewer will ask this next.**
3. **Is BudStacks UK-established?** Determines whether US-016 is required at all.
4. **Is LHI Consulting appointed as Article 27 representative, or engaged as consultant/DPO?** Needed before naming them anywhere.
5. **Who owns the CannExpert subscriber agreement templates** — BudStacks or Dr Green? Determines who issues the non-clinical variation, and whether non-clinical operators are a subscriber class at all. This matters here because it sets the ceiling on what any operator may ever be shown.
6. **Which firm is "counsel"** for US-017 sign-off, and what is their turnaround?
7. **Do any operators have their own sub-processors** we should be surfacing on their tenant policy? Out of scope for v1 given the locked template, but it will come up.

---

## 10. Delivery Order

| # | Workstream | Rationale | Est. |
|---|---|---|---|
| 1 | WS1 — Article 9 purge | Highest risk reduction per day; strengthens the independent-controller position before we assert it | ~1 day |
| 2 | WS4 US-015 gate | Dr Green written confirmation — start the clock immediately, it blocks WS4 | external |
| 3 | WS2 — Per-tenant policy | The reviewer's actual blocker on template work | ~3–4 days |
| 4 | WS3 — Sub-processor register | Shares the tenant-legal foundation with WS2 | ~3 days |
| 5 | WS4 — Document corrections | Depends on #2 landing | ~1 day + counsel |

WS1 ships as its own PR and does not wait for anything.
