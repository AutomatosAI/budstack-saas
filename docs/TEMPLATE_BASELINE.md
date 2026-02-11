# BudStack Template Baseline Standard v3.0

**Last Updated:** 2026-02-11  
**Version:** 3.0.0  
**Status:** Production Standard

> [!IMPORTANT]
> This document describes the **data-only template format**. Templates contain NO React code. For the full architecture, see [TEMPLATE_ARCHITECTURE.md](./TEMPLATE_ARCHITECTURE.md).

---

## Required File Structure

Every template MUST have exactly these 4 files:

```
{slug}-template/
├── layout.json           # Section composition — which sections, in what order
├── defaults.json         # Design system (colors, fonts) + content defaults
├── template.config.json  # Metadata (name, tags, category)
└── styles.css            # CSS variables + custom overrides
```

**No `index.tsx`. No `components/` directory. No React code. No README.md required.**

---

## 1. layout.json

Defines which pre-built section components render and in what order.

```json
{
  "version": "1.0.0",
  "navigation": "NavFull",
  "sections": [
    { "type": "HeroFullScreen", "id": "hero" },
    { "type": "ValueProps", "id": "value-props" },
    { "type": "About", "id": "about", "config": { "heading": "Our Story" } },
    { "type": "Testimonials", "id": "testimonials" },
    { "type": "CTASplit", "id": "cta" }
  ],
  "footer": "FooterFull",
  "settings": {
    "wrapperClass": "template-{slug}",
    "googleFontsUrl": "https://fonts.googleapis.com/css2?family=..."
  }
}
```

### Valid Section Types

| Category | Components |
|----------|-----------|
| Heroes | `HeroFullScreen`, `HeroSplit`, `HeroVideo`, `HeroMinimal` |
| Content | `ValueProps`, `ProductShowcase`, `Testimonials`, `About`, `Gallery`*, `Stats`, `FAQ`, `BlogFeed`, `Features` |
| CTAs | `CTABanner`, `CTAWithImage`, `CTASplit` |
| Navigation | `NavMinimal`, `NavFull`, `NavTransparent` |
| Footers | `FooterSimple`, `FooterFull` |

*Gallery requires bundled images — all others work without images (gradient fallbacks).

---

## 2. defaults.json

Full design system + content. All colors as **raw HSL** (no `hsl()` wrapper).

### Required Fields

| Field | Format | Example |
|-------|--------|---------|
| `template` / `slug` | string | `"my-slug"` |
| `primaryColor` | Raw HSL | `"275 70% 55%"` |
| `fontFamily` | CSS font stack | `"'Outfit', sans-serif"` |
| `designSystem.colors.*` | Raw HSL | `"275 70% 55%"` |
| `designSystem.typography.fontFamily` | Object | `{ "base": "...", "heading": "..." }` |
| `valueProps` | Array | `[{ "title": "", "description": "", "icon": "" }]` |
| `pageContent` | Object | `{ "homeHeroTitle": "..." }` |
| `navigation` | Object | `{ "links": [...], "cta": {...} }` |
| `footer` | Object | `{ "copyright": "...", "sections": [...] }` |

> [!CAUTION]
> Colors MUST be raw HSL: `"275 70% 55%"` — NEVER `"hsl(275 70% 55%)"`. Double-wrapping breaks rendering.

---

## 3. styles.css

CSS variables and scoped overrides. `:root` values use raw HSL.

```css
@import url('https://fonts.googleapis.com/css2?family=...');
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --tenant-color-primary: 275 70% 55%;
  --tenant-color-secondary: 305 55% 50%;
  /* ... all tenant color/font variables ... */
  --tenant-font-base: 'Nunito', sans-serif;
  --tenant-font-heading: 'Outfit', sans-serif;
}

/* All rules MUST be scoped under .template-{slug} */
.template-my-slug {
  font-family: var(--tenant-font-base);
  background-color: hsl(var(--tenant-color-background));
  color: hsl(var(--tenant-color-text));
}
```

### Rules
- `:root` values: raw HSL (no `hsl()` wrapper)
- CSS class rules: wrap in `hsl()` → `hsl(var(--tenant-color-primary))`
- All rules scoped under `.template-{slug}` to prevent global leaks
- Never hardcode colors — always use `var(--tenant-color-*)`

---

## 4. template.config.json

Metadata for the marketplace and admin UI.

```json
{
  "id": "my-slug",
  "slug": "my-slug",
  "name": "My Template",
  "description": "Description for marketplace listing",
  "version": "1.0.0",
  "author": "BudStack Platform",
  "category": "modern",
  "tags": ["dark", "bold"],
  "features": ["Full-screen hero", "Animated stats"],
  "sections": ["HeroFullScreen", "ValueProps", "About"],
  "navigation": "NavFull",
  "footer": "FooterFull",
  "price": 0,
  "isPremium": false,
  "isActive": true
}
```

---

## Validation Checklist

### Files
- [ ] `layout.json` — valid JSON, all section types exist in registry
- [ ] `defaults.json` — all colors raw HSL, full design system
- [ ] `styles.css` — `:root` vars defined, rules scoped under `.template-{slug}`
- [ ] `template.config.json` — complete metadata

### Colors
- [ ] No `hsl()` wrappers in `defaults.json` or `:root` block
- [ ] No hex/rgb values — HSL only
- [ ] CSS rules use `hsl(var(--tenant-color-*))` syntax

### Content  
- [ ] No placeholder text (`TODO`, `FIXME`, `Template Name`)
- [ ] `heroImagePath` is relative filename or `null` (never absolute path)
- [ ] `settings.wrapperClass` matches `template-{slug}`

---

## Reference Templates

| Template | Style | Format |
|----------|-------|--------|
| **HighMan** | Jamaican-inspired, playful | ✅ Data-only |
| **CannaBizz** | Modern, dark, professional | ✅ Data-only |

See [TEMPLATE_ARCHITECTURE.md](./TEMPLATE_ARCHITECTURE.md) for the full architecture, rendering pipeline, and component registry.

---

## Version History

- **v3.0.0** (2026-02-11): Rewritten for data-only template format (no React code)
- **v2.0.0** (2026-02-05): Established baseline with HSL colors
- **v1.0.0** (2025): Initial template system (React components)
