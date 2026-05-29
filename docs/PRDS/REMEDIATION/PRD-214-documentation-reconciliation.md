# PRD-214 — Documentation Reconciliation Sprint (rewrite stale architecture docs, sales-pitch truth, audit annotation)

> **Status:** Proposed
> **Phase:** R5 — Customer Readiness
> **Severity:** HIGH _(not a code vulnerability, but an enterprise-readiness and legal-exposure gap: the architecture docs describe a system that no longer exists, and the sales pitch makes compliance/performance claims the platform cannot currently substantiate. An enterprise buyer's technical due diligence reads these first.)_
> **Module(s) touched:** `docs/AUTHENTICATION_FLOWS.md`, `docs/DOMAIN_SETUP_INSTRUCTIONS.md`, `docs/MULTI_TENANT_ARCHITECTURE.md`, `docs/SAAS_ARCHITECTURE_PLAN.md`, `docs/BUDSTACK_ARCHITECTURE_AND_DEPLOYMENT.md`, `docs/SUBDOMAIN_DEPLOYMENT_STATUS.md`, `docs/BUDSTACK_SALES_PITCH.md`, `docs/SECURITY_AUDIT_2026-05-01.md`, `docs/SUPER_ADMIN_MANUAL.md`; new `docs/DOC_FRESHNESS_CHECKLIST.md`
> **Depends on:** None to start — but it **blocks PRD-215** (runbooks need a current architecture doc to reference).
> **Blocks:** PRD-215 (enterprise ops — runbooks reference these docs); enterprise technical due-diligence.
> **Owner:** Gerard + Claude. Sales-claim sign-off: Gerard + legal/DPO advisor.
> **Last updated:** 2026-05-29

---

## 0. Resolution status (executed 2026-05-29)

The bulk of this reconciliation was **executed** on 2026-05-29 during a `docs/` cleanup. Rather than rewrite each stale doc in place (the original AC-1..AC-7 strategy), the stale architecture docs were **consolidated into a single code-verified [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md)** plus topic guides under `guides/`, `integrations/`, `runbooks/`. Disposition of each doc named below:

| AC | Doc | Disposition (2026-05-29) |
|---|---|---|
| AC-1 | `AUTHENTICATION_FLOWS.md` | **Removed** — Clerk auth now in `ARCHITECTURE.md` (§request flow + §security). |
| AC-2 | `DOMAIN_SETUP_INSTRUCTIONS.md` | **Removed** — replaced by `guides/DOMAINS.md` (Railway + Namecheap). |
| AC-3 | `MULTI_TENANT_ARCHITECTURE.md` | **Removed** — real schema (`subdomain`/`isActive`) now in `ARCHITECTURE.md` ERD + tenant-isolation flow. |
| AC-4 | `SAAS_ARCHITECTURE_PLAN.md` | **Archived** → `archive/` with dated header noting the NFT model was never built. |
| AC-5 | `BUDSTACK_ARCHITECTURE_AND_DEPLOYMENT.md` | **Removed** — Clerk+Railway now in `ARCHITECTURE.md` + `runbooks/DEPLOYMENT.md`. |
| AC-6 | `SUBDOMAIN_DEPLOYMENT_STATUS.md` | **Archived** → `archive/` (point-in-time snapshot). |
| AC-7 | `SUPER_ADMIN_MANUAL.md` | Moved to `guides/`; Namecheap/NFT section reconciled to Railway. |

**Still open (not yet done):** AC-8 (sales-claim audit in `BUDSTACK_SALES_PITCH.md` — verify HIPAA/5-min/Lighthouse softened with legal sign-off), AC-9 (annotate `archive/SECURITY_AUDIT_2026-05-01.md` with fix-commit/PRD status), AC-10 (`DOC_FRESHNESS_CHECKLIST.md` — partially covered by the doc-accuracy policy in `docs/README.md`; a dedicated checklist + per-doc "last verified" front-matter remains). References below to `docs/<NAME>.md` are historical (pre-consolidation paths).

---

## 1. Problem

The January 2026 architecture documents describe an earlier incarnation of BudStacks. The code has since moved to Clerk auth, Railway hosting, and a data-driven template system, but the docs were never reconciled. Each stale doc was re-read against the code on 2026-05-29; every claim below is verified.

1. **`docs/AUTHENTICATION_FLOWS.md` — describes a session-based / NextAuth-style flow; the app uses Clerk.** The doc references `fetch('/api/auth/session')` (`:54`) and a self-managed `Role`-based login/redirect system, with **zero** mentions of Clerk. The app authenticates with Clerk (`@clerk/nextjs`, `currentUser()`, the Clerk webhook at `app/api/webhooks/clerk/route.ts`). The documented `/api/auth/session` endpoint pattern is the NextAuth contract, not ours.
2. **`docs/DOMAIN_SETUP_INSTRUCTIONS.md` — describes Abacus.AI; the app is on Railway.** **23** references to "Abacus", **0** to "Railway". Custom-domain provisioning is now Railway domain APIs (the current branch is literally `fix/super-admin-domain-dns-recovery`, all Railway). The doc would lead an operator to the wrong control plane entirely.
3. **`docs/MULTI_TENANT_ARCHITECTURE.md` — defines `slug` + `TenantStatus` that aren't in the Prisma schema.** The doc references a `TenantStatus` enum (2 occurrences) and a tenant `slug`. The actual `tenants` model (`prisma/schema.prisma:418`) has **`subdomain String @unique`** (not `slug`) and **`isActive Boolean`** (not a `TenantStatus` enum). Anyone coding against this doc would query non-existent fields.
4. **`docs/SAAS_ARCHITECTURE_PLAN.md` — defines an NFT model that doesn't exist.** **75** "NFT" references describing an NFT-membership data model. The schema has a single vestigial `nftTokenId String?` field on `tenants` (`:423`) and **no NFT model, table, or flow**. The plan describes a product that was never built.
5. **`docs/BUDSTACK_ARCHITECTURE_AND_DEPLOYMENT.md` — auth section wrong.** **15** NextAuth references; the deployment/auth narrative predates the Clerk migration.
6. **`docs/SUBDOMAIN_DEPLOYMENT_STATUS.md` — claims a now-stale deployment topology + "live" legacy templates.** Line 45 states "your nameservers are pointed to **Abacus.AI**" (now Railway); it lists templates as "✅ Restored & Verified" and "Live in 2-5 minutes" against a topology that has since changed. A reader treats a stale status doc as current truth.
7. **Sales/marketing claims are unsubstantiated.** `docs/BUDSTACK_SALES_PITCH.md` (and sibling marketing docs) carry "HIPAA Ready", "5-min launch", and "Lighthouse 90+" claims. On a platform that (per the remediation suite) has no test gate, PHI in plaintext logs, and an unfinished GDPR erasure path, "HIPAA Ready" is a legal-exposure claim; "5-min launch" and "Lighthouse 90+" have no measurement backing them. These must be reconciled to what is true today or removed.
8. **`docs/SECURITY_AUDIT_2026-05-01.md` not annotated with fix-commit references.** The audit lists findings but (verified: ~2 annotation-like lines in 217) is **not** annotated with which commit/PR closed each item. A reader cannot tell what's fixed. The remediation suite (PRD-200..216) is the system of record for the open items; the audit should cross-link.
9. **`docs/SUPER_ADMIN_MANUAL.md` — Namecheap section vs Railway reality.** **4** "Namecheap" references describe DNS/domain steps that no longer match the Railway-based domain flow the super-admin UI actually drives.

There is also no **doc-freshness mechanism** — nothing flags a doc as stale when the code it describes changes. This sprint rewrites/annotates each doc to match reality and adds a freshness checklist so the drift does not silently recur.

## 2. Users / personas

| Role | How they benefit |
|---|---|
| **New engineer / contractor** | Onboarding docs match the running system — no time lost coding against fields/services that don't exist |
| **Enterprise buyer's technical reviewer** | Architecture + security docs are accurate and self-consistent during due diligence |
| **Gerard / ops** | Domain + super-admin manuals describe the actual Railway controls |
| **Legal/DPO** | Sales claims are defensible; no unsubstantiated "HIPAA Ready" exposure |

## 3. User stories

- As a **new engineer**, when I read `MULTI_TENANT_ARCHITECTURE.md` and query a tenant, the field names (`subdomain`, `isActive`) match the Prisma schema.
- As an **operator**, when I follow `DOMAIN_SETUP_INSTRUCTIONS.md`, it points me at Railway (the real control plane), not Abacus.AI.
- As a **buyer's reviewer**, the security audit tells me which findings are closed and links me to the remediation PRD for the rest.
- As a **legal reviewer**, every compliance/performance claim in the sales pitch is either substantiated or removed.

## 4. Acceptance criteria

**Architecture docs reconciled to code:**

- [ ] **AC-1** `docs/AUTHENTICATION_FLOWS.md` rewritten to describe the **Clerk** flow: Clerk-hosted sign-in, `currentUser()`/`auth()` server resolution, the `app/api/webhooks/clerk/route.ts` user-sync, and role resolution from `publicMetadata`/local `users.role`. All `/api/auth/session` / NextAuth references removed.
- [ ] **AC-2** `docs/DOMAIN_SETUP_INSTRUCTIONS.md` rewritten for **Railway** domain provisioning (custom domain + DNS records as the super-admin UI drives them). All Abacus.AI references removed.
- [ ] **AC-3** `docs/MULTI_TENANT_ARCHITECTURE.md` corrected to the real schema: `tenants.subdomain` (not `slug`), `tenants.isActive` boolean (not `TenantStatus`). Field names cross-checked against `prisma/schema.prisma`.
- [ ] **AC-4** `docs/SAAS_ARCHITECTURE_PLAN.md` either has the NFT section removed, or it is clearly relabelled **"Not implemented / out of scope"** with the vestigial `nftTokenId` field noted as unused. No prose implies an NFT model exists.
- [ ] **AC-5** `docs/BUDSTACK_ARCHITECTURE_AND_DEPLOYMENT.md` auth + deployment sections rewritten for Clerk + Railway; NextAuth references removed.
- [ ] **AC-6** `docs/SUBDOMAIN_DEPLOYMENT_STATUS.md` either retired (moved to an `archive/` folder with a header noting it is a point-in-time snapshot) or rewritten to the current Railway topology. The Abacus.AI nameserver claim and "live" template-status table are corrected or dated.
- [ ] **AC-7** `docs/SUPER_ADMIN_MANUAL.md` DNS/domain section rewritten for Railway; Namecheap-specific steps removed or relabelled as one example registrar (DNS records are registrar-agnostic; the Railway side is the source of truth).

**Sales-claim truth:**

- [ ] **AC-8** Every "HIPAA Ready", "5-min launch", "Lighthouse 90+" (and equivalent) claim in `docs/BUDSTACK_SALES_PITCH.md` and sibling marketing docs is either (a) substantiated with a citation/measurement, or (b) softened to a defensible statement, or (c) removed. "HIPAA Ready" specifically is removed or downgraded to an accurate statement of current controls, signed off by legal/DPO.
- [ ] **AC-8a** A grep over the marketing docs confirms zero remaining unsubstantiated absolute compliance/performance claims (the exact claim strings become a CI doc-lint pattern in PRD-216, advisory only).

**Audit annotation:**

- [ ] **AC-9** `docs/SECURITY_AUDIT_2026-05-01.md` is annotated: each finding gets a status (`Fixed in <commit/PR>` / `Open → PRD-2NN` / `Mitigated`), cross-linking the remediation suite. A header points to `docs/PRDS/REMEDIATION/REMEDIATION-INDEX.md` as the live tracker.

**Doc-freshness mechanism:**

- [ ] **AC-10** A new `docs/DOC_FRESHNESS_CHECKLIST.md` lists each architecture/ops doc, its "describes" subject (auth = Clerk, hosting = Railway, schema = `prisma/schema.prisma`, etc.), and a "last verified against code" date. Each reconciled doc gets a front-matter block: `Last verified: 2026-05-29 against <ref>`.
- [ ] **AC-10a** The PR checklist (and PRD-216's advisory doc-lint) reminds authors to update the relevant doc + its "last verified" date when they change auth, hosting, the schema, or the template system.

## 4.1 Design framework conformance

Documentation-only PRD; no UI surface and no platform code change.

- [x] No UI — N/A
- [x] No template-specific values added to platform code — docs only

## 5. Scope

**In scope:** rewrite/annotate the nine docs above; reconcile sales claims; annotate the May-01 audit; add a doc-freshness checklist + per-doc "last verified" front-matter.

**Out of scope:**
- The actual code fixes the docs will then describe accurately — those live in their own PRDs (auth = PRD-203, GDPR = PRD-213, logging = PRD-215, etc.). This PRD documents reality; it does not change behaviour.
- Auto-generated API reference docs — out of suite.
- The `template-registry.ts` "auto-generated but undocumented" note → owned by **PRD-210** (template source-of-truth).

## 6. Non-functional requirements

| NFR | Requirement |
|---|---|
| Accuracy | Every field name / service / endpoint in the reconciled docs is verified against the code at time of writing |
| Traceability | Each doc carries a "last verified against `<ref>`" date |
| Legal safety | No compliance claim ("HIPAA Ready") ships without legal/DPO sign-off |
| Discoverability | The audit doc links to the live remediation tracker |
| Maintainability | The freshness checklist makes future drift visible in code review |

## 7. Success metrics

- 0 NextAuth/`/api/auth/session` references in the reconciled auth docs.
- 0 Abacus.AI references in the domain/super-admin/subdomain docs.
- 0 `slug`/`TenantStatus` references in `MULTI_TENANT_ARCHITECTURE.md` that don't exist in the schema.
- 0 unsubstantiated "HIPAA Ready"/"5-min"/"Lighthouse 90+" claims in marketing docs (or each is cited).
- 100% of May-01 audit findings annotated with a fix/PRD status.
- Every reconciled doc carries a "last verified" date.

## 8. API surface

None — documentation only.

## 9. Data model changes

None.

## 10. Events emitted / consumed

None.

## 11. UI / UX

None (Markdown docs only). The reconciled docs should keep a consistent header block (`Status`, `Last verified`, `Describes`) for scannability.

## 12. Test plan

**Unit / lint (advisory, wired in PRD-216):**
- A `docs-lint` grep gate: fails (advisory) if the reconciled auth docs reintroduce `next-auth`/`/api/auth/session`, if domain docs reintroduce `abacus`, or if marketing docs reintroduce the banned claim strings without an adjacent citation marker.

**Integration (manual verification, recorded in the PR):**
- For each reconciled doc, a reviewer cross-checks the named fields/services against the code (`prisma/schema.prisma`, `@clerk/nextjs` usage, Railway domain routes) and records the verification date.

**E2E:** N/A (no runtime behaviour).

**Reader test (per global workflow):** a fresh reader (subagent or second engineer) reads each reconciled doc with no prior context and confirms it leaves no claim that contradicts the running system.

**Coverage target:** N/A (docs). Completion = all 9 docs reconciled + checklist created + audit annotated.

## 13. Open questions

- [ ] **OQ-1** Retire vs rewrite `SUBDOMAIN_DEPLOYMENT_STATUS.md` and `SAAS_ARCHITECTURE_PLAN.md` (NFT) — are these still referenced anywhere, or pure history? Owner: Gerard. Resolution: if unreferenced, move to `docs/archive/` with a dated "point-in-time" header rather than deleting (preserve history).
- [ ] **OQ-2** Does the business still intend an NFT-membership feature (keep the plan as a roadmap doc) or is it dead (remove)? Owner: Gerard. Resolution: relabel as roadmap-only if alive; remove if dead.
- [ ] **OQ-3** What is the defensible compliance statement to replace "HIPAA Ready"? Owner: legal/DPO. Resolution: likely "GDPR-aligned; PHI encrypted at rest; HIPAA controls in progress (see remediation suite)" — DPO to confirm exact wording.
- [ ] **OQ-4** Should the May-01 audit annotations live inline or as a companion `SECURITY_AUDIT_2026-05-01-STATUS.md`? Owner: Gerard. Resolution: inline status tags + a header link to the remediation index (single source of truth).

## 14. Dependencies

**Strict:** None — can begin immediately.

**Blocks:**
- **PRD-215** — operational runbooks must reference a *current* architecture doc; reconciling the architecture docs first prevents runbooks inheriting the stale topology.

**Soft:**
- **PRD-210** — the `template-registry.ts` "auto-generated" documentation note is owned there; coordinate so the template docs tell one consistent story.
- The reconciled docs become accurate *as the corresponding code PRDs land* (PRD-203 auth, PRD-213 GDPR, PRD-215 logging) — note any "in remediation" caveats and date them so they can be lifted on completion.

## 15. Estimated effort

- **Reconcile 6 architecture/ops docs (auth, domain, multi-tenant, SaaS plan, arch+deploy, subdomain):** 12 hours
- **`SUPER_ADMIN_MANUAL.md` Railway rewrite:** 3 hours
- **Sales-claim audit + rewrite + legal sign-off loop:** 5 hours
- **`SECURITY_AUDIT_2026-05-01.md` annotation against the remediation suite:** 4 hours
- **`DOC_FRESHNESS_CHECKLIST.md` + per-doc front-matter + reader test:** 4 hours
- **Total:** ≈ 28 hours (≈ 4 days for 1 dev + Claude pair, including the legal sign-off loop)

## 16. References

- Stale docs (verified 2026-05-29): `docs/AUTHENTICATION_FLOWS.md` (`/api/auth/session` at `:54`, 0 Clerk refs), `docs/DOMAIN_SETUP_INSTRUCTIONS.md` (23 Abacus / 0 Railway), `docs/MULTI_TENANT_ARCHITECTURE.md` (`TenantStatus` ×2 + `slug` — schema has `subdomain`/`isActive`), `docs/SAAS_ARCHITECTURE_PLAN.md` (75 NFT refs; schema has only vestigial `nftTokenId`), `docs/BUDSTACK_ARCHITECTURE_AND_DEPLOYMENT.md` (15 NextAuth refs), `docs/SUBDOMAIN_DEPLOYMENT_STATUS.md` (Abacus nameservers `:45`, "live" template table), `docs/SUPER_ADMIN_MANUAL.md` (4 Namecheap refs), `docs/SECURITY_AUDIT_2026-05-01.md` (217 lines, ~2 annotation lines), `docs/BUDSTACK_SALES_PITCH.md` (HIPAA/5-min/Lighthouse claims)
- Source of truth for reconciliation: `prisma/schema.prisma` (`tenants` `:418`, `nftTokenId` `:423`), `@clerk/nextjs` usage (`app/api/webhooks/clerk/route.ts`, `currentUser()`), Railway domain routes under `app/api/super-admin/`
- Cross-PRD: PRD-203 (auth reality the auth docs describe), PRD-213 (GDPR claims), PRD-215 (ops runbooks), PRD-210 (template docs)
- Memory: `project_railway_environments.md` (Railway is the hosting/domain control plane), template-architecture rules (data-driven, S3 source of truth)
- 2026-05-29 review: the six stale-doc findings + sales-pitch claims + un-annotated audit + Namecheap-vs-Railway manual

## 17. Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-05-29 | Claude (with Gerard) | Initial draft from 2026-05-29 review. |
| 0.2 | 2026-05-29 | Claude (Opus 4.8) | Verified each doc exists under `docs/` and re-counted the stale claims against the code (Abacus ×23, NFT ×75, NextAuth ×15, Namecheap ×4; schema has `subdomain`/`isActive`/vestigial `nftTokenId`, not `slug`/`TenantStatus`/NFT model; auth doc uses `/api/auth/session`). Added the doc-freshness checklist + per-doc "last verified" front-matter and the advisory docs-lint gate. |
