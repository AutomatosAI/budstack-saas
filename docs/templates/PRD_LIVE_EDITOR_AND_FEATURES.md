# Product Requirements Document (PRD): Template System Enhancements & Live Editor

> **Status (2026-05-29):** The Live Editor (ComprehensiveBrandingForm + TemplateRenderer) is shipped and live; sections below are enhancement proposals on top of it.

**Date:** 2026-02-26
**Status:** DRAFT
**Platform:** BudStack SaaS
**Target Audience:** Tenant Admins (Dispensary Owners, Store Managers)

---

## 1. Executive Summary
This PRD outlines the architecture and functionality of the newly introduced **BudStack Live Editor** (a pure data-driven rendering pipeline) and proposes a suite of high-impact features to elevate the storefront design capabilities for tenants. Because the BudStack template engine has migrated from legacy React components to a JSON/data-only architecture, these new features can be deployed globally without requiring tenants to upgrade their templates or triggering platform rebuilds.

The goal is to provide non-technical store owners with premium, consumer-grade customization options (Glassmorphism, Scroll Animations, Dynamic Dividers) that immediately differentiate their brand, while maintaining strict guardrails to prevent them from breaking their storefronts.

---

## 2. Current Architecture: The Live Editor (Baseline)

Before defining enhancements, it is critical to outline how the current Live Editor functions. The Live Editor is the intersection of the `ComprehensiveBrandingForm` and the `TemplateRenderer`.

### 2.1 The Data-Driven Model
The template engine relies on four files stored in S3 (`layout.json`, `defaults.json`, `styles.css`, `template.config.json`) and a database record (`TenantTemplate`).
- **No React Code:** Templates contain zero structural logic.
- **Section Registry:** The core SaaS platform maintains a central repository of 50 pre-built React components (13 heroes, 24 content, 4 CTAs, 6 nav, 3 footers) (`HeroFullScreen`, `ValueProps`, `NavDark`, etc.).
- **Dynamic Composition:** At runtime, the `TemplateRenderer` loops through `layout.json` and dynamically mounts the corresponding React components from the registry.

### 2.2 The Live Editor Workflow
When a tenant uses the Live Editor (`/tenant-admin/branding`):
1. **Form State:** The `ComprehensiveBrandingForm` presents an intuitive GUI divided into tabs (Business, Hours, Footer, Design, Home, About, etc.).
2. **Database Mutation:** Upon saving, the form serializes the user's choices into the `TenantTemplate.designSystem`, `pageContent`, and `businessInfo` JSON columns in PostgreSQL.
3. **CSS Variable Sandbox:** The `TenantThemeProvider` intercepts the `designSystem` JSON and injects raw HSL colors and typography tokens as scoped CSS variables (e.g., `--tenant-color-primary: 155 70% 35%;`) onto a `.template-{slug}` wrapper `div`.
4. **Hot-Reload:** The storefront instantly reflects these changes. If the tenant updates a color or changes the Hero text, the `TemplateRenderer` and `TenantThemeProvider` instantly digest the database changes without a Next.js rebuild.

---

## 3. Proposed Enhancements (Phase 1)

These features build directly upon the existing Live Editor architecture, requiring updates primarily to the `BrandingForm`, the `TenantThemeProvider`, and the `Section Registry` components.

### Feature 1: "Glassmorphism" & Blur Tokens (Premium Modern Aesthetic)
**Problem:** Currently, components rely on solid background colors or opacity, which can look flat.
**Solution:** Provide a "Glass Effect" toggle for modern, premium brands.
- **Form UI:** Add a "Component Style" selector in the Design tab (Solid vs. Frosted Glass).
- **Implementation:** 
  - Save as `designSystem.glassEffect` (boolean or intensity level).
  - `TenantThemeProvider` injects `--tenant-backdrop-blur: 12px;` and `--tenant-card-bg-opacity: 0.7;`.
  - Update `Section Registry` components (Navigations, Cards, Modals) to use Tailwind's `backdrop-blur-[var(--tenant-backdrop-blur)]` and `bg-background/[var(--tenant-card-bg-opacity)]`.
- **Value:** Instantly modernizes the UI, especially effective over video heroes or gradient backgrounds.

### Feature 2: Scroll Animations & Reveal Effects
**Problem:** Storefronts feel static. Adding custom animations previously required writing React code.
**Solution:** Leverage the existing `framer-motion` dependency to create zero-code scroll animations.
- **Form UI:** Add an "Animation Style" dropdown in the Design tab (Options: None, Fade Up, Slide In, Reveal).
- **Implementation:**
  - Save as `designSystem.animationType`.
  - Update `TemplateRenderer` or individual `Section` components to wrap their children in a `<motion.div>`.
  - The `<motion.div>` reads the `animationType` prop and triggers `whileInView` animations based on the selection.
- **Value:** High-end, dynamic feel that guides the user down the page.

### Feature 3: SVG Section Dividers (Breaking the Grid)
**Problem:** Sections vertically stack with straight horizontal lines, feeling blocky and amateur.
**Solution:** Allow fluid, organic transitions between sections.
- **Form UI:** Add a "Section Dividers" option (Straight, Waves, Slants, Curves).
- **Implementation:**
  - Save preference in `designSystem.dividerStyle`.
  - The `TemplateRenderer` inspects adjacent sections in the `layout.json` loop.
  - If a divider is selected, it injects a lightweight SVG shape between `<section>` tags, filling the SVG with the `backgroundColor` of the subsequent section to create a seamless blend.
- **Value:** Organic layouts popular in modern wellness, health, and cannabis branding.

### Feature 4: Interactive Image Hotspots & Micro-Animations (Explaining the Science)
**Problem:** Medical cannabis requires education. Patients need to understand terpenes, delivery methods, and strain effects, but long blocks of text are intimidating.
**Solution:** Allow tenants to upload a product/plant image and click to add interactive "hotspot" pulsing dots.
- **Form UI:** New "Education" tab in the Live Editor. The tenant uploads an image, clicks on it to drop pins, and writes a short tooltip (e.g., "Pin 1: High CBD Content for inflammation").
- **Implementation:**
  - Create an `InteractiveImage` component.
  - Save the X/Y coordinates and tooltip text to an array in `pageContent.education.hotspots`.
  - The component renders the image relative with absolute positioned pulsing `<motion.div>` dots. On hover/tap, a beautiful glassmorphic tooltip appears.
- **Value:** Extremely premium, interactive storytelling that makes the clinic feel high-end, educational, and trustworthy.

### Feature 5: Advanced Hero Configurations
**Problem:** Tenants struggle with text legibility if they upload a complex hero image or video.
**Solution:** Give tenants control over text contrast and alignment.
- **Form UI:** In the "Home" tab, under Hero Image, add toggles for "Text Alignment" (Left/Center/Right) and "Overlay Style" (Dark Gradient / Light Gradient / None).
- **Implementation:**
  - Save to `pageContent.home.heroAlignment` and `heroOverlay`.
  - Update `HeroFullScreen` and `HeroVideo` components to conditionally apply Tailwind gradient overlay classes and text alignment classes based on these props.
- **Value:** Ensures professional aesthetics and accessibility regardless of the user's asset quality.

---

## 4. Technical Implementation Scope

### 4.1 Required Changes (Backend / Database)
- **None.** Because the `TenantSettings` and `TenantTemplate.designSystem` use JSON/JSONB columns, we can add new keys (`glassEffect`, `animationType`) without running database migrations.

### 4.2 Required Changes (Frontend)
1. **`ComprehensiveBrandingForm.tsx`**: Add the necessary UI inputs (Selects, Switches) for the new features. Update the `handleSubmit` payload to include the new keys in the `settingsData` object.
2. **`tenant-theme-provider.tsx`**: Add logic to map the new `designSystem` keys to CSS variables if they require global scoping (like blur tokens).
3. **`Section Registry` Components**: Update the React components in `components/sections/` to read the new props passed down from the renderer and apply the appropriate Tailwind classes or Framer Motion properties.

## 5. Success Metrics
- **Tenant Adoption:** % of active tenants enabling Glassmorphism or Animations within 30 days of release.
- **Time to Value:** Reduction in support tickets related to "how do I make my site look better" or "how do I add an age gate."
- **Performance:** Ensure Lighthouse scores remain >90; verify that SVG dividers and `backdrop-blur` do not introduce significant rendering lag on mid-tier mobile devices.
