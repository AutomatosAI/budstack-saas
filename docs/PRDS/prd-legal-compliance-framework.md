# PRD: Legal & Compliance Framework

## 1. Introduction
BudStacks is a B2B SaaS platform serving licensed cannabis operators. Our partners (Healing Buds, LekkerWeed, Cannabis Express, etc.) operate under regulated regimes — UK MHRA Regulation 279 / Blue Guide, Portugal INFARMED, South Africa SAHPRA — and must comply with strict cannabis advertising rules from Meta, LinkedIn, Google.

Today our platform legal posture has gaps: privacy/terms/cookies pages are generic boilerplate dated Jan 2025, there is no Acceptable Use Policy, no Data Processing Addendum, no published sub-processor list, no cookie consent banner, and no clear contractual separation of "platform vs operator" responsibilities. This PRD closes those gaps to (a) protect BudStacks from regulatory exposure tied to partner conduct, (b) provide enterprise-grade legal artefacts that EU operators expect, and (c) align partner-facing copy with Dr. Green's published marketing guidelines so the ecosystem stays consistent.

This is not a Dr.Green-specific project — the framework must serve any licensed cannabis operator on BudStacks.

## 2. Goals
- **Platform/operator separation:** Every legal artefact makes it explicit that BudStacks provides infrastructure; operators are responsible for licensing, marketing compliance, age verification, and product claims.
- **GDPR enterprise readiness:** Article 28 DPA, sub-processor list, Article 9 special-category data handling, breach SLAs.
- **PECR / cookie consent:** Granular opt-in cookie banner before any non-essential cookie fires.
- **Partner enablement:** Single Partner Compliance Guide that operators can hand to their own counsel and marketing team — covers Reg 279, MHRA Blue Guide, Meta/LinkedIn ad policies.
- **Marketing copy hygiene:** No therapeutic / cure / strain-treatment claims anywhere on budstack.to or `*.budstacks.io`.
- **Auditable:** Every page versioned with "Last updated" + changelog; legal changes go through review before merge.

## 3. Non-Goals
- Legal advice for individual operators (they retain their own counsel).
- Replacing operator-side compliance tooling (age gates, KYC, prescription validation) — those live on the storefront templates.
- Becoming a controller of patient data — BudStacks remains a processor.
- Jurisdiction-specific adaptation beyond UK / EU / South Africa for v1.

## 4. User Stories

### US-001: Operator signs DPA at onboarding
**Description:** As a UK clinic onboarding to BudStacks, I need a signed Data Processing Agreement before I store patient data on the platform, or my own DPO will block the deal.

**Acceptance Criteria:**
- [ ] DPA presented during onboarding flow (after T&Cs, before tenant creation).
- [ ] Click-through accept logged with timestamp, IP, signed user.
- [ ] Operator can download PDF copy of accepted DPA from tenant settings.
- [ ] Contains Article 28 mandatory elements: subject matter, duration, nature/purpose, type of personal data, categories of data subjects, controller/processor obligations.

### US-002: Visitor sees cookie consent banner
**Description:** As an EU/UK visitor to budstack.to, I must give explicit consent before analytics cookies fire (PECR / GDPR).

**Acceptance Criteria:**
- [ ] Banner appears on first visit, blocks analytics until decision.
- [ ] Granular toggles: Essential (always on), Analytics, Preferences.
- [ ] "Reject all" is as prominent as "Accept all".
- [ ] Decision stored 12 months; reopenable from footer link.
- [ ] No consent → no Vercel Analytics, no Clerk telemetry beyond auth-required, no third-party scripts.

### US-003: Regulator skim-reads our marketing site
**Description:** As an MHRA inspector visiting budstack.to, I need to immediately see this is a B2B platform, not consumer cannabis advertising.

**Acceptance Criteria:**
- [ ] Footer compliance line on every page: "BudStacks is a B2B SaaS platform for licensed cannabis operators…"
- [ ] No therapeutic claims, no strain names paired with conditions, no consumer-facing pricing for cannabis products.
- [ ] Hero / About copy explicitly mentions "licensed operators" within first viewport.

### US-004: Operator reads Partner Compliance Guide
**Description:** As a new partner about to launch a storefront, I need a clear one-pager telling me what I can and cannot do on Meta/LinkedIn/Google ads, and what my storefront must include (age gate, disclaimer).

**Acceptance Criteria:**
- [ ] `/partners/compliance` public page covers: MHRA Reg 279, Blue Guide, Meta cannabis policy, LinkedIn ad rules, age gate requirement, mandatory educational disclaimer text.
- [ ] Linked from onboarding final step + tenant admin sidebar.
- [ ] Downloadable as PDF.

### US-005: Operator views sub-processors before signing
**Description:** As an enterprise operator's procurement team, I need a public sub-processor list to evaluate vendor risk before contract.

**Acceptance Criteria:**
- [ ] `/legal/subprocessors` lists all vendors: Clerk, Railway, AWS S3, Postgres, Redis, Stripe, Dr.Green API.
- [ ] Each entry: name, purpose, region, transfer mechanism (SCC where applicable), DPA link.
- [ ] RSS / email subscription option for changes (notice obligation).

### US-006: Updated date is real
**Description:** As anyone reading our legal pages, I should see when they were last updated and what changed.

**Acceptance Criteria:**
- [ ] Each legal page reads "Last updated" from a single source of truth.
- [ ] `/legal/changelog` page lists material changes with dates.
- [ ] Date updates automatically on content change via build step or git hook.

## 5. Functional Requirements

### 5.1 Pages — new and rewritten

| Path | Type | Owner | Status |
|---|---|---|---|
| `/privacy` | Rewrite | Legal | Existing — gut and rebuild to GDPR Article 28 standard |
| `/terms` | Rewrite | Legal | Existing — add platform/operator separation, partner obligations, AUP reference |
| `/cookies` | Rewrite | Legal | Existing — add specific cookie list, fix dark-theme bug at line 103 |
| `/aup` | New | Legal | Acceptable Use Policy — what partners can/cannot do |
| `/dpa` | New | Legal | Data Processing Addendum — clickwrap version + downloadable PDF |
| `/legal/subprocessors` | New | Legal | Public sub-processor registry |
| `/legal/changelog` | New | Legal | Versioned change log |
| `/partners/compliance` | New | Marketing + Legal | Partner Compliance Guide |

### 5.2 Cookie consent

- Library candidates: `cookieconsent` (open-source), `iubenda` (managed), or custom Tailwind banner backed by a `localStorage` flag.
- Recommendation: custom banner — small surface, matches `.budstacks-theme`, no third-party dependency.
- Implementation:
  - `components/legal/CookieBanner.tsx` — sticky bottom banner, three toggles, persists `consent` cookie (12mo).
  - `lib/consent.ts` — `getConsent()`, `setConsent()`, `useConsent()` hook.
  - Gate analytics scripts in `app/layout.tsx` on `consent.analytics === true`.
  - Re-open trigger in footer "Cookie preferences" link.

### 5.3 Footer compliance line

Add below existing copyright row in `components/homepage/Footer.tsx`:

> *BudStacks is a B2B SaaS platform for licensed cannabis operators. We do not sell, advertise, or recommend cannabis products to consumers. Operators are solely responsible for regulatory compliance in their jurisdictions.*

### 5.4 Marketing copy guardrails

- Add ESLint custom rule (or simple pre-commit grep) to flag forbidden phrases in `components/homepage/**`, `app/**/page.tsx`, blog content:
  - `cure`, `treats`, `treatment for`, `relieves`, `heals`, `medicine for`
  - Specific strain + condition pairings (regex: `(blue zushi|og kush|...)\s+(for|treats|relieves)`)
- Allow-list: `medical-cannabis` (B2B-safe noun), `patient` (operational language for operators), `prescription` (factual), `regulated` (factual).

### 5.5 DPA / clickwrap

- DPA stored as MDX in `content/legal/dpa-v1.mdx` so legal can edit without code changes.
- Acceptance recorded in new `tenant_legal_acceptances` table:
  ```
  id, tenant_id, document_slug ('dpa', 'tos', 'aup'), version, accepted_at, accepted_by_user_id, ip_address, user_agent
  ```
- Re-prompt operator if document version bumps.

### 5.6 Onboarding flow integration

Insert before tenant-creation submit:
1. T&Cs checkbox (existing) → record acceptance row
2. **NEW:** DPA checkbox + "Read full DPA" link → record acceptance row
3. **NEW:** AUP checkbox → record acceptance row
4. **NEW:** Confirmation: "I confirm my organisation holds all required licences in the operating jurisdiction" → record acceptance row

### 5.7 Partner Compliance Guide content sections

1. Who is responsible for what (platform vs operator)
2. UK: MHRA Regulation 279, Blue Guide — what you cannot say about cannabis products
3. Meta cannabis policy summary — community-only, no sales, no ads
4. LinkedIn cannabis policy — B2B only, no paid promotion, no recreational language
5. Google Ads cannabis policy — restricted; CBD topical-only with certification
6. Mandatory storefront elements: age gate (18+ or 21+ per locale), educational-purposes disclaimer, no therapeutic claims in product copy
7. KYC + prescription validation requirements (where applicable)
8. Reporting incidents to BudStacks (template form)

## 6. Non-Functional Requirements

- **Accessibility:** WCAG 2.1 AA — cookie banner keyboard navigable, contrast tokens from `.budstacks-theme` palette.
- **i18n-ready:** All legal copy keyed for future translation (PT, ES, ZA-EN minimum). v1 ships English only.
- **Performance:** Cookie banner CSS+JS < 4 KB gzipped; no layout shift on load.
- **SEO:** Legal pages indexable; partner compliance guide indexable for partner discovery.
- **Versioning:** Material changes bump version (e.g. `dpa-v1` → `dpa-v2`) and re-prompt acceptance.

## 7. Phased Delivery

### Phase 1 — Quick wins (1 day, separate small PR)
- [ ] Update "Last updated" dates on existing 3 legal pages
- [ ] Add platform/operator framing line to T&Cs §1
- [ ] Generalise T&Cs §2 ("Dr. Green NFT" → "valid operating licence")
- [ ] Add footer compliance line
- [ ] Fix `bg-slate-100` light-theme bug in `app/cookies/page.tsx:103`
- [ ] Add hero qualifier ("for licensed operators")

### Phase 2 — Legal artefacts (3–5 days)
- [ ] Rewrite `/privacy` to Article 28 standard
- [ ] Rewrite `/terms` with full partner obligations + AUP reference
- [ ] Rewrite `/cookies` with specific cookie list
- [ ] New `/aup` Acceptable Use Policy
- [ ] New `/legal/subprocessors`
- [ ] New `/legal/changelog`

### Phase 3 — Partner enablement (3 days)
- [ ] `/partners/compliance` Partner Compliance Guide page + PDF export
- [ ] Link from onboarding completion + tenant admin sidebar

### Phase 4 — DPA + onboarding integration (5 days)
- [ ] `/dpa` clickwrap page (MDX-driven)
- [ ] `tenant_legal_acceptances` table + Prisma model
- [ ] Onboarding flow: T&Cs / DPA / AUP / licence confirmation checkboxes
- [ ] Tenant admin "Legal" tab — view/download accepted documents

### Phase 5 — Cookie consent (2 days)
- [ ] `CookieBanner` component + `useConsent` hook
- [ ] Gate analytics scripts on consent
- [ ] "Cookie preferences" footer link to re-open

### Phase 6 — Marketing copy guardrails (1 day)
- [ ] Pre-commit grep rule for forbidden phrases
- [ ] Audit existing pages, fix any matches

## 8. Out of Scope (future PRDs)
- Storefront-side enforcement of age gate / disclaimer (template defaults work — separate enforcement PRD)
- Automated regulatory reporting (INFARMED, MHRA submissions)
- Per-jurisdiction T&C variants (US state-level cannabis regulation)
- SOC 2 / ISO 27001 certification track
- Operator-side legal artefact generator (DPA between operator and their own customers)

## 9. Open Questions
- Counsel review needed before publishing DPA — who is BudStacks' legal counsel of record? (UK or PT firm?)
- Do we need separate DPA versions for UK GDPR vs EU GDPR post-Brexit?
- Trademark attribution — confirm legal entity holding "Dr. Green" marks for footer attribution
- Sub-processor change notice period — 30 days standard; confirm with enterprise prospects
- Do we want managed cookie banner (Iubenda) for legal cover, or custom + own the risk?

## 10. References
- MHRA Blue Guide: Advertising and Promotion of Medicines in the UK
- Regulation 279 of the Human Medicines Regulations 2012
- Dr. Green Brand Guidelines v2 (`/Users/gkavanagh/Development/HealingBuds/templates/dr green brand guidelines v2.pdf`)
- Dr. Green General Marketing Guidelines v1 (`/Users/gkavanagh/Development/HealingBuds/templates/general-marketing-guidelines-dr-green-v1.pdf`)
- GDPR Article 28 (data processor obligations)
- GDPR Article 9 (special category data — patient health)
- PECR (Privacy and Electronic Communications Regulations) — UK cookie consent
- Meta Restricted Goods & Services Policy — Cannabis
- LinkedIn Advertising Policies — Illegal Products
