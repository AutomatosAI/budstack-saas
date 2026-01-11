# BudStack Template Design System v2.0
**Flexible Templates for Multi-Tenant Medical Cannabis Dispensaries**

---

## 🎯 Philosophy

The BudStack Template System has evolved from a prescriptive section-based approach to a **flexible, standards-based system** that gives designers creative freedom while ensuring technical compatibility.

### Core Principles

1. **Freedom of Layout** - No forced sections, no required order
2. **Standards Compliance** - Must use platform variables and component patterns
3. **Tenant Customization** - Fully themeable with tenant branding
4. **Performance First** - Optimized, accessible, mobile-responsive
5. **Content Agnostic** - Works with any tenant's content and media

---

## 📋 What IS Required

### 1. Meta Variables Usage

All templates MUST use these tenant-specific variables:

```typescript
interface TenantMeta {
  // Business Information
  businessName: string;          // Tenant's business name
  subdomain: string;             // Tenant URL slug
  customDomain?: string;         // Optional custom domain
  
  // Contact Details
  contactEmail: string;
  contactPhone?: string;
  address?: string;
  
  // Branding
  logoUrl?: string;              // Tenant logo
  primaryColor: string;          // Main brand color
  secondaryColor?: string;       // Accent color
  accentColor?: string;          // Highlight color
  
  // Typography
  fontFamily?: string;           // Body font
  headingFont?: string;          // Heading font
  
  // Hero Media
  heroType?: 'image' | 'video';
  heroImageUrl?: string;
  heroVideoUrl?: string;
  
  // Content
  tagline?: string;
  description?: string;
  customContent?: Record<string, any>;
}
```

**How to Use:**
- Access via props: `const { businessName, primaryColor } = tenant;`
- Use in CSS: `style={{ backgroundColor: tenant.primaryColor }}`
- Use in JSX: `<h1>{tenant.businessName}</h1>`

### 2. Component Standards

#### Responsive Design
- **Mobile-first** approach required
- Breakpoints: `sm:640px`, `md:768px`, `lg:1024px`, `xl:1280px`
- Use Tailwind classes or CSS Grid/Flexbox

#### Accessibility (WCAG 2.1 AA)
- Proper heading hierarchy (`h1` → `h2` → `h3`)
- Alt text for all images
- Color contrast ratio ≥ 4.5:1 for text
- Keyboard navigation support
- Screen reader compatibility

#### Performance
- Lazy load images below the fold
- Use Next.js Image component or equivalent
- Minimize render-blocking resources
- Target Lighthouse score ≥ 90

### 3. Required Links/CTAs

Templates MUST include links to:
- **Consultation Booking** - Primary CTA (`/consultation`)
- **Product Catalog** - If applicable (`/products`)
- **Contact Page** - Support channel (`/contact`)

### 4. Legal/Compliance Elements

Templates SHOULD display:
- Regulatory badges (INFARMED, EU-GMP, etc.)
- Age verification notice (18+/21+ depending on region)
- Medical disclaimer if applicable

---

## ❌ What is NOT Required

### No Forced Sections
You are NOT required to include:
- ❌ Specific "Hero Section"
- ❌ "Trust Badges Section"
- ❌ "Featured Conditions Section"
- ❌ "Process Steps Section"
- ❌ "Testimonials Section"
- ❌ Any predefined section structure

### No Fixed Order
- Arrange content in any order that serves your design
- Use any layout system (grid, flex, masonry, etc.)
- Create unique visual hierarchies

### No Styling Constraints
- Design can be minimalist, maximal, editorial, e-commerce, etc.
- Use any animation library (Framer Motion, GSAP, etc.)
- Implement any interaction patterns (parallax, scroll triggers, etc.)

---

## 📦 Template Structure

### Directory Layout

```
my-template/
├── template.config.json       # Template metadata
├── index.tsx                  # Main entry component
├── styles.css                 # Global template styles (optional)
├── components/                # Template-specific components
│   ├── HeroVideo.tsx
│   ├── ProductGrid.tsx
│   └── ...
├── assets/                    # Static assets (optional)
│   ├── icons/
│   └── images/
└── README.md                  # Template documentation
```

### template.config.json

```json
{
  "id": "unique-template-id",
  "name": "Template Display Name",
  "version": "1.0.0",
  "author": "Designer Name",
  "description": "Brief template description",
  "preview_image": "https://motionarray.imgix.net/preview-1105107-ho0W3vCOIp-high_0016.jpg?w=660&q=60&fit=max&auto=format",
  "tags": ["modern", "minimal", "video"],
  "created_at": "2025-11-24",
  "compatibility": {
    "platform_version": "2.0+",
    "nextjs_version": "14.x",
    "react_version": "18.x"
  },
  "features": {
    "hero_video": true,
    "parallax_scrolling": true,
    "dark_mode": false
  },
  "performance": {
    "lighthouse_score": 95,
    "bundle_size_kb": 120
  }
}
```

### index.tsx Entry Point

```tsx
import { Tenant } from '@prisma/client';

interface TemplateProps {
  tenant: Tenant;
  consultationUrl: string;
  productsUrl: string;
  contactUrl: string;
}

export default function MyTemplate({ 
  tenant, 
  consultationUrl,
  productsUrl,
  contactUrl 
}: TemplateProps) {
  return (
    <div className="template-container">
      {/* Your creative template structure here */}
      <h1>{tenant.businessName}</h1>
      <a href={consultationUrl}>Book Consultation</a>
      {/* ... rest of your design */}
    </div>
  );
}
```

---

## 🎨 Theming Integration

### CSS Variables Approach (Recommended)

```css
:root {
  /* Injected by platform from tenant settings */
  --tenant-primary: #10b981;
  --tenant-secondary: #3b82f6;
  --tenant-accent: #fbbf24;
  --tenant-font-body: 'Inter', sans-serif;
  --tenant-font-heading: 'Playfair Display', serif;
}

.hero {
  background-color: var(--tenant-primary);
  font-family: var(--tenant-font-heading);
}

.cta-button {
  background-color: var(--tenant-primary);
  color: white;
}

.cta-button:hover {
  background-color: color-mix(in srgb, var(--tenant-primary) 80%, black);
}
```

### Inline Styles Approach

```tsx
function Hero({ tenant }: { tenant: Tenant }) {
  return (
    <section 
      style={{ 
        backgroundColor: tenant.primaryColor,
        fontFamily: tenant.fontFamily 
      }}
    >
      <h1 style={{ color: tenant.secondaryColor }}>
        {tenant.businessName}
      </h1>
    </section>
  );
}
```

---

## 🚀 Template Upload Methods

### Method 1: Git Repository (Recommended)

1. Create a public Git repository
2. Structure your template according to specs
3. Tag a release (e.g., `v1.0.0`)
4. In BudStack Super Admin:
   - Go to **Templates** → **Upload from Git**
   - Enter Git URL: `https://github.com/yourname/template.git`
   - Specify branch/tag (optional)
   - Click **Import Template**

### Method 2: ZIP Upload

1. Create a ZIP file with template files
2. In BudStack Super Admin:
   - Go to **Templates** → **Upload ZIP**
   - Select ZIP file
   - Click **Upload Template**

adding a change so its picked up
---

## ✅ Quality Checklist

Before uploading your template, verify:

### Functionality
- [ ] Uses all required tenant meta variables
- [ ] Includes consultation booking CTA
- [ ] All links are functional
- [ ] Template config file is valid JSON

### Design
- [ ] Responsive across mobile, tablet, desktop
- [ ] Works with different content lengths
- [ ] Adapts to all brand colors
- [ ] Typography is readable

### Performance
- [ ] Images are optimized (WebP/AVIF)
- [ ] Lazy loading implemented
- [ ] No layout shift (CLS < 0.1)
- [ ] Fast Time to Interactive (< 3s)

### Accessibility
- [ ] Proper heading hierarchy
- [ ] Alt text for images
- [ ] Color contrast meets WCAG AA
- [ ] Keyboard navigable
- [ ] Screen reader tested

### Code Quality
- [ ] TypeScript types defined
- [ ] No console errors
- [ ] ESLint/Prettier formatted
- [ ] README documentation complete

---

## 📚 Examples

### Example 1: Video Hero Template
See `/examples/video-hero-template/`

### Example 2: Editorial Style Template
See `/examples/editorial-template/`

### Example 3: E-commerce Focus Template
See `/examples/ecommerce-template/`

---

## 🆘 Support

- Documentation: https://docs.budstack.io/templates
- Community: https://community.budstack.io
- Issues: https://github.com/budstack/templates/issues

---

**Last Updated:** November 24, 2025  
**Version:** 2.0.0
