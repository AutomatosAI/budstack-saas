# PRD — Admin Design System Roll-out

**Author:** Gerard Kavanagh
**Date:** 2026-04-30
**Status:** Draft, awaiting approval
**Source of truth:** `/Users/gkavanagh/Development/HealingBuds/Budstacks-Design-Guide/` (read `Budstacks Admin Design System.html` first; tokens in `theme.css` + `tailwind.config.snippet.ts` + `globals.layer.css`; per-page list in `MIGRATION_CHECKLIST.md`)

---

## 1. Problem statement

The Budstacks marketing site and tenant pages have a strong, distinctive identity (dark surfaces, serif display, mono detail type, emerald + cream-gold). When the new theme rolled out across admin pages it drifted: cream backgrounds appeared on Analytics, three button styles compete for "primary", four chip systems live side by side, stat cards switch between serif and sans, and Customer Management is missing its page header entirely. The codebase compensates with a heavy `.budstacks-theme` `!important` override block that re-paints `bg-white`/`bg-slate-50` etc. — fragile and inconsistent.

Two **platform-staff** admin surfaces exist (Super Admin + Tenant Admin) and they must be visually indistinguishable except for content + a single accent colour on the sidebar nav indicator.

> **Customer-facing self-service** (`/store/[slug]/dashboard`, `…/orders`, `…/settings`, `…/consultation`, `…/register`) is **out of scope**. Those pages live inside a tenant's storefront and inherit the tenant's theme via `TenantThemeProvider` — putting a black/emerald Budstacks-branded shell around them would break the operator's brand and confuse the end customer (who has no awareness of "Budstacks"). The design system is for platform-staff backends only.

## 2. Goal

Bring **every** backend admin page in **both** platform-staff tiers (Super + Tenant) onto one design system, end-to-end, with no per-tier palette / type / card / button drift. Retire the `.budstacks-theme` override block. Replace ad-hoc Tailwind colour classes (`bg-white`, `text-slate-*`, etc.) with native `bs-*` tokens.

## 3. Non-goals

- Storefront / marketing pages (already canonical — do not regress).
- **Customer self-service pages** under `app/store/[slug]/...` (dashboard, orders, settings, consultation, register) — these inherit the tenant's storefront theme and stay there.
- Onboarding flow (`/onboarding/*`) — separate scope.
- Public legal pages (privacy, terms, AUP, DPA, etc.).
- Email-template **rendered** content (the editor chrome is in scope; the rendered email body itself is not).
- Functional / behavioural changes — this is a visual conformance pass only. No business-logic edits.

## 4. Scope — pages by tier

> **Read in order:** §4.1 Super Admin pages → §4.2 Tenant Admin pages → §4.3 Personal Client Admin (out of scope) → §4.4 Co-located client components → §4.5 Shared admin components → §4.6 Intentional literals (DO NOT TOUCH) → §4.7 `components/ui/*` (DO NOT MODIFY) → §4.8 Migration safety rules.

### 4.1 Super Admin (16 pages, `app/super-admin/`)
Sidebar accent: `bs-gold` rail. Co-located client component files (`*-form.tsx`, `*-actions.tsx`, `*-table.tsx`, `*-dialog.tsx`, `client.tsx`) are migrated **alongside** their parent page.tsx — see §4.4.

| # | Route | Template | Notes |
|---|---|---|---|
| 1 | `/super-admin` | B (centered + stats) | Platform overview, 4-up stat row + chart cards |
| 2 | `/super-admin/tenants` | C (compact left) | Tenants list (+`tenants-table.tsx`); "Impersonate" = `bs-btn-ghost bs-btn-sm` |
| 3 | `/super-admin/tenants/[id]` | A (centered serif) | Detail/edit (+`tenant-edit-form.tsx`), `bs-card` sections |
| 4 | `/super-admin/emails` | C | Template list |
| 5 | `/super-admin/emails/new` | A | Create template form |
| 6 | `/super-admin/emails/[id]` | A | Edit template form (+`client.tsx`) |
| 7 | `/super-admin/templates` | C | Library list (+`upload-dialog.tsx`, `edit-template-dialog.tsx`) |
| 8 | `/super-admin/templates/[id]/edit` | A | Edit template (icon tile = `gold`) |
| 9 | `/super-admin/templates/submissions/[id]` | A | Review submissions |
| 10 | `/super-admin/settings` | A | Platform settings family (+`settings-form.tsx`) |
| 11 | `/super-admin/audit-logs` | C | **Replace solid red/green action pills with `.bs-chip` system** |
| 12 | `/super-admin/learning` | A | Help center (+`learning-manager.tsx`) |
| 13 | `/super-admin/platform-settings` | A | Platform-wide settings (+`platform-branding-form.tsx` — colour-picker hex literals are **intentional**, see §4.6) |
| 14 | `/super-admin/profile` | A | Profile/preferences |
| 15 | `/super-admin/analytics` | B | **Drop cream background**; stat cards → `.bs-stat`; time-range pills → `.bs-btn-sm`. Chart series hex literals **intentional** (§4.6) |
| 16 | `/super-admin/onboarding` | C | Pending tenant approval queue (+`onboarding-actions.tsx`) — table of inactive tenants with approve/reject |

### 4.2 Tenant Admin (20 pages, `app/tenant-admin/`)
Sidebar accent: `bs-green` rail. Tenant logo + name appears at top of sidebar (small, muted — not a hero). Co-located client components migrate alongside parent page — see §4.4.

| # | Route | Template | Notes |
|---|---|---|---|
| 1 | `/tenant-admin` | B | Overview — header + 4-up stat row + chart cards |
| 2 | `/tenant-admin/customers` | C | **Add missing eyebrow + Cormorant page title**; stats → `.bs-stat`; deleted-user rows use `bs-avatar.gold` (+`customers-table.tsx`) |
| 3 | `/tenant-admin/customers/[id]` | A | Customer detail (+`customer-edit-form.tsx`) |
| 4 | `/tenant-admin/products` | C | Product Catalog — keep `⋮⋮` drag handle; strain badge → `bs-chip-gold`; stock → `bs-chip-green` / `warn` (low) / `danger` (out) (+`products-table.tsx`) |
| 5 | `/tenant-admin/orders` | B + table | Centered header + stat row + table; status pills: Pending / Pending Sync = `bs-chip-warn`, Processing = `bs-chip-info`, Completed = `bs-chip-green`, Failed = `bs-chip-danger` (+`orders-table.tsx`) |
| 6 | `/tenant-admin/emails` | C | Tenant template list |
| 7 | `/tenant-admin/emails/new` | A | Create form |
| 8 | `/tenant-admin/emails/[id]` | A | Edit form |
| 9 | `/tenant-admin/the-wire` | C | List half |
| 10 | `/tenant-admin/the-wire/new` | A | Create form (+`post-form.tsx`) |
| 11 | `/tenant-admin/the-wire/[id]` | A | Edit form |
| 12 | `/tenant-admin/settings` | A | Settings family (+`settings-form.tsx`) |
| 13 | `/tenant-admin/branding` | A | Branding/customization (+`branding-form.tsx`, `tabs/*.tsx` — colour/font preview hex+font literals are **intentional**, see §4.6) |
| 14 | `/tenant-admin/profile` | A | Profile |
| 15 | `/tenant-admin/audit-logs` | C | Action pills → `.bs-chip` system |
| 16 | `/tenant-admin/analytics` | B | **Drop cream background**; stat cards → `.bs-stat`; time-range pills → `.bs-btn-sm`. Chart series hex literals **intentional** (§4.6) |
| 17 | `/tenant-admin/templates` | C | Store template settings (+`upload-dialog.tsx`, `preview-upload-dialog.tsx`, `share-marketplace-dialog.tsx`, `activate-button.tsx`) |
| 18 | `/tenant-admin/seo` | A | SEO Manager (+`seo-page-client.tsx`) |
| 19 | `/tenant-admin/webhooks` | A + C | Settings half = A, list half = C |
| 20 | `/tenant-admin/cookie-settings` | A | Cookie Settings (+`settings-form.tsx`) |

### 4.3 ~~Personal Client Admin~~ — **out of scope**

Customer-facing self-service pages (`/store/[slug]/dashboard`, `…/orders/[orderId]`, `…/settings`, `…/consultation`, `…/register`) **inherit the tenant's storefront theme** via `TenantThemeProvider` and stay there. Wrapping them in a Budstacks-branded admin shell would override the operator's brand on their own domain. Out of scope for this PRD; if customer-self-service ever needs its own design uplift, it should adopt or extend the *tenant's* theme tokens, not the platform admin's.

### 4.4 Co-located client components (migrate **with** their parent page)

Each admin page often has sibling client component files. They are part of the page's blast radius and must be migrated in the same pass — otherwise the table styles diverge from the page chrome. Listed for explicit accountability:

**Super Admin** (`app/super-admin/**`):
- `tenants/tenants-table.tsx`
- `tenants/[id]/tenant-edit-form.tsx`
- `emails/[id]/client.tsx`
- `templates/upload-dialog.tsx`, `templates/edit-template-dialog.tsx`
- `settings/settings-form.tsx`
- `learning/learning-manager.tsx`
- `platform-settings/platform-branding-form.tsx` ⚠ see §4.6
- `onboarding/onboarding-actions.tsx`

**Tenant Admin** (`app/tenant-admin/**`):
- `customers/customers-table.tsx`
- `customers/[id]/customer-edit-form.tsx`
- `products/products-table.tsx`
- `orders/orders-table.tsx`
- `the-wire/post-form.tsx`
- `settings/settings-form.tsx`, `cookie-settings/settings-form.tsx`
- `branding/branding-form.tsx` + `branding/tabs/*.tsx` (12 files) ⚠ see §4.6
- `seo/seo-page-client.tsx`
- `templates/upload-dialog.tsx`, `templates/preview-upload-dialog.tsx`, `templates/share-marketplace-dialog.tsx`, `templates/activate-button.tsx`

**Rule:** When migrating a page row in §4.1 / §4.2, the listed sibling files migrate at the same time. PR diff for that page must include the sibling diffs.

### 4.5 Shared admin components (single source of truth — migrate once, propagates everywhere)

Located in `components/admin/shared/` and `components/admin/`. Used **exclusively** by admin pages — safe to migrate aggressively. Migrated in **Phase 1.5**, *before* per-page work, so every page in Phase 2 already pulls correct styles.

| File | Used by |
|---|---|
| `shared/StatCard.tsx` | All B-template dashboards (overview, analytics, orders, customers) |
| `shared/RowPill.tsx` | All C-template list pages (status / role / category pills) |
| `shared/Pagination.tsx` | All paginated tables |
| `shared/SortableTableHeader.tsx` | All sortable tables |
| `shared/StatusFilter.tsx` | Order, customer, audit-log filter chips |
| `shared/ExportButton.tsx` | Audit logs, analytics, orders, customers |
| `shared/Breadcrumbs.tsx` | Detail pages |
| `shared/EmptyState.tsx` | All empty list views |
| `shared/BulkActionBar.tsx` | Customers, orders, products bulk operations |
| `shared/SearchInput.tsx` | All searchable lists |
| `AdminSidebar.tsx` (existing), `SuperAdminSidebar.tsx`, `TenantAdminSidebar.tsx` | Layouts (Phase 1) |
| `HeaderProfile.tsx`, `NotificationCenter.tsx`, `KeyboardShortcutsProvider.tsx`, `AccessibleAdminLayout.tsx`, `SkipToContent.tsx` | Layouts (Phase 1) |
| `panels/OverviewPanel.tsx`, `ActivityTimeline.tsx`, `QuickActionsWidget.tsx` | Dashboards |
| `analytics/StoreAnalytics.tsx`, `analytics/PlatformAnalytics.tsx` | Analytics pages — chart hex literals **intentional** (§4.6) |
| `email/EmailEditor.tsx`, `email/EmailTemplateList.tsx`, `email/TenantTemplateList.tsx`, `email/EmailEventMapper.tsx`, `email/TenantEventMapper.tsx` | Emails pages |
| `seo/GooglePreview.tsx`, `seo/SeoEditorModal.tsx` | SEO page |
| `StoreEditorHelperBot.tsx`, `AutomatosWidgetWrapper.tsx` | Tenant admin (in-app helper widget) |
| ~~`PackingSlip.tsx`~~ | DELETE — see cleanup note below |

### 4.6 Intentional literals — **DO NOT TOUCH**

These hex / font / colour values are part of product features (customer-controlled colour pickers, chart series, font previews). Replacing them with tokens **breaks the feature**.

- `app/tenant-admin/branding/branding-form.tsx` + `branding/tabs/*.tsx` — colour pickers, font previews, section colour panel. Every hex/font here is **user data display**, not admin UI chrome.
- `app/super-admin/platform-settings/platform-branding-form.tsx` — same pattern at platform level.
- `app/tenant-admin/analytics/page.tsx` + `app/super-admin/analytics/page.tsx` — `<svg>` chart series colours are intentional. Series ≠ chip ≠ stat number; they need distinct hues.
- `components/admin/analytics/StoreAnalytics.tsx`, `components/admin/analytics/PlatformAnalytics.tsx` — same.

Surrounding chrome (page header, card frame, toolbar, eyebrow, buttons, table) **does** migrate. Only the *value-rendering* areas (the tile that shows a customer's chosen colour, the swatch on a chart series, the font preview <span>) keep their literals.

### 4.7 DO NOT MODIFY — `components/ui/*` shadcn primitives

`components/ui/` houses 35 shadcn primitives (`Button`, `Dialog`, `Sheet`, `Toast`, `Input`, `Select`, `Tabs`, `Badge`, `Card`, `DropdownMenu`, `Form`, `Pagination`, etc.). Cross-cutting usage:

- **Admin pages**: ~70 files import from `@/components/ui/*`
- **Storefront / customer self-service / sections / onboarding**: ~36 files also import from `@/components/ui/*`

Changing a primitive's default Tailwind classes will repaint customer-facing pages. **Forbidden in this PRD.**

**Allowed strategies for admin styling:**
1. **Preferred** — admin pages wrap a `bs-*` class around / instead of the primitive (e.g. native `<button class="bs-btn-green">` instead of `<Button>`).
2. **Acceptable** — primitive is kept but parent page applies `bs-*` token classes via `className=""` prop. shadcn primitives accept `className` and merge with `cn()`.
3. **Acceptable** — scoped CSS overrides under `[data-surface="admin"]` selector in `globals.css`. Storefront never has that attribute, so storefront stays unaffected.
4. **Forbidden** — editing `components/ui/*.tsx` directly.

Total in scope: **36 pages** (Tenant 20 + Super 16) + 2 layouts + ~31 admin-only shared components + scoped CSS overrides under `[data-surface="admin"]`.

> **Cleanup ask, separate from this PRD:** delete `app/tenant-admin/orders/[id]/packing-slip/page.tsx` and `components/admin/PackingSlip.tsx`. Reason: Budstacks doesn't own shipping or fulfillment — Dr Green handles all that. The page is dead code from an earlier model. Should also audit `/tenant-admin/orders` for any "Print packing slip" link/button that needs removing alongside.

### 4.8 Migration safety rules (read **before** touching any file)

These rules are absolute. Each one cost us a regression in past rollouts.

1. **Read the page before editing it.** Identify which sibling client components exist (§4.4). Migrate them in the same PR as the page — never split.
2. **Never edit `components/ui/*`.** Use `className=` on the primitive, or a `bs-*` native element instead. (§4.7)
3. **Never edit a file under `app/store/[slug]/` or `components/sections/`** as part of this PRD. Storefront is out of scope.
4. **Don't replace a hex literal you don't understand.** If it's in `branding-form.tsx`, `platform-branding-form.tsx`, `branding/tabs/*.tsx`, `analytics/*.tsx`, or any chart `<svg>` series — leave it. (§4.6)
5. **Don't delete a co-located file** even if it looks redundant. Verify its imports first via `grep -rn "from.*<filename>"`.
6. **Don't remove props or change function signatures** on shared components. Phase 1.5 is visual-only — every consumer must compile unchanged.
7. **Smoke-test every page after migration.** Click-through: does it load? Do server actions still post? Does the table render rows? Do filters work? Visual conformance is necessary but not sufficient — functional correctness is mandatory.
8. **If a page imports `@/components/admin/PackingSlip`** — that import is dead. Remove it (separate cleanup), don't migrate it.
9. **One commit per page.** Page + sibling components + tests in a single commit. Never bundle multiple pages — bisect-friendliness > velocity.
10. **Run `npm run typecheck` after every page.** A renamed token or removed class is a TypeScript error in 30 seconds, not a Railway build failure 5 minutes later.
11. **Don't introduce new files** under `app/super-admin/*` or `app/tenant-admin/*` as part of this PRD. Edit existing files in place.
12. **Don't refactor business logic** while migrating. If a component fetches data, formats dates, or runs server actions — leave that code untouched. Touch only JSX + className.

## 5. Hard rules (lifted verbatim from the spec — non-negotiable)

1. Background is always `bg-bs-bg` (`#07090A`). The cream/parchment Analytics background is retired. `bg-bs-bg-smoke` is reserved for hero / modal scrims.
2. One primary action per view. `bs-btn-green` is *the* primary. Teal-cyan gradient "Export" → `bs-btn-ghost`.
3. One chip system. Every status / category / tag uses `.bs-chip` + role (`green` / `warn` / `info` / `danger` / `gold` / `muted`). Same shape, only the role colour changes.
4. Cormorant Garamond for all titles + big metric numbers. Inter is for body, buttons, labels, table cells.
5. JetBrains Mono is mandatory for: eyebrows, chip labels, IDs, IP addresses, timestamps, JSON snippets, exact numbers in table cells, currency *value* in stat cards is Cormorant; the eyebrow label is Mono.
6. Big metric numbers are `bs-gold-cream` (`#fcfcbc`), Cormorant 36px.
7. Card hover = soft green ring (`shadow-bs-card-hover`), never a colour shift.
8. Tables wrap in `.bs-card` `overflow-hidden`. Toolbar (Cormorant title + count + search + filters + export) sits inside, before the `<table>`. Numeric / ID / IP / timestamp cells use `.mono`.
9. No new hex literals. Every existing hex outside the token list is a bug.
10. No emoji in admin UI. Eyebrows can use `◆`.

## 6. Tier deltas (the *only* allowed differences)

| Aspect | Super Admin | Tenant Admin |
|---|---|---|
| Sidebar accent dot/rail | `bs-gold` | `bs-green` |
| Eyebrow tag colour | gold | gold |
| Top-level nav | + Tenants, Operators, Platform Settings, System Health | Tenant logo + name in sidebar header |
| Page headers | A or C | A or C |
| Primary CTA | `bs-btn-green` | `bs-btn-green` |
| Surfaces, cards, type, chips | Identical | Identical |

## 7. Phases

### Phase 0 · Foundation (do once, gate before any page work)

**0.1 Tailwind tokens**
- Merge `tailwind.config.snippet.ts` `theme.extend` into `nextjs_space/tailwind.config.ts`. Add the **flat** `bs-*` keys (`bs-bg`, `bs-card`, `bs-green`, `bs-green-deep`, `bs-gold`, `bs-gold-cream`, etc.) alongside the existing nested `bs.*` keys — do NOT delete existing keys, both forms coexist during migration.
- Add `fontSize` keys (`display-xl`, `display-lg`, `display-md`, `display-num`, `mono-eyebrow`, `mono-chip`, `mono-cell`).
- Add `borderRadius`: `bs-sm`, `bs-md`, `bs-lg`, `bs-pill`.
- Add `boxShadow`: `bs-card`, `bs-card-hover`, `bs-glow`, `bs-glow-hover` (existing `bs-card` and `bs-green` keys conflict — rename existing on a one-pass migration before removal).
- Add `backgroundImage`: `bs-green-tint`, `bs-gold-tint`.

**0.2 Global CSS layer**
- Add the `<link>` for Cormorant Garamond + Inter + JetBrains Mono in `app/layout.tsx` head (replace DM Serif Display).
- Update root `--bs-font-display` to Cormorant Garamond (currently DM Serif Display in globals).
- Paste the contents of `globals.layer.css` into `app/globals.css` **un-scoped** — no `.budstacks-theme` wrapper. The existing `.budstacks-theme`-scoped `.bs-*` declarations (lines 1145–1320) become superseded; remove them in 0.4.
- Verify `body { @apply bg-bs-bg text-bs-fg-body font-sans antialiased; }` at the root, but only when an admin layout is mounted — **gate via `<body>` data attribute** to avoid breaking storefront. Storefront tenant theming (CSS vars from `TenantThemeProvider`) must remain untouched.

**0.3 Admin layout gate**
- Add `<body data-surface="admin">` (or wrapper class `admin-shell-dark`) on **all three** admin layouts: `app/super-admin/layout.tsx`, `app/tenant-admin/layout.tsx`, **new** `app/store/[slug]/(client-admin)/layout.tsx` (created Phase 1.5).
- Move dark theme rules under `[data-surface="admin"]` selector to keep storefront unaffected.

**0.4 Retire the `.budstacks-theme` override block**
- Delete the `!important` Tailwind override block (`globals.css` ~1336+, `bg-white → #151A1C`, etc.).
- This block is doing the wrong job: it re-paints raw Tailwind classes used in admin pages. Real fix is to replace those raw classes in the source files (Phase 2). Keep the block in place during Phase 1; remove before starting Phase 2.

**0.5 Audit retirements**
- Mark `.admin-bg` (`globals.css` line 248) and `.saas-shell` deprecated. Their cream `#fafaf9` background is incompatible with the spec.
- Mark `focus-super-admin` (slate) and `focus-tenant-admin` (cyan) deprecated. Replace with role-correct rings: super = gold ring, tenant = green ring, client = info-blue ring.

**Exit criteria**: visit any admin page (super or tenant) — body background is `#07090A`, body text is `#C6CCC8`, headings are Cormorant. Storefront is unaffected. No console errors.

### Phase 1 · App chrome (sidebar + top bar)

**1.1 Sidebar — two variants, one source**
- Refactor `SuperAdminSidebar` and `TenantAdminSidebar` to share a single `<AdminSidebar accent="gold|green" />` underneath. The accent prop drives the active-item rail colour and dot.
- Sidebar fill: `bg-bs-bg-smoke`. Border-right: `border-bs-border-100`.
- Active nav item: 3px left rail in tier accent, label `text-bs-fg`, background `bg-bs-card`. Inactive: `text-bs-fg-muted` with `hover:text-bs-fg hover:bg-bs-card`.

**1.2 Top bar**
- `bg-bs-bg` with hairline `border-b border-bs-border-100`. Height 56px.
- Notification + avatar = ghost circular treatment (`bg-bs-card border border-bs-border` 36px circle).

**1.3 Page-content frame**
- Max-width 1180px. Side padding 32–64px responsive. Top padding 56px.

**1.4 Focus rings**
- Replace `focus-super-admin` slate ring with gold ring (`ring-bs-gold/40`).
- Replace `focus-tenant-admin` cyan ring with green ring (`ring-bs-green/40`).

**Exit criteria**: visual sweep across the two layouts side-by-side — chrome is identical except sidebar accent + top-bar identity area.

### Phase 1.5 · Shared admin components (single source of truth)

Migrate `components/admin/shared/*` and the dashboard widgets **before** Phase 2 so each per-page diff in Phase 2 only touches the page itself. These are admin-only files (zero storefront usage) — safe to migrate aggressively.

**1.5.1 `shared/StatCard.tsx`** — replace card div with `.bs-stat`. Eyebrow = JetBrains Mono uppercase. Value = `.bs-stat-value` (Cormorant 36px `bs-gold-cream`). Delta = `.up`/`.down`. Remove any `bg-white` / `bg-slate-*` / cream backgrounds. Preserve props API; visual change only.

**1.5.2 `shared/RowPill.tsx`** — every variant maps to `.bs-chip` + role:
- `success` / `active` / `completed` → `bs-chip-green`
- `pending` / `pending-sync` / `warn` → `bs-chip-warn`
- `processing` / `info` → `bs-chip-info`
- `failed` / `error` / `destructive` → `bs-chip-danger`
- `neutral` / `default` → `bs-chip-muted`
- `brand` / `strain` / `category` → `bs-chip-gold`

**1.5.3 `shared/Pagination.tsx`** — buttons → `bs-btn-ghost bs-btn-sm`; active page → `bs-btn-green bs-btn-sm`. Numeric labels in `font-mono`.

**1.5.4 `shared/SortableTableHeader.tsx`** — header row uses `.bs-table thead` styles. Sort indicator = single chevron icon, no colour fill.

**1.5.5 `shared/StatusFilter.tsx`** — chip-row uses `.bs-chip` shape, active = `bs-chip-green`, inactive = `bs-chip-muted`.

**1.5.6 `shared/ExportButton.tsx`** — `bs-btn-ghost bs-btn-sm` with download icon. Remove any teal/cyan gradient.

**1.5.7 `shared/Breadcrumbs.tsx`** — text colour `text-bs-fg-muted`, hover `text-bs-fg`. Separator chevron `text-bs-border`.

**1.5.8 `shared/EmptyState.tsx`** — centered `.bs-card.bs-card-pad`. Icon tile `bs-icon-tile` + Cormorant 22px title + muted subtitle + optional `bs-btn-green` action.

**1.5.9 `shared/BulkActionBar.tsx`** — sticky bottom bar `bg-bs-card border-t border-bs-border-100`. Selected count in mono. Actions = `bs-btn-ghost bs-btn-sm`; destructive = `bs-btn-danger`.

**1.5.10 `shared/SearchInput.tsx`** — `.bs-input` with leading magnifier icon (`text-bs-fg-muted`). Focus ring uses tier-correct ring (passed via prop or scoped to layout).

**1.5.11 `panels/OverviewPanel.tsx`, `ActivityTimeline.tsx`, `QuickActionsWidget.tsx`** — wrap in `.bs-card`; titles in Cormorant 22px; metadata mono.

**1.5.12 `analytics/StoreAnalytics.tsx`, `analytics/PlatformAnalytics.tsx`** — chrome migrates (page header, card frame, eyebrows, time-range pills → `bs-btn-sm`). Chart series hex values **stay** (§4.6).

**1.5.13 `email/*` (5 files), `seo/*` (2 files)** — chrome migrates: card frames, headers, buttons, inputs. Editor canvas content (template HTML, SEO preview) is product output, not admin chrome — preserve.

**1.5.14 Helper widgets — `StoreEditorHelperBot.tsx`, `AutomatosWidgetWrapper.tsx`** — float button → `bs-btn-green` floating action; popup card → `.bs-card`.

**Exit criteria**: visiting any unmodified page that consumes these components shows correctly themed widgets (stat tiles dark, pills correct shape, pagination dark) even before that page itself is migrated. Verifies the inheritance.

### Phase 2 · Page-by-page migration

Work through each tier in this order to maximise reuse: **Settings family (A) → Dashboards (B) → Data tables (C) → Forms**. Per-page checklist:

**Pre-flight (do before touching any line):**
- Read the full page.tsx + every sibling listed in §4.4.
- `grep -rn "from.*<this-page-folder>"` to find any cross-page imports — if your page is imported by another, the other is now in your blast radius.
- Confirm none of the hex literals in this page are listed in §4.6 (intentional). If they are, bracket them off and don't touch.
- Verify `npm run typecheck` is clean **before** you edit. You don't want to inherit a pre-existing error.

**Migration steps:**
1. Replace page header with `bs-page-header-centered` (settings/dashboard) or `bs-page-header-compact` (data tables). Eyebrow → `<span class="bs-eyebrow">◆ {Section}</span>`. Title → `bs-page-title`. Subtitle → `bs-page-subtitle`.
2. Wrap each section in `.bs-card.bs-card-pad` with `.bs-card-head` (icon tile + Cormorant 22px title + muted description).
3. Replace stat tiles with `.bs-stat` (mono eyebrow label + cream-gold Cormorant 36px value + `.up`/`.down` delta). If the page uses `<StatCard>` from `components/admin/shared`, no per-page work needed — Phase 1.5 already migrated it.
4. Replace status / tag pills with `.bs-chip` + correct role colour. Audit each existing pill site and map: success → green, pending → warn, processing → info, failed → danger, neutral → muted, brand/strain → gold. If the page uses `<RowPill>`, no per-page work needed.
5. Replace buttons: primary → `bs-btn-green` (one per view). Secondary / Export / Filter → `bs-btn-ghost`. In-row "View →" → `bs-btn-text`. Destructive → `bs-btn-danger`. Delete the teal-cyan gradient. If a button is `<Button>` from `components/ui`, add `className="bs-btn-…"` — don't edit the primitive.
6. Wrap tables: outer `<div class="bs-table-wrap">`, toolbar `.bs-table-toolbar` with Cormorant title + mono count + search + filters + export, then `<table class="bs-table">` with `.strong` / `.num` / `.mono` cell classes.
7. Replace inputs/labels/help with `.bs-input` / `.bs-label` / `.bs-help`. Toggles → `.bs-toggle`. Selects → `.bs-select`. If shadcn `<Input>`/`<Select>`/`<Switch>` are in use, add `className="bs-…"` — don't edit the primitive.
8. Remove any inline `style={{ color: '#…' }}` or hard-coded hex Tailwind utilities (`bg-slate-50`, `text-emerald-500`, etc.). Replace with token classes. **Exception:** §4.6 intentional literals stay.

**Post-flight:**
- `npm run typecheck` clean.
- Visit page in browser (staging). Click every button, submit every form, sort every table. Compare against the matching template in `Budstacks Admin Design System.html` § 05.
- Single commit: `feat(admin): migrate <page-name> to bs-* tokens`. Body lists migrated sibling files.

**Per-tier batches:**

- **Phase 2A — Tenant Admin** (largest surface, highest visibility): all 20 pages. Order: settings → dashboard → orders → customers → products → audit-logs → analytics → the-wire → emails → branding → seo → webhooks → cookie-settings → templates → profile.
- **Phase 2B — Super Admin** (16 pages). Settings → analytics → tenants → templates → emails → audit-logs → learning → platform-settings → profile → onboarding → tenant detail → submissions.

**Per-page exit criteria**: page renders against checklist with zero console errors; visual matches `Budstacks Admin Design System.html` § 05 templates; no `#` hex literal remains in the page source; primary action count ≤ 1 per view.

### Phase 3 · Modals, drawers, toasts

- Modal: `bg-bs-card border border-bs-border rounded-bs-lg shadow-bs-card-hover`, scrim `bg-bs-bg-smoke/80 backdrop-blur-sm`. Title in Cormorant 22px. Close = `bs-btn-text`.
- Drawer: same treatment, slide from right, 480px desktop.
- Toast: `bs-card` with role-coloured left rail. Mono eyebrow + Inter body.
- Confirmation dialogs: `bs-btn-ghost` cancel + `bs-btn-green` confirm (`bs-btn-danger` for destructive). Destructive requires typing the entity name to enable confirm.

Audit: shared `<Dialog>`, `<Sheet>`, `<Toast>` shadcn primitives in `components/ui/*` for one-shot updates that propagate everywhere.

### Phase 4 · Forms

- All inputs → `bs-input`. Labels → `bs-label`. Help → `bs-help`.
- Field errors: red help text + `border-bs-danger/40` + `ring-bs-danger/15`.
- Toggles → `bs-toggle` (44×24 green when on).
- Selects → `bs-select` with count-pill affordance.
- Multi-step forms: thin progress strip at top of card (`bs-step-200` track + `bs-green` filled). No big numbered circles.

### Phase 5 · Audit + cleanup

- `grep -rn "#" --include="*.tsx" --include="*.css" app/super-admin app/tenant-admin` — every hex literal not in the token set must be replaced. **Exclusions** (intentional, see §4.6): `app/tenant-admin/branding/**`, `app/super-admin/platform-settings/platform-branding-form.tsx`, `app/tenant-admin/analytics/page.tsx`, `app/super-admin/analytics/page.tsx`, `components/admin/analytics/*.tsx`.
- `grep -rn "from-cyan\|to-teal\|via-emerald\|from-emerald\|gradient-to-r" --include="*.tsx" app/super-admin app/tenant-admin components/admin` — convert to `bs-btn-green` / `bs-btn-ghost`.
- `grep -rn "bg-white\|bg-slate-\|bg-gray-\|text-slate-" --include="*.tsx" app/super-admin app/tenant-admin components/admin` — must already be zero (override block was deleted at end of Phase 1; if anything remains it would be visibly broken). This grep is the receipt.
- `grep -rn "from ['\"]@/components/ui/" --include="*.tsx" components/ui` — must be zero (no primitive imports another primitive without need; verifies we didn't drift).
- Verify no admin-only token (`bs-*`) appears in `components/sections`, `components/shop`, `components/home`, `components/landing`, `app/store`, `app/onboarding`. Bleed = bug.
- Confirm `font-display` is Cormorant everywhere it's applied — no `Playfair`, `DM Serif Display`, or `font-serif` lingering on titles or metric numbers.
- Confirm `font-mono` is JetBrains Mono on every eyebrow, chip, IP, timestamp, ID, currency-eyebrow.
- Take screenshots of all 36 pages × 3 viewport widths (1440, 1024, 390) and compare to `Budstacks Admin Design System.html` § 05 templates side-by-side. File issues for any visual delta. (Single end-of-rollout review — no per-phase gate.)
- Run `npm run lint` and `npm run typecheck` clean.
- Run Playwright E2E against the five archetypes (settings · dashboard · data table · modal · form) per tier — 10 tests minimum.

## 8. Per-tier acceptance criteria

A tier is "done" when:
1. Every page in its scope passes its per-page checklist.
2. Sidebar accent matches spec (gold for Super, green for Tenant).
3. Visiting two pages back-to-back inside the tier shows zero visual jolt (same surface, same type, same chrome).
4. Visiting the same archetype across both tiers (e.g. each tier's audit-log page) shows only content + sidebar accent differences.
5. No `.budstacks-theme` override block exists in `globals.css`.
6. Lighthouse accessibility score ≥ 95 unchanged from baseline (focus rings updated, contrast verified on dark surfaces).

## 9. Risks + mitigations

| Risk | Mitigation |
|---|---|
| Storefront regresses when global dark theme is introduced | Gate via `[data-surface="admin"]` selector or admin-only layout wrapper. Storefront `TenantThemeProvider` CSS vars must remain authoritative there. |
| Override block deleted at end of Phase 1 — pages will visibly break until each is migrated in Phase 2 | Accepted: nobody but the engineer sees staging during the migration. Broken state acts as a forcing function — every unmigrated raw class shows up immediately, no ambient band-aid. |
| Existing nested `bs.*` Tailwind keys (`bs.green.500`) collide with new flat keys (`bs-green-deep`) | Coexist during migration; one-shot codemod in Phase 5 to standardise on flat keys, then remove nested. |
| `tailwind.config.ts` `boxShadow.bs-card` already exists with different semantics | Rename existing collisions in 0.1 with explicit notes; verify no marketing component depends on them before removing. |
| Cormorant Garamond licensing | Google Fonts free version. Path to paid serif (GT Sectra) later is a single CSS-variable change. |
| Editing `components/ui/*` would repaint storefront, customer self-service, and onboarding pages | Forbidden — see §4.7. Three approved escape hatches: `className` prop on the primitive, native `bs-*` element instead, scoped CSS under `[data-surface="admin"]`. Reviewed in PR. |
| Phase 1.5 changes a shared component prop and breaks a consuming page | Phase 1.5 is **visual-only** — props and signatures stay constant. Verified via `npm run typecheck` after each shared-component edit. |
| Branding form colour pickers / analytics chart hex literals get "fixed" by mistake | §4.6 lists the exact files that keep literals. Phase 5 grep audit excludes those paths. |
| Sibling client component (e.g. `orders-table.tsx`) gets out-of-sync with its parent page | §4.4 binds them together — page migration commit must include sibling diff. PR template enforces. |

## 10. Out-of-band guardrails

- **Don't invent new colours.** If a need arises that isn't covered, raise an issue.
- **Don't introduce per-tier palettes / typography / cards.** That's the trap that started the project.
- **Don't add emoji to admin UI.** `◆` is the only allowed glyph for eyebrows.
- **One primary action per view.** If two buttons feel like primary, one isn't.

## 11. Rollout + branching

- Single feature branch `feat/admin-design-system-rollout`. No per-phase branches, no per-phase approval gates — engineer smashes through the PRD end-to-end.
- Staging deploys continuously (only the engineer sees staging during migration). One end-of-rollout review against staging before production cutover.
- Production deploy = single cutover at end of Phase 5 once acceptance criteria pass.
- Auto-deploys via Railway on push. Builds ~5 min.

## 12. Estimate

- Phase 0 — Foundation: 0.5 day
- Phase 1 — Chrome + delete override block: 1 day
- Phase 1.5 — Shared admin components: 1 day
- Phase 2A — Tenant (20 pages): 4 days
- Phase 2B — Super (16 pages): 3 days
- Phase 3 — Modals/drawers/toasts: 0.5 day
- Phase 4 — Forms: 0.5 day
- Phase 5 — Audit + cleanup: 1 day

**Total ≈ 11.5 working days** for one engineer end-to-end.

## 13. Decisions (all locked)

- ✅ **Fonts** — Cormorant Garamond from Google Fonts (free). `--bs-font-display: 'Cormorant Garamond'`. Path to paid serif later is a single CSS-variable change.
- ✅ **Client Admin** — out of scope. Customer self-service (`/store/[slug]/dashboard`, `…/orders`, `…/settings`, `…/consultation`, `…/register`) inherits tenant storefront theme via `TenantThemeProvider`.
- ✅ **Override block deletion** — Option B: delete the entire `.budstacks-theme` override block at end of Phase 1, before any Phase 2 page work begins. Forces real migration; pages will look broken until individually fixed. Accepted because no stakeholders see staging during rollout.
- ✅ **Packing slip** — page is dead code (no shipping/fulfillment owned; Dr Green handles all). Deleted as separate cleanup; not in scope for design migration.
- ✅ **Approval gate** — none. Single feature branch, single end-of-rollout review against staging, single production cutover.
- ✅ **`components/ui/*` shadcn primitives** — never edited (§4.7). Admin pages use `className=` prop, native `bs-*` markup, or `[data-surface="admin"]` scoped CSS.
- ✅ **Shared admin components** — migrated as `Phase 1.5` (single source of truth, before per-page work) so each page in Phase 2 is a smaller diff. Visual-only changes; props/signatures preserved.
- ✅ **Co-located sibling files** — bind to parent page. Page migration PR includes the sibling diff (§4.4).
- ✅ **Intentional hex/font literals** — branding pickers, analytics chart series, font previews are user data display, not chrome. Listed in §4.6, excluded from Phase 5 grep.

---

**Ready to start Phase 0.**
