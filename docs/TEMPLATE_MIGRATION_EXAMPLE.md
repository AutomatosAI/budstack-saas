# Template Migration Guide: Legacy React → Data-Only Format

**Last Updated:** 2026-02-11

---

## Overview

This guide shows how to convert a **legacy React template** (with `index.tsx` + `components/`) into the **data-only format** (4 JSON/CSS files). After conversion, the template hot-deploys via S3 without requiring a SaaS rebuild.

> [!NOTE]
> For the full architecture reference, see [TEMPLATE_ARCHITECTURE.md](./TEMPLATE_ARCHITECTURE.md).

---

## Before & After

**Before (Legacy React):**
```
healingbuds/
├── index.tsx              ← React component (REMOVE)
├── components/            ← Custom components (REMOVE)
│   ├── Hero.tsx
│   ├── Navigation.tsx
│   ├── Footer.tsx
│   └── ...
├── defaults.json          ← Keep & update
├── styles.css             ← Keep & update
└── template.config.json   ← Keep & update
```

**After (Data-Only):**
```
healingbuds-template/
├── layout.json            ← NEW: section composition
├── defaults.json          ← UPDATED: raw HSL, full design system
├── styles.css             ← UPDATED: :root vars, scoped rules
└── template.config.json   ← UPDATED: sections/nav/footer metadata
```

---

## Step-by-Step Migration

### Step 1: Map Components → Section Types

Open the template's `index.tsx` and list each component. Find the matching pre-built section:

| Legacy Component | → Pre-Built Section | Notes |
|-----------------|---------------------|-------|
| Custom `Hero` (full-screen) | `HeroFullScreen` | |
| Custom `Hero` (video) | `HeroVideo` | |
| Custom `Hero` (split) | `HeroSplit` | |
| `AboutHero` / `About` | `About` | Split layout: text + image |
| `ValueProps` / `Features` | `ValueProps` or `Features` | Card grid |
| `News` / `Blog` | `BlogFeed` | Blog post cards |
| `Testimonials` | `Testimonials` | Quote cards |
| `ProductShowcase` | `ProductShowcase` | Category cards |
| `Stats` / `Numbers` | `Stats` | Animated counters |
| `FAQ` | `FAQ` | Accordion |
| `CTA` / `CallToAction` | `CTABanner`, `CTAWithImage`, or `CTASplit` | |
| Custom `Navigation` | `NavFull`, `NavMinimal`, or `NavTransparent` | |
| Custom `Footer` | `FooterFull` or `FooterSimple` | |

> [!WARNING]
> If a legacy component has no pre-built equivalent, you'll need to either:
> 1. Add a new section component to the registry (see [TEMPLATE_ARCHITECTURE.md](./TEMPLATE_ARCHITECTURE.md#adding-new-section-components))
> 2. Use the closest alternative (e.g., `Features` for a process/cultivation section)

### Step 2: Create layout.json

Map the component composition from `index.tsx` into `layout.json`:

**Example — `index.tsx` has:**
```tsx
<Hero />
<AboutHero />
<ValueProps />
<News />
<CTASplit />
```

**Creates `layout.json`:**
```json
{
  "version": "1.0.0",
  "navigation": "NavFull",
  "sections": [
    { "type": "HeroFullScreen", "id": "hero" },
    { "type": "About", "id": "about" },
    { "type": "ValueProps", "id": "value-props" },
    { "type": "BlogFeed", "id": "blog" },
    { "type": "CTASplit", "id": "cta" }
  ],
  "footer": "FooterFull",
  "settings": {
    "wrapperClass": "template-{slug}",
    "googleFontsUrl": "https://fonts.googleapis.com/css2?family=..."
  }
}
```

Extract any per-section content (headings, descriptions, image references) into `config`:
```json
{ "type": "About", "id": "about", "config": { "heading": "Our Story", "content": "Founded in..." } }
```

### Step 3: Update defaults.json

Ensure all colors are **raw HSL** (no `hsl()` wrapper). Add any missing fields:

```diff
- "primaryColor": "#16a34a",
+ "primaryColor": "142 76% 36%",

- "colors": { "primary": "#16a34a" }
+ "colors": { "primary": "142 76% 36%" }
```

Add the full design system structure if missing (see [TEMPLATE_BASELINE.md](./TEMPLATE_BASELINE.md) for required fields).

### Step 4: Update styles.css

Add `:root` CSS variables with raw HSL values. Scope all rules under `.template-{slug}`:

```css
:root {
  --tenant-color-primary: 142 76% 36%;
  --tenant-color-secondary: 160 84% 39%;
  /* ... */
  --tenant-font-base: 'Inter', sans-serif;
  --tenant-font-heading: 'Playfair Display', serif;
}

.template-healingbuds {
  font-family: var(--tenant-font-base);
  background-color: hsl(var(--tenant-color-background));
  color: hsl(var(--tenant-color-text));
}
```

### Step 5: Update template.config.json

Add `sections`, `navigation`, and `footer` fields:

```json
{
  "id": "healingbuds",
  "slug": "healingbuds",
  "sections": ["HeroFullScreen", "About", "ValueProps", "BlogFeed", "CTASplit"],
  "navigation": "NavFull",
  "footer": "FooterFull"
}
```

### Step 6: Remove Legacy Files

Delete `index.tsx`, `components/` directory, and any other React-specific files:
```bash
rm index.tsx
rm -rf components/
```

### Step 7: Upload & Test

1. Push to GitHub repo
2. **Super Admin** → **Upload Template** → paste repo URL
3. **Tenant Admin** → **Clone Template** → **Activate**
4. Visit storefront and verify all sections render
5. Test branding changes

### Step 8: Remove from Legacy Registry

After verification, remove the template from `lib/template-registry.ts`:

```diff
- "healingbuds": dynamic(() => import("@/templates/healingbuds/index")),
```

Also remove from `TEMPLATE_NAVIGATION` and `TEMPLATE_FOOTER` registries. Push to Railway.

---

## Common Migration Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| White page | `hsl()` double-wrapping in `defaults.json` | Use raw HSL: `"142 76% 36%"` not `"hsl(142 76% 36%)"` |
| Sections missing | Section type not in registry | Check spelling matches exactly (case-sensitive) |
| Wrong colors | DB overrides stale values | Clear `TenantTemplate.designSystem` or re-clone |
| CSS not applying | Rules not scoped | Prefix all rules with `.template-{slug}` |
| Images 404 | Absolute path in `heroImagePath` | Use relative filename: `"hero.jpg"` not `"/templates/slug/hero.jpg"` |
