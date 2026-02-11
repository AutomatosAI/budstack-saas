# BudStack Template Architecture

**Last Updated:** 2026-02-11  
**Version:** 3.0.0  
**Status:** Production Standard

---

## Overview

BudStack templates are **data-only packages** — 4 files of JSON and CSS, with **no React code**. The SaaS app ships pre-built section components and a runtime renderer that composes them based on the template's `layout.json`.

Templates are stored in S3 and loaded at runtime, meaning:
- ✅ **Hot-deploy** — add/update templates without restarting the SaaS server
- ✅ **Tenant isolation** — each tenant clones their own copy of a template
- ✅ **Branding customization** — tenants change colors, fonts, logos, content via the admin panel
- ✅ **Marketplace-ready** — anyone can build and sell templates

> [!NOTE]
> There is a legacy rendering path for old React-based templates (`healingbuds`, `gta-cannabis`, `wellness-nature`). These are being migrated to the data-only format. New templates MUST use data-only format.

---

## Template File Structure

Every template is exactly 4 files:

```
{slug}-template/
├── layout.json           # Which sections, in what order, nav/footer type
├── defaults.json         # Design system (colors, fonts) + content defaults
├── template.config.json  # Metadata (name, tags, category, marketplace info)
└── styles.css            # CSS variables + custom overrides
```

**No `index.tsx`. No `components/`. No React code.**

---

## 1. layout.json — Section Composition

Defines what pre-built section components to render and in what order.

```json
{
  "version": "1.0.0",
  "navigation": "NavFull",
  "sections": [
    { "type": "HeroFullScreen", "id": "hero" },
    { "type": "ValueProps", "id": "value-props" },
    {
      "type": "About", "id": "about",
      "config": {
        "heading": "Our Story",
        "content": "Founded in 2024...",
        "imageUrl": "about-photo.jpg"
      }
    },
    { "type": "Testimonials", "id": "testimonials" },
    { "type": "CTASplit", "id": "cta" }
  ],
  "footer": "FooterFull",
  "settings": {
    "wrapperClass": "template-{slug}",
    "googleFontsUrl": "https://fonts.googleapis.com/css2?family=...",
    "sectionPadding": "2rem/3rem/3.5rem"
  }
}
```

### Key Fields

| Field | Required | Description |
|-------|----------|-------------|
| `version` | Yes | Schema version (currently `"1.0.0"`) |
| `navigation` | Yes | Nav component: `NavMinimal`, `NavFull`, or `NavTransparent` |
| `sections` | Yes | Array of section objects |
| `sections[].type` | Yes | Must match a registered section component name |
| `sections[].id` | Recommended | HTML `id` for anchor links (e.g., `#about`) |
| `sections[].config` | Optional | Per-section overrides (heading, content, imageUrl, etc.) |
| `sections[].visible` | Optional | Set `false` to hide a section without removing it |
| `footer` | Yes | Footer component: `FooterSimple` or `FooterFull` |
| `settings.wrapperClass` | Yes | Must be `template-{slug}` — used to scope CSS |
| `settings.googleFontsUrl` | Optional | Google Fonts URL to load |
| `settings.sectionPadding` | Optional | Override section padding: `"2rem"` or `"2rem/3rem/3.5rem"` (mobile/sm/md) |

### Section Image References

Section `config.imageUrl` can be:
- A **relative filename** (e.g., `"about-photo.jpg"`) — will be resolved to a signed S3 URL at runtime
- A **full URL** (e.g., `"https://..."`) — used as-is
- Omitted — section renders a gradient fallback

---

## 2. defaults.json — Design System + Content

Contains the complete design system and default content. All color values are **raw HSL without `hsl()` wrapper**.

```json
{
  "template": "my-slug",
  "slug": "my-slug",
  "logoPath": null,
  "heroImagePath": "hero.jpg",
  "heroVideoPath": null,
  "primaryColor": "275 70% 55%",
  "fontFamily": "'Outfit', sans-serif",
  "designSystem": {
    "colors": {
      "primary-scale": {
        "50": "275 85% 97%",
        "100": "275 80% 93%",
        "500": "275 70% 55%",
        "900": "275 65% 15%"
      },
      "primary": "275 70% 55%",
      "secondary": "305 55% 50%",
      "accent": "255 80% 65%",
      "background": "270 15% 8%",
      "surface": "270 12% 12%",
      "text": "270 10% 85%",
      "heading": "270 5% 95%",
      "border": "270 12% 25%",
      "success": "142 71% 45%",
      "warning": "38 92% 50%",
      "error": "0 84% 60%",
      "info": "217 91% 60%"
    },
    "typography": {
      "fontFamily": {
        "base": "'Nunito', sans-serif",
        "heading": "'Outfit', sans-serif"
      },
      "fontSize": { "xs": "0.75rem", "sm": "0.875rem", "base": "1rem", "lg": "1.125rem", "xl": "1.25rem", "2xl": "1.5rem", "3xl": "1.875rem", "4xl": "2.25rem", "5xl": "3rem", "6xl": "3.75rem" }
    },
    "shadows": { "theme-sm": "...", "theme-md": "...", "theme-lg": "..." },
    "gradients": { "primary": "...", "hero-overlay": "..." },
    "spacing": { "section": "5rem", "container": "1.5rem", "card": "2rem" },
    "borderRadius": { "sm": "0.375rem", "md": "0.75rem", "lg": "1rem", "xl": "1.5rem", "full": "9999px" }
  },
  "valueProps": [
    { "title": "Premium Quality", "description": "Lab-tested products", "icon": "Shield" }
  ],
  "pageContent": {
    "homeHeroTitle": "Welcome",
    "homeHeroSubtitle": "Your medical cannabis partner",
    "homeHeroDescription": "Premium products delivered with care",
    "aboutMission": "Our mission..."
  },
  "navigation": {
    "links": [
      { "label": "Products", "href": "/products" },
      { "label": "About", "href": "/about" },
      { "label": "Contact", "href": "/contact" }
    ],
    "cta": { "label": "Book Consultation", "href": "/consultation" }
  },
  "footer": {
    "copyright": "© {year} {businessName}. All rights reserved.",
    "disclaimer": "For medical use only.",
    "sections": [
      { "title": "Quick Links", "links": [{ "label": "Products", "href": "/products" }] }
    ]
  }
}
```

> [!CAUTION]
> **HSL Format**: All colors MUST be raw HSL strings like `"275 70% 55%"` — NEVER wrapped in `hsl()`. The runtime wraps them: `hsl(var(--tenant-color-primary))`. Double-wrapping causes `hsl(hsl(...))` which breaks rendering.

> [!CAUTION]
> **heroImagePath**: Must be a relative filename (e.g., `"hero.jpg"`) or `null`. Never an absolute path — the clone process prepends the tenant S3 path.

---

## 3. styles.css — CSS Variables + Overrides

```css
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Nunito:wght@400;600;700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

/* ===== Template Design Tokens ===== */
:root {
  --tenant-color-primary: 275 70% 55%;
  --tenant-color-secondary: 305 55% 50%;
  --tenant-color-accent: 255 80% 65%;
  --tenant-color-background: 270 15% 8%;
  --tenant-color-surface: 270 12% 12%;
  --tenant-color-text: 270 10% 85%;
  --tenant-color-heading: 270 5% 95%;
  --tenant-color-border: 270 12% 25%;
  --tenant-font-base: 'Nunito', sans-serif;
  --tenant-font-heading: 'Outfit', sans-serif;
}

/* Scoped styles — MUST use .template-{slug} prefix */
.template-my-slug {
  font-family: var(--tenant-font-base);
  background-color: hsl(var(--tenant-color-background));
  color: hsl(var(--tenant-color-text));
}

.template-my-slug h1, .template-my-slug h2, .template-my-slug h3, .template-my-slug h4 {
  font-family: var(--tenant-font-heading);
  color: hsl(var(--tenant-color-heading));
}

.template-my-slug .btn-primary {
  background-color: hsl(var(--tenant-color-primary));
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 9999px;
  font-weight: 600;
  transition: all 0.2s;
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### CSS Rules

| Rule | ✅ Correct | ❌ Wrong |
|------|-----------|---------|
| `:root` values | `--tenant-color-primary: 275 70% 55%;` | `--tenant-color-primary: hsl(275 70% 55%);` |
| CSS class rules | `background: hsl(var(--tenant-color-primary));` | `background: var(--tenant-color-primary);` |
| Opacity | `hsl(var(--tenant-color-primary) / 0.3)` | `rgba(...)` or hardcoded values |
| Scoping | `.template-slug .btn { ... }` | `.btn { ... }` (global leak) |

### CSS Sanitization

At runtime, the SaaS strips potentially dangerous patterns:
- `@import` — removed (fonts loaded via `layout.json` `googleFontsUrl`)
- `url()` — removed
- `expression()` — removed

The `@tailwind` and `@layer` directives are stripped for legacy filesystem-loaded CSS but kept in S3-loaded CSS (they have no effect since Tailwind processes at build time, not runtime).

---

## 4. template.config.json — Metadata

```json
{
  "id": "my-slug",
  "slug": "my-slug",
  "name": "My Template Name",
  "description": "A premium dark-themed dispensary template",
  "version": "1.0.0",
  "author": "BudStack Platform",
  "category": "modern",
  "tags": ["dark", "bold", "premium"],
  "features": ["Full-screen hero", "Animated stats", "Rich FAQ"],
  "sections": ["HeroFullScreen", "ValueProps", "About", "Testimonials", "CTASplit"],
  "navigation": "NavFull",
  "footer": "FooterFull",
  "previewUrl": "/templates/my-slug/hero.jpg",
  "price": 0,
  "isPremium": false,
  "isActive": true,
  "customization": {
    "colors": { "primary": "#8B5CF6", "secondary": "#A855F7", "accent": "#7C3AED" },
    "fonts": { "base": "'Nunito', sans-serif", "heading": "'Outfit', sans-serif" }
  },
  "accessibility": { "wcag_level": "AA", "screen_reader_tested": true }
}
```

---

## Rendering Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│  S3 Storage                                                  │
│  templates/{slug}/layout.json, defaults.json, styles.css     │
│  tenants/{id}/templates/{ts}/ (cloned per-tenant overrides)  │
└──────────┬───────────────────────────────────────────────────┘
           ↓
┌──────────────────────────────────────────────────────────────┐
│  layout.tsx (outer shell — wraps ALL store pages)            │
│  1. Fetches tenant + active TenantTemplate from DB           │
│  2. Loads layout.json, styles.css, defaults.json from S3     │
│  3. Merges DB overrides with defaults (DB wins)              │
│  4. Wraps children in TenantThemeProvider → CartProvider      │
│  5. Renders nav + footer from layout.json section-registry   │
│  6. Injects sanitized CSS via <style> tag                    │
│  7. Loads Google Fonts via <link> tag                         │
└──────────┬───────────────────────────────────────────────────┘
           ↓
┌──────────────────────────────────────────────────────────────┐
│  page.tsx (homepage)                                         │
│  1. Loads layout.json + defaults.json from S3                │
│  2. Signs hero image URL and section imageUrls               │
│  3. Merges props: DB overrides + defaults + tenant data      │
│  4. Returns <TemplateRenderer layout={} sectionProps={} />   │
│     with renderChrome={false} (layout.tsx handles nav/footer)│
└──────────┬───────────────────────────────────────────────────┘
           ↓
┌──────────────────────────────────────────────────────────────┐
│  template-renderer.tsx                                       │
│  Maps layout.json sections to pre-built React components:    │
│  for (section of layout.sections) {                          │
│    Component = getSectionComponent(section.type)             │
│    <section id={section.id}>                                 │
│      <Component {...sectionProps} config={section.config} /> │
│    </section>                                                │
│  }                                                           │
└──────────────────────────────────────────────────────────────┘
```

### S3 Path Resolution

The system tries TWO paths in order:
1. **Tenant path** — `tenants/{tenantId}/templates/{timestamp}/` (cloned copy with overrides)
2. **Base path** — `templates/{slug}` (original uploaded template)

First successful `layout.json` find wins. CSS and defaults load from the same path.

---

## Section Component Registry

All pre-built components live in `components/sections/` in the SaaS codebase. They receive standardized `SectionProps` plus per-section `config` overrides from `layout.json`.

### Heroes

| Component | Description | Image Required? |
|-----------|-------------|-----------------|
| `HeroFullScreen` | Full-viewport hero with gradient overlay | No (gradient fallback) |
| `HeroSplit` | Two-column: text + image/gradient | No (gradient fallback) |
| `HeroVideo` | Video background → image → gradient cascade | No |
| `HeroMinimal` | Clean, compact hero — gradient only | No |

### Content Sections

| Component | Description | Image Required? |
|-----------|-------------|-----------------|
| `ValueProps` | Icon cards with title/description | No |
| `ProductShowcase` | Product category cards with arrows | No |
| `Testimonials` | Quote cards with star ratings | No |
| `About` | Split layout: text + image/gradient | No (gradient fallback) |
| `Gallery` | Image grid | **Yes — will 404 without images** |
| `Stats` | Animated number counters | No |
| `FAQ` | Accordion with expand/collapse | No |
| `BlogFeed` | Blog post cards | No (gradient placeholders) |
| `Features` | Icon + text feature grid | No |

### CTAs

| Component | Description | Image Required? |
|-----------|-------------|-----------------|
| `CTABanner` | Full-width colored banner | No |
| `CTAWithImage` | CTA with side image/gradient | No (gradient fallback) |
| `CTASplit` | Two-column CTA | No (gradient fallback) |

### Navigation

| Component | Best For | Notes |
|-----------|----------|-------|
| `NavMinimal` | Clean/luxury themes | Understated, fewer links |
| `NavFull` | Standard themes | All links + CTA button |
| `NavTransparent` | Dark themes | White text, blends with hero. **Needs dark hero** |

### Footers

| Component | Best For |
|-----------|----------|
| `FooterSimple` | Minimal themes — single row |
| `FooterFull` | Standard themes — multi-column |

> [!WARNING]
> `NavTransparent` and `HeroFullScreen` render **white text**. Light-themed templates (background lightness > 50%) should use `NavFull`/`NavMinimal` instead, or add dark overlay CSS in `styles.css`.

---

## TenantThemeProvider

Sets CSS variables via **inline styles** on a container div. These override `:root` values from `styles.css`:

```jsx
<div class="tenant-theme-container" style="--tenant-color-primary: 275 70% 55%; ...">
  {children}
</div>
```

This means colors/fonts work even if `styles.css` fails to load from S3. The `:root` values in `styles.css` act as a fallback; `TenantThemeProvider`'s inline styles take precedence.

---

## Template Deployment Workflow

### Creating a Template

1. Create the 4 files in a `{slug}-template/` directory
2. Push to a GitHub repo
3. In **Super Admin** → **Store Templates** → **Upload New Template** → paste GitHub repo URL
4. The system reads the files and uploads to S3 at `templates/{slug}/`
5. Template appears in the marketplace for tenants to clone

### Tenant Activation

1. **Tenant Admin** → **Templates** → browse marketplace
2. **Clone Template** — system creates a `TenantTemplate` record and copies files to `tenants/{id}/templates/{timestamp}/`
3. **Activate** — sets this as the active template
4. **Branding** page → change colors, fonts, logo, hero image, business name
5. Changes save to `TenantTemplate.designSystem` in DB (overrides defaults)

### Hot-Deploy (Update Without Restart)

1. Edit template files locally
2. Re-upload: `aws s3 sync {slug}-template/ s3://budstack-uploads/templates/{slug}/`
3. Or push updated GitHub repo and re-upload via Super Admin
4. Hard-refresh the storefront — new content appears immediately
5. **No server restart required**

---

## Template Scope

### What Templates Handle
- ✅ Home page layout and sections
- ✅ Visual theme (colors, fonts, animations)
- ✅ Navigation style
- ✅ Footer style

### What the SaaS Platform Handles
- ❌ Products page
- ❌ Consultation booking page
- ❌ Contact page
- ❌ About page (standalone)
- ❌ Legal pages (privacy, terms, cookies)
- ❌ Blog/The Wire
- ❌ User authentication
- ❌ Shopping cart
- ❌ Admin panels

### Branding Customization (Tenant Admin)
Users customize via `/tenant-admin/branding`:
- Logo, hero image, primary/secondary color, font family
- Business name, tagline, email, phone, social links

**Goal: Customer selling in 15 minutes** with just basic branding changes.

---

## Light Theme vs Dark Theme

Pre-built components assume **dark backgrounds** (white text). Light-themed templates (background lightness > 50%) need CSS overrides in `styles.css`:

### Hero Dark Overlay (for light themes)
```css
.template-{slug} section:first-of-type::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 5;
  background: linear-gradient(180deg,
    hsl(var(--tenant-color-secondary) / 0.55) 0%,
    hsl(var(--tenant-color-heading) / 0.7) 60%,
    hsl(var(--tenant-color-heading) / 0.88) 100%);
  pointer-events: none;
}
```

### Footer Override (for light themes)
```css
.template-{slug} footer {
  background-color: hsl(var(--tenant-color-heading)) !important;
  color: white !important;
}
```

---

## Key File Locations (SaaS Codebase)

| File | Purpose |
|------|---------|
| [layout.tsx](file:///Users/gkavanagh/Development/HealingBuds/budstack-saas/nextjs_space/app/store/[slug]/layout.tsx) | Outer layout — theme, nav, footer, CSS injection |
| [page.tsx](file:///Users/gkavanagh/Development/HealingBuds/budstack-saas/nextjs_space/app/store/[slug]/page.tsx) | Homepage — loads layout, signs images, renders TemplateRenderer |
| [template-renderer.tsx](file:///Users/gkavanagh/Development/HealingBuds/budstack-saas/nextjs_space/components/template-renderer.tsx) | Maps sections to components |
| [section-registry.ts](file:///Users/gkavanagh/Development/HealingBuds/budstack-saas/nextjs_space/lib/section-registry.ts) | Maps section type strings → React components |
| [template-registry.ts](file:///Users/gkavanagh/Development/HealingBuds/budstack-saas/nextjs_space/lib/template-registry.ts) | Legacy React template imports (being deprecated) |
| [section-props.ts](file:///Users/gkavanagh/Development/HealingBuds/budstack-saas/nextjs_space/lib/types/section-props.ts) | TypeScript types for section props |
| [template-layout.ts](file:///Users/gkavanagh/Development/HealingBuds/budstack-saas/nextjs_space/lib/types/template-layout.ts) | TypeScript types for layout.json |
| [tenant-theme-provider.tsx](file:///Users/gkavanagh/Development/HealingBuds/budstack-saas/nextjs_space/components/tenant-theme-provider.tsx) | Sets CSS variables from DB |
| `components/sections/**/*.tsx` | Pre-built section components |

---

## Template Status (as of 2026-02-11)

| Template | Format | Working? | Notes |
|----------|--------|----------|-------|
| **HighMan** | ✅ Data-only (layout.json) | ✅ Yes | Created by subagent |
| **CannaBizz** | ✅ Data-only (layout.json) | ✅ Yes | Created by subagent |
| **HealingBuds** | ❌ Legacy React | ✅ Yes (needs rebuild) | Pilot for migration |
| **GTA** | ❌ Legacy React | ⚠️ Possibly broken | Needs conversion |
| **Wellness** | ❌ Legacy React | ⚠️ Possibly broken | Needs conversion |
| **Yellow-Haze** | ❌ Legacy React (NOT registered) | ❌ Broken | Created by subagent but old format |

---

## Troubleshooting

### Template not rendering?
1. Check S3: does `templates/{slug}/layout.json` exist?
2. Check DB: does the tenant have an `activeTenantTemplate` with a valid `baseTemplateId`?
3. Check logs: `[layout] FOUND layout.json at:` vs `[layout] No layout.json at:`
4. Check for double-slash in S3 paths: `tenantS3Path` ending with `/` causes `//layout.json` → 404

### Wrong colors/fonts?
1. Check `defaults.json` — are colors raw HSL (no `hsl()` wrapper)?
2. Check DB `TenantTemplate.designSystem` — DB overrides win over defaults
3. Inspect element → check `--tenant-color-*` values on `.tenant-theme-container`

### Spacing issues?
1. Check `globals.css` for any `.tenant-theme-container section` rules that override component padding
2. Use `layout.json` `sectionPadding` setting for per-template control
3. Default component padding is `py-8 sm:py-10`

### CSS overrides not working?
1. S3 CSS is sanitized: `@import`, `url()`, `expression()` are stripped
2. Scope all rules under `.template-{slug}` for specificity
3. TenantThemeProvider inline styles override `:root` variables

---

## Adding New Section Components

To expand the component library:

1. Create component in `components/sections/{category}/{ComponentName}.tsx`
2. Accept `SectionProps` interface + read from `sectionConfig`
3. Register in `lib/section-registry.ts`:
   ```typescript
   import { NewComponent } from '@/components/sections/content/NewComponent';
   // Add to SECTION_REGISTRY:
   NewComponent,
   ```
4. Component is now available in ALL template `layout.json` files
5. Update `budstack-template-creator/CLAUDE.md` with the new component
6. Push to Railway → rebuild

---

## Creating Templates

### Option A: Template Creator SubAgent

Located at `templates/budstack-template-creator/`. Interactive interview asks 7 questions and generates all 4 files. See [CLAUDE.md](file:///Users/gkavanagh/Development/HealingBuds/templates/budstack-template-creator/CLAUDE.md) for full instructions.

### Option B: Manual Creation

1. Copy an existing data-only template as a starting point (`highman-template/` or `cannabizz-template/`)
2. Edit all 4 files to match your design
3. Follow the HSL color rules and section naming conventions
4. Validate: all section types in `layout.json` must exist in the section registry
5. Upload via Super Admin or `aws s3 sync`
