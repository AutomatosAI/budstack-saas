# PRD-210 — Template Source-of-Truth Restoration (kill `TEMPLATE_PRESETS`, remove hardcoded HealingBuds branding)

> **Status:** Proposed
> **Phase:** R4 — Template & Data Discipline
> **Severity:** HIGH _(not a security hole, but a direct breach of the platform's foundational data-driven-template rule. Every white-label tenant onboarded today inherits HealingBuds colours/copy/logo baked into platform code — see [Pre-flight verification](./REMEDIATION-INDEX.md#pre-flight-verification--2026-05-29). Blocks signing a second white-label tenant.)_
> **Module(s) touched:** `app/api/onboarding/route.ts`, `components/navigation.tsx`, `components/footer.tsx`, `components/home/*.tsx`, `lib/template-registry.ts`, `lib/section-registry.ts` (doc only), `app/store/[slug]/layout.tsx` (legacy-fallback removal)
> **Depends on:** None to start. Cleaner after PRD-205 (tenant-resolution consolidation) but not blocked by it.
> **Blocks:** Onboarding a second white-label tenant without HealingBuds bleed-through. Soft-blocks PRD-214 (doc reconciliation) — the "data-driven templates" claim cannot be documented as true until this lands.
> **Owner:** Gerard + Claude.
> **Last updated:** 2026-05-29

---

## 1. Problem

**The single most important architectural rule in BudStacks is: all templates are data-driven from S3.** `layout.json` defines section composition; `defaults.json` defines colours, copy, navigation, footer, logo, and hero per tenant. Platform code must contain **zero** template-specific values — no template name, logo path, colour, slug, copy string, or contact detail. **HealingBuds is a template like any other** and must receive no special treatment in platform code. The store layout already honours this for the render path: `app/store/[slug]/layout.tsx:160` loads `{ layout, defaults, customCss } = await getTemplateAssets(tenantS3Path)` and feeds `defaults?.navigation`, `defaults?.footer`, `defaults?.pageContent`, and `activeTemplate?.designSystem` into the section components (`:190-192`). The rule is real and mostly enforced. **Three places violate it.**

1. **`TEMPLATE_PRESETS` overrides the S3 `defaults.json` colours at onboarding (HIGH).** `app/api/onboarding/route.ts:41-66` hardcodes a `TEMPLATE_PRESETS` map (`modern`/`medical`/`natural`/`premium`, each with `primaryColor`/`secondaryColor`/`accentColor`/`fontFamily`). At `:236-238` the handler picks `TEMPLATE_PRESETS[templateId] || TEMPLATE_PRESETS.modern` and at `:260-270` writes those **hardcoded** colours into `tenant_branding`. Meanwhile, **20 lines later** the same handler reads the real source of truth — `:285` `getJsonFromS3(...defaults.json)` — and seeds `designSystem`/`pageContent`/`navigation`/`footer` from it into `tenant_templates` (`:286-301,307-318`). So a brand-new tenant ends up with **two competing colour sources**: the template's true `defaults.json` `designSystem` in `tenant_templates`, and a hardcoded green "modern" preset in `tenant_branding`. The hardcoded preset wins wherever `tenant_branding` is read. This is exactly the "onboarding writes hardcoded preset colours instead of loading template defaults" defect noted in project memory.

2. **Hardcoded HealingBuds branding in generic platform components (HIGH).** The legacy fallback components — rendered whenever a template does not declare a section-registry nav/footer (`app/store/[slug]/layout.tsx:233,270`) — are stuffed with HealingBuds-specific values:
   - `components/navigation.tsx`: `brandName = tenant?.businessName || "HealingBuds"` (`:44`); logo fallbacks `/hb-logo-dark.png` / `/hb-logo-white.png` (`:49`); colour fallbacks `#059669` / `#10b981` (`:53-54`); hardcoded path `"/store/healingbuds"` (`:69`).
   - `components/footer.tsx`: `logoUrl || "/healingbuds-logo-white.jpeg"` (`:36`); `brandName || "HealingBuds"` (`:37`); `"/store/healingbuds"` (`:41`); `info@healingbuds.pt` (`:45`); colour fallbacks `#1f2937`/`#10b981` (`:78,81`).
   - `components/home/*.tsx`: `consultationUrl = "/store/healingbuds/consultation"` in `hero-section.tsx:33`, `call-to-action.tsx:26`, `process-steps.tsx:25`, `featured-conditions.tsx:25`; `brandName || "HealingBuds"` (`hero-section.tsx:37`, `call-to-action.tsx:28`); the literal copy `"How HealingBuds Works"` (`process-steps.tsx:109`); `emergency@healingbuds.pt` (`call-to-action.tsx:239`); five full HealingBuds testimonial paragraphs in `testimonials-slider.tsx:29-65`; colour `#10b981` (`hero-section.tsx:39`). A second white-label tenant whose template omits a section-registry nav/footer is served **HealingBuds' brand name, logo, links, and copy**.

3. **`lib/template-registry.ts` "auto-generated" claim is stale (LOW, doc hygiene).** Project memory and several docs call `lib/template-registry.ts` an auto-generated file ("do not edit manually"). The file's **actual** header (`:4-14`) says it is the **legacy React-template registry**, that all templates have migrated to data-only `layout.json`, and `TEMPLATE_COMPONENTS` is now an **empty object** (`:17-19`). There is no generator and nothing is generated. The live data-driven registry is `lib/section-registry.ts` — **49** section components (verified count, not the "21" some notes cite), looked up by name via `getSectionComponent()` (`:117-119`). The doc/comment claims must be reconciled to behaviour.

This PRD makes onboarding seed colours/copy/logo/nav **exclusively** from the template's `defaults.json`, strips every HealingBuds literal out of the generic components (replacing them with neutral, data-driven props or empty states), and reconciles the registry documentation to what the code actually does.

## 2. Users / personas

| Role | How they benefit |
|---|---|
| **New white-label tenant** | Their storefront shows *their* brand from minute one — never HealingBuds colours, logo, or copy |
| **Gerard / ops** | Onboarding seeds one consistent source of truth (`defaults.json`); no "why is the new tenant green?" support tickets |
| **Template author** | `defaults.json` is honoured end-to-end; editing it actually changes the storefront, with no hidden platform override |
| **Prospective enterprise tenant** | The "is this truly white-label / multi-tenant?" diligence question has a clean, demonstrable answer |

## 3. User stories

- As a **new tenant** onboarding with template X, my storefront's colours, fonts, logo, navigation, footer, and homepage copy come entirely from template X's `defaults.json` — I never see HealingBuds branding.
- As a **template author**, when I change a colour or a headline in `defaults.json`, that change appears on every tenant using my template, with no platform-code override fighting it.
- As a **developer**, a grep gate stops me from reintroducing a hardcoded template name, slug, logo path, or brand colour into platform code.
- As **Gerard**, the registry docs match the code — no one wastes an afternoon editing an "auto-generated" file that has no generator.

## 4. Acceptance criteria

**Kill `TEMPLATE_PRESETS`:**

- [ ] **AC-1** `TEMPLATE_PRESETS` (the const at `app/api/onboarding/route.ts:41-66`) is **deleted**. No hardcoded colour/font map remains in onboarding.
- [ ] **AC-1a** `tenant_branding` colours/font at onboarding are populated from the template's `defaults.json` `designSystem` (the same object read at `:285`), not a preset. When `defaults.json` omits a colour, the field is left **null/unset** (so `TenantThemeProvider` falls back to the template's own `:root` CSS vars per the project's CSS-variable contract) — never backfilled with a hardcoded green.
- [ ] **AC-1b** The redundant `templatePreset` write in `tenant.settings` (`:254`) is removed or replaced with the resolved `templateSlug`; no `"modern"` default string is persisted.

**Strip HealingBuds literals from generic components:**

- [ ] **AC-2** `components/navigation.tsx`: `brandName` falls back to a neutral value (empty string / `tenant?.businessName ?? ""`), logo has **no** `/hb-logo-*.png` default (render no logo if none supplied), colour fallbacks are removed or sourced from CSS vars, and the `"/store/healingbuds"` literal is replaced by the already-present `getTenantBasePath(...)` resolution (the literal at `:69` is dead-fallback only — remove it).
- [ ] **AC-2a** `components/footer.tsx`: remove `"/healingbuds-logo-white.jpeg"`, `"HealingBuds"`, `"/store/healingbuds"`, `info@healingbuds.pt`, and the hardcoded gradient colours; source brand/contact/links/colours from props/`defaults.json` with neutral empty states.
- [ ] **AC-2b** `components/home/*.tsx`: remove every `"/store/healingbuds/consultation"` literal (derive from `getTenantBasePath`), `"HealingBuds"` brand fallbacks, `"How HealingBuds Works"` copy, `*@healingbuds.pt` emails, the hardcoded `#10b981` colour, and the five HealingBuds testimonial strings in `testimonials-slider.tsx`. Copy comes from `pageContent` (`defaults.json`); absent copy renders an empty/neutral state, not HealingBuds text.
- [ ] **AC-2c** A repo-wide grep gate (CI, PRD-216) asserts **zero** occurrences of `HealingBuds`, `healingbuds`, `hb-logo`, `healingbuds.pt`, or `/store/healingbuds` under `app/` and `components/` **except** the intentionally-named data-driven section component `components/sections/navigation/NavHealingBuds.tsx` (which is a *template-selectable* style, registered by name, not platform default) and homepage marketing mock components under `components/homepage/*` that depict the BudStacks product (allow-listed explicitly).

**Registry documentation:**

- [ ] **AC-3** `lib/template-registry.ts` header is corrected: it is the **legacy** React-template registry, `TEMPLATE_COMPONENTS` is intentionally empty, there is **no** generator, and the live registry is `lib/section-registry.ts`. The stale "auto-generated — do not edit" claim is removed from the file and from project memory/docs (cross-ref PRD-214).
- [ ] **AC-3a** `lib/section-registry.ts` gets a one-line header documenting that it is the **authoritative, hand-maintained** map of data-driven section components (currently 49) resolved by `getSectionComponent(type)`, and that adding a section means adding an import + a map entry here.

**Render parity:**

- [ ] **AC-4** A seeded tenant whose `defaults.json` declares a section-registry nav/footer renders identically before and after (the legacy components are not on its path). A seeded tenant that falls back to the legacy `Navigation`/`Footer` now shows **its own** `businessName`/logo/colours (or neutral empties), never HealingBuds.

## 4.1 Design framework conformance

The whole PRD *is* a data-driven-template conformance fix. No new UI primitives. Visual output for existing HealingBuds tenants is unchanged (they supply the same values via their own `defaults.json` / DB), while non-HealingBuds tenants stop inheriting HealingBuds branding.

- [x] Data-driven template rule **restored** — zero template-specific values in platform code (the core deliverable)
- [x] No new tokens / primitives — N/A
- [x] CSS-variable contract respected — absent colours fall through to the template's `:root` vars, never a hardcoded hex (per project CSS-var rule)
- [x] HealingBuds render unchanged (values now come from its own `defaults.json`/DB) — manual visual diff on the live HealingBuds tenant

## 5. Scope

**In scope:** delete `TEMPLATE_PRESETS`; seed `tenant_branding` from `defaults.json`; strip HealingBuds literals from `navigation.tsx`, `footer.tsx`, `components/home/*`; correct registry docs; remove dead `/store/healingbuds` fallbacks; grep gate; render-parity verification.

**Out of scope:**
- Deleting the legacy `Navigation`/`Footer`/`home/*` components entirely → tracked separately (they remain as generic neutral fallbacks; full removal once all templates declare section-registry nav/footer is a follow-up under PRD-209 code-health).
- Onboarding's broader Zod/validation hardening → PRD-204.
- The `legacyCss` extraction path and its XSS sink → PRD-200.
- Tenant-resolution consolidation that feeds the layout → PRD-205.
- Migrating remaining tenants off legacy components → follow-up ticket.

## 6. Non-functional requirements

| NFR | Requirement |
|---|---|
| Data-driven discipline | Zero template-specific literals in `app/`/`components/` (grep-gated), excluding the allow-listed `NavHealingBuds` section + `components/homepage/*` marketing mocks |
| Backward compatibility | Existing HealingBuds tenant renders identically (values now from its own `defaults.json`/DB) |
| Correctness | One colour source per tenant — `defaults.json` `designSystem`; no `tenant_branding` vs `tenant_templates` divergence |
| Performance | No added S3 reads at onboarding (reuses the `defaults.json` fetch already at `:285`) |
| Immutability | Component refactors build new props objects; no mutation of `tenant`/`defaults` |

## 7. Success metrics

- `TEMPLATE_PRESETS` references in the codebase = **0**.
- Grep gate: **0** `HealingBuds`/`healingbuds`/`hb-logo`/`healingbuds.pt` matches under `app/`+`components/` outside the allow-list.
- A freshly-onboarded non-HealingBuds tenant shows **0** HealingBuds-branded strings/assets in its rendered storefront (E2E assertion).
- `tenant_branding.primaryColor` for a new tenant equals its template's `defaults.json` `designSystem` value (or is null), never `#10b981` from the deleted preset.

## 8. API surface

| Method | Path | Change |
|---|---|---|
| POST | `/api/onboarding` | Seeds `tenant_branding` from template `defaults.json` instead of `TEMPLATE_PRESETS`; no behavioural change to request/response shape |

No new endpoints. No response-contract change (internal seeding logic only).

## 9. Data model changes

None to the schema. **Data semantics** change: `tenant_branding` colour columns now reflect the template's `defaults.json` (or null) rather than a hardcoded preset. A one-off backfill script may re-seed existing tenants whose branding was written by the old preset path (optional, behind Gerard sign-off — see §13 OQ-2).

## 10. Events emitted / consumed

| Event | Direction | Payload | Subscribers |
|---|---|---|---|
| `template.branding_seeded` | emit (log) | `{ tenantId, templateSlug, source: "defaults.json" }` | logs / audit (PRD-215) |

(Log line today; PRD-215 formalises the event bus.)

## 11. UI / UX

No new UI surface. Existing HealingBuds storefront is visually unchanged. Non-HealingBuds tenants stop showing HealingBuds branding in the legacy-fallback nav/footer/home path — they show their own brand or a neutral empty state until their `defaults.json` supplies the value.

## 12. Test plan

**Unit (Vitest — stood up in PRD-207):**
- `onboarding.branding.test.ts` — given a template `defaults.json` with a `designSystem`, the seeded `tenant_branding` matches it; given one without colours, the columns are null (no `#10b981` backfill). `TEMPLATE_PRESETS` is gone.
- `navigation.fallback.test.ts` / `footer.fallback.test.ts` — with `tenant.businessName = "Acme"` and no logo, the rendered output shows "Acme" and no `/hb-logo-*` asset; with no businessName, neutral empty (never "HealingBuds").

**Integration:**
- `onboarding.route.test.ts` — POST onboarding for a non-HealingBuds template; assert `tenant_branding` row carries that template's `defaults.json` colours and `tenant.settings` has no `"modern"` preset string.

**E2E (Playwright):**
- `tenant-branding-isolation.spec.ts` — seed a tenant on a non-HealingBuds template that uses the legacy nav/footer fallback; load its storefront; assert the DOM contains the tenant's brand and **no** "HealingBuds" text, `hb-logo`, or `healingbuds.pt` substring.

**Grep gate (wired into PRD-216 CI):**
- No HealingBuds literals under `app/`+`components/` outside the allow-list (AC-2c).

**Coverage target:** 80% on the touched onboarding seeding path + the two fallback components (baseline; not security-critical, so the 95% security tier does not apply).

## 13. Open questions

- [ ] **OQ-1** Should the legacy `Navigation`/`Footer`/`home/*` components be **deleted** once every active template declares a section-registry nav/footer, or kept as a neutral generic fallback indefinitely? Owner: Gerard. Resolution: keep neutral for now; open a PRD-209 follow-up to delete once the last legacy-fallback tenant is migrated.
- [ ] **OQ-2** Do we backfill existing tenants whose `tenant_branding` was written by the old `TEMPLATE_PRESETS` path (re-seed from their `defaults.json`), or leave their current saved colours intact? Owner: Gerard. Resolution: default to leaving saved branding untouched (tenants may have customised it post-onboarding); offer an opt-in re-seed script.
- [ ] **OQ-3** `NavHealingBuds.tsx` is a template-selectable section style named after the original template. Rename to a generic style name (e.g. `NavDarkEdge`) to fully purge the brand from code, or keep the name as a registered style key? Owner: Gerard. Resolution: keep the registry key stable for now (templates reference it by name); add to the allow-list; rename in a coordinated template+code change later.
- [ ] **OQ-4** Are the `components/homepage/*` BudStacks marketing mocks (e.g. `BigDashboard.tsx`, `Partners.tsx`, `StorefrontPreview.tsx`) in scope? They depict HealingBuds as a *showcase example* on the BudStacks marketing site, not as a tenant default. Owner: Gerard. Resolution: allow-list them (they are BudStacks-product marketing, not tenant-template code); revisit if the marketing site is templatised.

## 14. Dependencies

**Strict:** None — can start immediately.

**Soft:**
- PRD-205 (tenant-resolution consolidation) — the layout that selects legacy vs section-registry components is cleaner post-consolidation, but this PRD works against the current resolver state.
- PRD-207 (test foundation) — the unit/integration/E2E tests need the Vitest harness; until it lands, ship the grep gate + E2E and backfill units with PRD-207.
- PRD-214 (doc reconciliation) — consumes AC-3's corrected registry facts.
- PRD-216 (CI gates) — hosts the grep gate.

## 15. Estimated effort

- **Delete `TEMPLATE_PRESETS` + seed `tenant_branding` from `defaults.json`:** 3 hours
- **Strip HealingBuds literals from `navigation.tsx` + `footer.tsx`:** 3 hours
- **Strip HealingBuds literals from `components/home/*` (6 files incl. testimonials):** 4 hours
- **Registry doc reconciliation (`template-registry.ts` + `section-registry.ts` headers + memory/docs):** 2 hours
- **Grep gate + allow-list:** 2 hours
- **Tests (unit + integration + E2E) + render-parity diff:** 6 hours
- **Optional re-seed backfill script (OQ-2):** 2 hours
- **Total:** ≈ 22 hours (≈ 3 days for 1 dev + Claude pair)

## 16. References

- Existing code: `app/api/onboarding/route.ts:41-66,236-238,254,260-270,285-301,307-318`, `components/navigation.tsx:44,49,53-54,69`, `components/footer.tsx:36-37,41,45,78,81`, `components/home/hero-section.tsx:33,37,39`, `components/home/call-to-action.tsx:26,28,239`, `components/home/process-steps.tsx:25,109`, `components/home/featured-conditions.tsx:25`, `components/home/testimonials-slider.tsx:29-65`, `lib/template-registry.ts:1-19`, `lib/section-registry.ts:64-119`, `app/store/[slug]/layout.tsx:98,160,190-192,218-219,233,264,270`, `lib/tenant.ts:86` (`getTemplateAssets`)
- Project rule: `MEMORY.md` — "Template Architecture — ABSOLUTE RULES" (all templates data-driven via `layout.json`/`defaults.json`; never hardcode template-specific values; HealingBuds is a template like any other); "Data-Driven Rendering"; "CSS Variables"; "Branding Save Gotcha (Fixed Feb 6 2026)" (onboarding writes hardcoded preset colours — this PRD closes it)
- Tenant S3 path: `tenants/{tenantId}/templates/{templateSlug}/`, one path per tenant, no base fallback (`MEMORY.md` Tenant S3 Path Architecture)
- 2026-05-29 review: finding #11 (hardcoded HealingBuds branding + `TEMPLATE_PRESETS`), plus `template-registry.ts` auto-generated-claim finding

## 17. Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-05-29 | Claude (with Gerard) | Initial draft from 2026-05-29 review. |
| 0.2 | 2026-05-29 | Claude (Opus 4.8) | Verified against code: `TEMPLATE_PRESETS` at `onboarding/route.ts:41-66,236-238` writing `tenant_branding` while `defaults.json` is read 20 lines later (`:285`); HealingBuds literals enumerated with exact lines in `navigation.tsx`/`footer.tsx`/`home/*`; corrected registry facts — `template-registry.ts` is legacy/empty with no generator, `section-registry.ts` has **49** sections (not 21); added `NavHealingBuds`/`components/homepage/*` allow-list nuance. |
