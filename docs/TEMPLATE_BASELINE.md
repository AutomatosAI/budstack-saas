# BudStack Template Baseline Standard v2.0

**Last Updated:** 2026-02-05
**Version:** 2.0.0
**Status:** Production Standard

---

## Overview

This document defines the **canonical structure** for all BudStack templates. Every template must follow this baseline to ensure consistency, maintainability, and seamless integration with the BudStack platform.

**Philosophy**: Flexible but Simple
- Templates handle **home page only** (hero, sections, styling)
- SaaS manages **core pages** (research, products, about, contact, compliance)
- Users customize: logo, hero image, fonts, colors, tagline, contact info
- Goal: **Customer selling in 15 minutes**

---

## Required File Structure

Every template MUST have this exact structure:

```
template-name/
├── index.tsx                    # Main entry component (REQUIRED)
├── template.config.json         # Metadata (REQUIRED)
├── defaults.json                # Design system defaults (REQUIRED)
├── styles.css                   # Template styles (REQUIRED)
├── components/                  # Component directory (REQUIRED)
│   ├── Hero.tsx                 # Hero section (REQUIRED)
│   ├── Navigation.tsx           # Custom nav (if needed)
│   ├── Footer.tsx              # Custom footer (if needed)
│   ├── [Feature sections]      # Variable components
│   └── ConsultationCTA.tsx     # CTA component (REQUIRED)
├── README.md                    # Installation & usage
└── assets/                      # Default images (optional)
```

---

## 1. index.tsx - Main Component

### Required Structure

```tsx
'use client';

import './styles.css';
import { Tenant } from '@/types/client';
import Hero from './components/Hero';
import ConsultationCTA from './components/ConsultationCTA';
// ... other component imports

interface TemplateProps {
  tenant: Tenant;
  consultationUrl?: string;
  productsUrl?: string;
  contactUrl?: string;
  heroImageUrl?: string | null;
  logoUrl?: string | null;
  posts?: any[];
}

export default function TemplateNameTemplate({
  tenant,
  consultationUrl,
  productsUrl,
  contactUrl,
  heroImageUrl,
  logoUrl,
  posts
}: TemplateProps) {
  return (
    <div
      className="template-name"
      style={{
        fontFamily: 'var(--tenant-font-base, sans-serif)',
        backgroundColor: 'var(--tenant-color-background)',
        color: 'var(--tenant-color-text)'
      }}
    >
      <Hero
        businessName={tenant.businessName}
        heroImageUrl={heroImageUrl}
        tenant={tenant}
      />

      {/* Other sections */}

      <ConsultationCTA
        businessName={tenant.businessName}
        consultationUrl={consultationUrl}
      />
    </div>
  );
}
```

### Key Requirements:
- ✅ MUST use `'use client'` directive
- ✅ MUST import `./styles.css`
- ✅ MUST accept standardized `TemplateProps`
- ✅ MUST use CSS variables for theming
- ✅ MUST be a default export

---

## 2. template.config.json - Metadata

### Required Structure

```json
{
  "id": "template-slug",
  "slug": "template-slug",
  "name": "Template Display Name",
  "description": "Detailed description (100-200 chars)",
  "version": "2.0.0",
  "author": "BudStack Platform",
  "category": "medical|wellness|modern|minimal",
  "tags": ["tag1", "tag2", "tag3"],
  "features": [
    "Feature 1 description",
    "Feature 2 description"
  ],
  "previewUrl": "/templates/template-name/preview.jpg",
  "thumbnailUrl": "/templates/template-name/preview.jpg",
  "screenshots": ["/templates/template-name/preview.jpg"],
  "demoUrl": null,
  "price": 0,
  "isPremium": false,
  "isActive": true,
  "components": [
    {
      "name": "Hero",
      "path": "components/Hero.tsx",
      "required": true,
      "description": "Hero section description"
    }
  ],
  "customization": {
    "colors": {
      "primary": "#HEX",
      "secondary": "#HEX",
      "accent": "#HEX"
    },
    "fonts": {
      "base": "Font family string",
      "heading": "Font family string"
    },
    "shadows": {
      "sm": "shadow definition",
      "md": "shadow definition"
    }
  },
  "performance": {
    "bundleSize": "~XXX KB gzip",
    "lighthouseScore": "90+",
    "optimizations": ["optimization1", "optimization2"]
  },
  "compatibility": {
    "nextjs": "14.x",
    "react": "18.x",
    "browsers": ["Chrome 90+", "Firefox 88+", "Safari 14+", "Edge 90+"],
    "platform_version": "2.0+",
    "requires_features": ["hero-image", "consultation-booking", "product-catalog"]
  },
  "dependencies": ["framer-motion", "lucide-react"],
  "accessibility": {
    "wcag_level": "AA",
    "screen_reader_tested": true,
    "keyboard_navigable": true,
    "color_contrast_ratio": "4.5:1+"
  }
}
```

### Minimum Requirements:
- ✅ All top-level fields (id, slug, name, version, author, etc.)
- ✅ At least 3 tags, 5 features
- ✅ Components array with all major sections
- ✅ Customization object with colors, fonts, shadows
- ✅ Performance metrics
- ✅ Compatibility info
- ✅ Accessibility compliance

---

## 3. defaults.json - Design System

### Required Structure

```json
{
  "template": "template-slug",
  "slug": "template-slug",
  "logoPath": null,
  "heroImagePath": "/templates/template-name/hero.jpg",
  "heroVideoPath": null,
  "primaryColor": "HUE SAT% LIGHT%",
  "fontFamily": "'Font Name', fallback, sans-serif",
  "designSystem": {
    "colors": {
      "primary-scale": {
        "50": "HSL",
        "100": "HSL",
        "200": "HSL",
        "300": "HSL",
        "400": "HSL",
        "500": "HSL",
        "600": "HSL",
        "700": "HSL",
        "800": "HSL",
        "900": "HSL"
      },
      "primary": "HSL",
      "secondary": "HSL",
      "accent": "HSL",
      "background": "HSL",
      "surface": "HSL",
      "text": "HSL",
      "heading": "HSL",
      "border": "HSL",
      "success": "HSL",
      "warning": "HSL",
      "error": "HSL",
      "info": "HSL"
    },
    "typography": {
      "fontFamily": {
        "base": "Font stack",
        "heading": "Font stack",
        "decorative": "Font stack",
        "mono": "Font stack"
      },
      "fontSize": {
        "xs": "0.75rem",
        "sm": "0.875rem",
        "base": "1rem",
        "lg": "1.125rem",
        "xl": "1.25rem",
        "2xl": "1.5rem",
        "3xl": "1.875rem",
        "4xl": "2.25rem",
        "5xl": "3rem",
        "6xl": "3.75rem",
        "7xl": "4.5rem",
        "8xl": "6rem"
      },
      "lineHeight": {
        "tight": "1.25",
        "snug": "1.375",
        "normal": "1.5",
        "relaxed": "1.625",
        "loose": "2"
      },
      "letterSpacing": {
        "tighter": "-0.05em",
        "tight": "-0.025em",
        "normal": "0",
        "wide": "0.025em",
        "wider": "0.05em",
        "widest": "0.1em"
      },
      "fontWeight": {
        "normal": "400",
        "medium": "500",
        "semibold": "600",
        "bold": "700",
        "extrabold": "800"
      }
    },
    "shadows": {
      "theme-sm": "shadow definition",
      "theme-md": "shadow definition",
      "theme-lg": "shadow definition"
    },
    "gradients": {
      "primary": "gradient definition",
      "secondary": "gradient definition",
      "hero-overlay": "gradient definition"
    },
    "spacing": {
      "section": "5rem",
      "container": "1.5rem",
      "card": "2rem"
    },
    "borderRadius": {
      "none": "0",
      "sm": "0.375rem",
      "md": "0.75rem",
      "lg": "1rem",
      "xl": "1.5rem",
      "2xl": "2rem",
      "full": "9999px"
    }
  },
  "valueProps": [
    {
      "title": "Value Proposition Title",
      "description": "Description of the value",
      "icon": "LucideIconName"
    }
  ],
  "pageContent": {
    "homeHeroTitle": "Main hero title",
    "homeHeroSubtitle": "Hero subtitle",
    "homeHeroDescription": "Detailed hero description",
    "aboutMission": "Mission statement"
  },
  "navigation": {
    "links": [
      {"label": "Products", "href": "/products"},
      {"label": "Consultation", "href": "/consultation"},
      {"label": "About", "href": "/about"},
      {"label": "Contact", "href": "/contact"}
    ],
    "cta": {
      "label": "Book Consultation",
      "href": "/consultation"
    }
  },
  "footer": {
    "copyright": "© {year} {businessName}. All rights reserved.",
    "disclaimer": "Medical disclaimer text",
    "sections": [
      {
        "title": "Section Title",
        "links": [
          {"label": "Link", "href": "/path"}
        ]
      }
    ]
  }
}
```

### Key Requirements:
- ✅ **ALL colors MUST be HSL format** (e.g., "178 48% 21%")
- ✅ Color scales for primary brand colors (50-900)
- ✅ Complete typography scale (xs to 8xl)
- ✅ Letter spacing definitions
- ✅ Custom shadows for theme
- ✅ Gradient definitions
- ✅ Value props with icons
- ✅ Navigation and footer structure

---

## 4. styles.css - Stylesheet

### Required Structure

```css
/* Template Name Styles */

@import url('https://fonts.googleapis.com/css2?family=FontName:wght@weights&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

/* All colors MUST be HSL format for platform consistency */

@layer base {
  :root {
    /* Color Palette - HSL Format */
    --primary-50: HSL;
    --primary-100: HSL;
    /* ... 200-900 */
    --primary-500: HSL;    /* Main color */

    /* Application Colors */
    --background: HSL;
    --foreground: HSL;
    --surface: HSL;
    --card: HSL;
    --card-foreground: HSL;
    --primary: HSL;
    --primary-foreground: HSL;
    --secondary: HSL;
    --secondary-foreground: HSL;
    --accent: HSL;
    --border: HSL;
    --ring: HSL;

    /* Gradients */
    --gradient-primary: gradient-definition;

    /* Shadows */
    --shadow-sm: shadow-definition;
    --shadow-md: shadow-definition;

    /* Transitions */
    --transition-base: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    --transition-smooth: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    /* Typography scale */
    --font-size-xs: 0.75rem;
    /* ... through 6xl */

    /* Spacing scale */
    --spacing-xs: 0.5rem;
    /* ... through 4xl */
  }
}

@layer base {
  .template-classname {
    /* REQUIRED: Platform integration variables */
    --tenant-color-primary: hsl(var(--your-primary));
    --tenant-color-secondary: hsl(var(--your-secondary));
    --tenant-color-accent: hsl(var(--your-accent));
    --tenant-color-background: hsl(var(--background));
    --tenant-color-surface: hsl(var(--surface));
    --tenant-color-text: hsl(var(--foreground));
    --tenant-color-heading: hsl(var(--foreground));
    --tenant-color-border: hsl(var(--border));
    --tenant-color-primary-rgb: R, G, B;
    --tenant-color-secondary-rgb: R, G, B;

    /* Fonts */
    --tenant-font-heading: 'Font', fallback;
    --tenant-font-base: 'Font', fallback;

    scroll-behavior: smooth;
  }

  /* Global resets & typography */
  body {
    @apply bg-background text-foreground antialiased;
    font-family: var(--tenant-font-base);
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: var(--tenant-font-heading);
    /* ... styling */
  }
}

@layer utilities {
  /* Custom utility classes */
  .btn-primary {
    @apply px-6 py-3 rounded-xl font-medium transition-all duration-300;
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
  }

  /* More utilities */
}

/* Animations */
@keyframes fadeInUp {
  /* ... */
}
```

### Key Requirements:
- ✅ Import Google Fonts (if needed)
- ✅ Include Tailwind directives
- ✅ Define ALL colors in HSL format
- ✅ Define --tenant-color-* variables (REQUIRED for platform integration)
- ✅ Define --tenant-font-* variables
- ✅ Complete utility class library
- ✅ Animations and keyframes
- ✅ Responsive breakpoints
- ✅ Dark mode support (optional)

---

## 5. Components

### Required Components

#### Hero.tsx (REQUIRED)
```tsx
interface HeroProps {
  businessName: string;
  heroImageUrl?: string | null;
  tenant: Tenant;
}

export default function Hero({ businessName, heroImageUrl, tenant }: HeroProps) {
  return (
    <section className="hero-section">
      {/* Hero content */}
    </section>
  );
}
```

#### ConsultationCTA.tsx (REQUIRED)
```tsx
interface CTAProps {
  businessName: string;
  consultationUrl?: string;
}

export default function ConsultationCTA({ businessName, consultationUrl }: CTAProps) {
  return (
    <section className="cta-section">
      {/* CTA content */}
    </section>
  );
}
```

#### Navigation.tsx (Optional - if custom nav needed)
#### Footer.tsx (Optional - if custom footer needed)
#### Feature Sections (Variable - depends on template design)

---

## CSS Variable Naming Conventions

### Platform Integration (REQUIRED)
These variables connect your template to the BudStack platform:

```css
--tenant-color-primary: hsl(var(--your-primary-color));
--tenant-color-secondary: hsl(var(--your-secondary-color));
--tenant-color-accent: hsl(var(--your-accent-color));
--tenant-color-background: hsl(var(--background));
--tenant-color-surface: hsl(var(--surface));
--tenant-color-text: hsl(var(--foreground));
--tenant-color-heading: hsl(var(--foreground));
--tenant-color-border: hsl(var(--border));
--tenant-color-primary-rgb: R, G, B;
--tenant-color-secondary-rgb: R, G, B;

--tenant-font-heading: 'FontName', fallback;
--tenant-font-base: 'FontName', fallback;
```

### Internal Variables (Template-specific)
Use descriptive prefixes:

```css
--wellness-primary: HSL;
--retro-coral: HSL;
--medical-shadow: shadow-definition;
```

---

## Color Format: HSL Only

**CRITICAL**: All colors must use HSL format without `hsl()` wrapper:

✅ **CORRECT:**
```css
--primary: 178 48% 21%;
```

❌ **WRONG:**
```css
--primary: #1C4F4D;           /* Hex not allowed */
--primary: rgb(28, 79, 77);   /* RGB not allowed */
--primary: hsl(178 48% 21%);  /* Don't wrap in hsl() */
```

**Usage:**
```css
.element {
  background: hsl(var(--primary));
  color: hsl(var(--primary) / 0.5);  /* With opacity */
}
```

---

## Template Props Interface

Every template must accept these standardized props:

```typescript
interface TemplateProps {
  tenant: Tenant;              // Full tenant object
  consultationUrl?: string;    // /store/{slug}/consultation
  productsUrl?: string;        // /store/{slug}/products
  contactUrl?: string;         // /store/{slug}/contact
  heroImageUrl?: string | null;// From S3 via TenantTemplate
  logoUrl?: string | null;     // From S3 via TenantTemplate
  posts?: any[];              // Blog posts (if applicable)
}
```

---

## Validation Checklist

Before submitting a template, verify:

### File Structure
- [ ] index.tsx exists with proper structure
- [ ] template.config.json complete with all fields
- [ ] defaults.json has full design system
- [ ] styles.css with HSL colors and tenant variables
- [ ] components/ directory with Hero and CTA
- [ ] README.md with installation instructions

### Code Quality
- [ ] All colors in HSL format
- [ ] --tenant-color-* variables defined
- [ ] --tenant-font-* variables defined
- [ ] TemplateProps interface used correctly
- [ ] No hardcoded colors (use CSS variables)
- [ ] Responsive design (mobile-first)
- [ ] Accessibility (WCAG AA minimum)

### Design System
- [ ] Color scales (50-900) for primary colors
- [ ] Complete typography scale (xs-8xl)
- [ ] Letter spacing definitions
- [ ] Custom shadows
- [ ] Gradient definitions
- [ ] Value props with content
- [ ] Navigation structure
- [ ] Footer structure

### Performance
- [ ] Lazy loading images
- [ ] Optimized animations
- [ ] Font display optimization
- [ ] Bundle size < 200KB gzip

### Documentation
- [ ] README with clear installation steps
- [ ] Component descriptions in template.config.json
- [ ] Usage examples
- [ ] Customization guide

---

## Reference Templates

### Healingbuds (Medical/Professional)
- **Best for**: Premium medical cannabis brands
- **Style**: Sage-teal, professional, comprehensive
- **Features**: Video hero, animations, extensive design system

### Wellness-Nature (Organic/Holistic)
- **Best for**: Wellness centers, natural health products
- **Style**: Earth tones, spacious, calming
- **Features**: Organic patterns, serif fonts, natural aesthetic

### GTA-Cannabis (Retro/Bold)
- **Best for**: Modern brands wanting street-style edge
- **Style**: Neon colors, comic effects, urban
- **Features**: Neon glows, comic shadows, bold typography

---

## Template Scope

### What Templates Handle:
✅ Home page layout and sections
✅ Hero section styling
✅ Feature/value proposition sections
✅ Testimonials (if included)
✅ Product showcase sections
✅ CTA sections
✅ Custom navigation (optional)
✅ Custom footer (optional)
✅ Overall visual theme and branding

### What Platform Handles:
❌ Products page
❌ Consultation booking page
❌ Contact page
❌ About page
❌ Research/education pages
❌ Compliance pages
❌ User authentication
❌ Shopping cart
❌ Admin panels

---

## User Customization Surface

Users can customize these via `/tenant-admin/branding`:

✅ **Logo** (upload/change)
✅ **Hero Image** (upload/change)
✅ **Primary Color** (color picker)
✅ **Secondary Color** (color picker)
✅ **Font Family** (dropdown selection)
✅ **Business Name** (text input)
✅ **Tagline** (text input)
✅ **Email** (text input)
✅ **Phone** (text input)
✅ **Social Media Links** (text inputs)

Users **cannot** customize:
❌ Layout structure
❌ Component arrangement
❌ Core page functionality
❌ Template code

**Goal**: Customer can be **selling in 15 minutes** with just basic branding changes.

---

## Version History

- **v2.0.0** (2026-02-05): Established baseline standard with HSL colors, comprehensive design systems
- **v1.0.0** (2025): Initial template system

---

## Support

For questions or issues:
- GitHub: https://github.com/HealingBuds/budstack-templates
- Email: dev@healingbuds.com
- Docs: https://docs.budstack.com/templates

---

**This is a living document. When in doubt, reference the healingbuds template as the gold standard.**
