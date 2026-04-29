# PRD: Super-Admin Chrome Redesign

## 1. Introduction
The BudStacks marketing site is dark-themed (`.budstacks-theme`, `bs-*` token system, GT Sectra serif, green/gold accents). The Super-Admin dashboard at `/super-admin/*` is light-themed (white surfaces, slate text, sans-serif). When the platform owner signs in from the dark marketing site they land on a UI that looks like a different product.

This PRD defines a single-surface redesign — **Super-Admin only** — to bring the chrome (sidebar, top bar, page headers) into brand alignment while keeping dense data surfaces (tables, charts, forms) on light content panels. The "dark sidebar / light content" pattern matches Linear, Notion, Vercel, Stripe — best of both: brand presence + data readability.

**Explicit scope guardrail:** Tenant-Admin (`/tenant-admin/*`) is OUT of scope. The platform owner (Gerard) will use Super-Admin first, evaluate, and decide whether the pattern rolls to Tenant-Admin in a follow-up PRD.

## 2. Goals
- **Brand cohesion:** Auth → Super-Admin should feel like one continuous product.
- **Data readability preserved:** No regression on tables, audit logs, analytics, forms.
- **Token reuse:** Use the existing `bs-*` palette and `.budstacks-theme` system, no new tokens.
- **Single owner decision point:** Built behind a feature flag or simple env toggle so Gerard can A/B before locking in.
- **Reversible:** If the redesign doesn't work, one revert restores the current chrome.

## 3. Non-Goals
- Tenant-Admin redesign (separate PRD after this lands).
- Light/dark user-level toggle.
- New components or new design tokens.
- Refactoring data tables or forms beyond contrast/border touch-ups for the new chrome.
- Mobile-first redesign of the admin (current responsive behaviour preserved).

## 4. Design Pattern: Dark Chrome / Light Content

```
┌─────────────────────────────────────────────────────────────┐
│ [Dark sidebar]  │  [Light content area]                     │
│ bs-bg-0         │  Near-white surface                        │
│ Logo            │  ┌─ Page header (dark band, optional) ─┐  │
│ Nav items       │  │  Title + breadcrumb on dark         │  │
│ (icon + label)  │  └──────────────────────────────────────┘  │
│ Active: green   │                                            │
│ accent strip    │  ┌─ Content panels (white card-floating) ┐ │
│                 │  │  Tables, forms, charts              │ │
│ Bottom: profile │  │  Light tokens preserved             │ │
│                 │  └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Surfaces

| Surface | Theme | Tokens |
|---|---|---|
| Sidebar | Dark | `bs-bg-0` background, `bs-fg-1`/`bs-fg-2` text, `bs-green-400` active accent |
| Top bar | Dark band | `bs-bg-1`, `bs-border` divider |
| Page headers (h1, breadcrumbs) | Dark band, optional per-page | `bs-bg-1` background, `bs-gold-300` serif title |
| Content area background | Light neutral | `#F7F8F7` (new surface var or existing `--background`) |
| Cards / tables / forms | Light | Existing `card-floating`, white surfaces, slate text |
| Buttons (primary CTAs) | Green | `bs-green-500` background, dark text — same as marketing |
| Status pills (badges) | Light variants | Existing system, no change |
| Charts (recharts) | Light backgrounds | Theme-aware accent colors mapped to `bs-green-400` / `bs-gold-300` |

## 5. User Stories

### US-001: Sign in as super-admin from marketing site
**Description:** As Gerard signing in from a dark marketing page, I want the resulting dashboard to feel like the same product.

**Acceptance Criteria:**
- [ ] After Clerk sign-in, the dashboard sidebar matches `bs-bg-0` and renders the Budstacks horizontal logo with green drop-shadow (matching footer).
- [ ] No white-on-white sidebar/top-bar transition between auth and `/super-admin`.

### US-002: Read a 200-row tenants table without eye strain
**Description:** As Gerard reviewing all tenants, I need rows of small text to be readable for a long session.

**Acceptance Criteria:**
- [ ] Tenants table content area remains light (white card on near-white page background).
- [ ] Row hover, zebra striping, and sort affordances unchanged from current.
- [ ] No contrast regression flagged by axe DevTools.

### US-003: Active nav item is unambiguous
**Description:** As any super-admin user, I should always know which section I'm in.

**Acceptance Criteria:**
- [ ] Active sidebar item has green left-border accent strip + lighter background tint.
- [ ] Inactive items are `bs-fg-2`; hover lifts to `bs-fg-1`.
- [ ] Keyboard focus ring uses `bs-green-400` glow.

### US-004: Toggle redesign on/off (decision aid)
**Description:** As Gerard, I want to flip between current chrome and new chrome to compare before committing.

**Acceptance Criteria:**
- [ ] Single env var `NEXT_PUBLIC_ADMIN_CHROME=v2` (or v1) controls which chrome ships.
- [ ] Default in production stays `v1` until manually flipped.
- [ ] Local dev defaults to `v2` for evaluation.

## 6. Functional Requirements

### 6.1 Files to touch (estimate)

| File | Change |
|---|---|
| `app/super-admin/layout.tsx` | Wrap in `.budstacks-theme` for chrome scope; conditional v1/v2 sidebar import |
| `components/admin/SuperAdminSidebar.tsx` | New v2 styling — dark background, green accent strip on active |
| `components/admin/AdminSidebar.tsx` | Tokenize colors — read from theme vars instead of hard-coded slate |
| `components/admin/HeaderProfile.tsx` | Dark variant for top-bar profile menu |
| `components/admin/AccessibleAdminLayout.tsx` | Allow sidebar/content theme split (sidebar dark, main light) |
| `components/admin/NotificationCenter.tsx` | Dark variant for the bell + dropdown trigger |
| `app/super-admin/page.tsx` | Page header band styling (optional dark band over light content) |
| `app/super-admin/tenants/page.tsx` | Same — page header band; table itself unchanged |
| `app/super-admin/analytics/page.tsx` | Page header band; charts get theme-aware colors |
| `app/super-admin/onboarding/page.tsx` | Page header band; existing form/table unchanged |
| `app/super-admin/learning/page.tsx` | Page header band |
| `app/super-admin/emails/page.tsx` | Page header band |
| `app/super-admin/templates/page.tsx` | Page header band |
| `app/super-admin/platform-settings/page.tsx` | Page header band |
| `app/super-admin/settings/page.tsx` | Page header band |
| `app/super-admin/profile/page.tsx` | Page header band |
| `app/super-admin/audit-logs/page.tsx` | Page header band; log table light, unchanged |
| `app/globals.css` | Add `.admin-chrome-v2` scope or extend `.budstacks-theme` rules for admin context |

### 6.2 Token additions (if needed)
- `--admin-content-bg: #F7F8F7;` — near-white content surface (slightly off-white to separate from cards)
- `--admin-page-header-bg: var(--bs-bg-1);` — dark band for page titles

### 6.3 Feature flag

```ts
// lib/admin-chrome.ts
export const ADMIN_CHROME_VERSION =
  (process.env.NEXT_PUBLIC_ADMIN_CHROME as "v1" | "v2") ?? "v1";
```

`super-admin/layout.tsx` reads this and chooses sidebar component + wrapper class.

### 6.4 Charts

Recharts color props currently use slate/blue defaults. Map to:
- Primary series → `#52D97A` (bs-green-500)
- Secondary series → `#D9BC82` (bs-gold-300)
- Tertiary → `#7AC79A` (bs-green-400)
- Grid lines → `#E2E5E0` on light background
- Tooltip → light card with `bs-border-hi` border

## 7. Non-Functional Requirements
- **Accessibility:** WCAG 2.1 AA contrast on all sidebar/top-bar text. Keyboard nav unchanged.
- **Performance:** No new dependencies. Bundle delta < 2 KB gzipped.
- **Backward compatible:** v1 chrome still ships and works while v2 is being evaluated.
- **No data-layer changes.** Pure UI.

## 8. Phased Delivery

### Phase A — Sidebar + top bar (1 day)
- [ ] Add v2 dark variant of `SuperAdminSidebar`
- [ ] Add v2 dark variant of `HeaderProfile` + `NotificationCenter` triggers
- [ ] Feature flag wiring in `super-admin/layout.tsx`
- [ ] Local-dev default `v2`; production default `v1`

### Phase B — Page header bands (half day)
- [ ] Optional dark band component `<AdminPageHeader title breadcrumb actions />`
- [ ] Roll out to overview, tenants, analytics first

### Phase C — Charts theme alignment (half day)
- [ ] Theme-aware color tokens for recharts
- [ ] Audit `PlatformAnalytics`, `StoreAnalytics`

### Phase D — Decision point
- [ ] Gerard reviews v2 in dev for 2–3 sessions
- [ ] Decision: ship v2 to prod, iterate, or revert
- [ ] If shipping → flip prod env var
- [ ] If iterating → list specific changes, do as Phase E
- [ ] If reverting → delete v2 components, remove flag

### Phase E — Tenant-Admin rollout (separate PRD, only after Phase D ships)
- [ ] Out of scope for this PRD. Linked future PRD: `prd-tenant-admin-chrome-redesign.md`.

## 9. Decision Criteria (for Phase D)

Ship v2 if:
- Visual cohesion clearly improved (subjective — Gerard's call)
- No reported regressions on tables, charts, forms after 3 sessions
- Active-state navigation feels obvious without a second look
- No accessibility regressions

Iterate if:
- Specific items off (e.g., wrong shade, wrong active accent, wrong header band height)
- Charts unreadable

Revert if:
- Pattern doesn't work for the dense data we have
- Tables / audit logs lose contrast at scale

## 10. Open Questions
- Do we want the green active-accent strip on the left or as a left-border on the row? (Mockup will decide.)
- Page header band — always-on, or only on certain pages? (Suggest always-on for consistency.)
- Profile avatar in sidebar bottom vs top-right corner? (Current: top-right via `HeaderProfile`. Keep.)
- Should the Budstacks logo in sidebar match the marketing footer treatment (green drop-shadow)? (Suggest yes.)

## 11. References
- Current marketing dark theme: `app/globals.css` `.budstacks-theme` block
- Sidebar pattern reference: Linear, Notion, Vercel admin
- Existing PRD relationship: builds on the homepage/auth dark theme work shipped in `homepage/budstacks-redesign-v2`
- Out-of-scope linked PRD: `prd-tenant-admin-chrome-redesign.md` (to be drafted after Phase D ships)
