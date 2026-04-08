"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Tenant } from "@/types/client";
import { TenantSettings } from "@/lib/types";
import { sanitizeCss } from "@/lib/css-utils";

interface TenantThemeProviderProps {
  tenant?: Tenant;
  tenantTemplate?: {
    designSystem?: any;
    customCss?: string | null;
  };
  googleFontsUrl?: string | null;
  children: React.ReactNode;
}

/**
 * Scoped Theme Provider for Multi-Tenant Theming
 *
 * This component injects CSS variables into a SCOPED container
 * (not document root) based on tenant branding settings or TenantTemplate.
 * This ensures BudStacks.io core pages are NOT affected by tenant themes.
 *
 * Supports BOTH:
 * - NEW: tenantTemplate with designSystem (TenantTemplate)
 * - LEGACY: tenant.settings (Tenant)
 */
export function TenantThemeProvider({
  tenant,
  tenantTemplate,
  googleFontsUrl,
  children,
}: TenantThemeProviderProps) {
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const settings = tenant ? (tenant.settings as TenantSettings) || {} : {};
  // Prioritize tenantTemplate.designSystem, then settings.designSystem
  const designSystem =
    tenantTemplate?.designSystem || (settings as any).designSystem;
  const customCss = tenantTemplate?.customCss || settings.customCSS;
  const sanitizedCustomCss = useMemo(
    () => sanitizeCss(customCss),
    [customCss],
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Apply theme to SCOPED container only (not document root)
    if (containerRef.current) {
      applyThemeToContainer(containerRef.current, designSystem, settings);
    }
  }, [settings, designSystem]);

  // Build data-attributes for conditional CSS effects
  const hoverEffect = designSystem?.buttonHoverEffect || settings.buttonHoverEffect || "none";
  const glassEffectVal = designSystem?.glassEffect || settings.glassEffect || "none";

  // Auto-generate Google Fonts URL from designSystem font IDs when no explicit URL is provided
  const fontIdToGoogleName: Record<string, string> = {
    inter: "Inter", roboto: "Roboto", lato: "Lato", montserrat: "Montserrat",
    poppins: "Poppins", outfit: "Outfit", nunito: "Nunito",
    "open-sans": "Open+Sans", raleway: "Raleway", "work-sans": "Work+Sans",
    "dm-sans": "DM+Sans", "source-sans-3": "Source+Sans+3", manrope: "Manrope",
    "space-grotesk": "Space+Grotesk", "plus-jakarta-sans": "Plus+Jakarta+Sans",
    sora: "Sora", urbanist: "Urbanist", figtree: "Figtree",
    playfair: "Playfair+Display", merriweather: "Merriweather", lora: "Lora",
    "dm-serif-display": "DM+Serif+Display", "cormorant-garamond": "Cormorant+Garamond",
    "libre-baskerville": "Libre+Baskerville", "eb-garamond": "EB+Garamond",
    "crimson-text": "Crimson+Text", bitter: "Bitter",
    oswald: "Oswald", "bebas-neue": "Bebas+Neue", antonio: "Antonio", righteous: "Righteous",
  };
  const autoFontsUrl = useMemo(() => {
    if (googleFontsUrl) return null; // explicit URL takes precedence
    const dsTypo = designSystem?.typography?.fontFamily;
    const bodyId = dsTypo?.body || dsTypo?.base || (settings as any).fontFamily;
    const headingId = dsTypo?.heading || (settings as any).headingFontFamily;
    const ids = new Set<string>();
    if (bodyId && fontIdToGoogleName[bodyId]) ids.add(bodyId);
    if (headingId && headingId !== "same" && fontIdToGoogleName[headingId]) ids.add(headingId);
    if (ids.size === 0) return null;
    const families = Array.from(ids).map(
      (id) => `family=${fontIdToGoogleName[id]}:wght@300;400;500;600;700;800`,
    );
    return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
  }, [googleFontsUrl, designSystem, settings]);

  return (
    <>
      {/* Load Google Fonts at runtime */}
      {(googleFontsUrl || autoFontsUrl) && (
        <link href={googleFontsUrl || autoFontsUrl!} rel="stylesheet" />
      )}

      {/* Scoped design system CSS — static rules that read CSS variables set by applyThemeToContainer.
          TENANT_SCOPED_CSS is a compile-time constant (not user input), safe for injection. */}
      <style dangerouslySetInnerHTML={{ __html: TENANT_SCOPED_CSS }} />

      {/* Inject custom CSS if provided */}
      {/* Must use dangerouslySetInnerHTML — React escapes > to \u003e breaking CSS child combinators */}
      {sanitizedCustomCss && (
        <style dangerouslySetInnerHTML={{ __html: sanitizedCustomCss }} />
      )}

      {/* Apply theme class to scoped container */}
      <div
        ref={containerRef}
        className={`tenant-theme-container ${getTenantThemeClasses(settings)}`}
        data-hover={hoverEffect}
        data-glass={glassEffectVal}
        style={{ minHeight: "100vh" }}
      >
        {children}
      </div>
    </>
  );
}

/**
 * Static CSS rules that consume the --tenant-* CSS variables.
 * This is the bridge between "variables are set" and "components actually use them".
 * Scoped to .tenant-theme-container so editor UI is unaffected.
 */
const TENANT_SCOPED_CSS = `
/* === TYPOGRAPHY === */
.tenant-theme-container {
  font-family: var(--tenant-font-body);
  font-weight: var(--tenant-font-weight);
  letter-spacing: var(--tenant-letter-spacing);
  font-size: var(--tenant-font-size-base);
}
.tenant-theme-container h1,
.tenant-theme-container h2,
.tenant-theme-container h3,
.tenant-theme-container h4,
.tenant-theme-container h5,
.tenant-theme-container h6 {
  font-family: var(--tenant-font-heading);
  font-weight: var(--tenant-font-weight-heading);
}
.tenant-theme-container h1 { font-size: calc(2.25rem * var(--tenant-hero-scale, 1)); }
.tenant-theme-container h2 { font-size: calc(1.875rem * var(--tenant-section-heading-scale, 1)); }
.tenant-theme-container h3 { font-size: calc(1.5rem * var(--tenant-section-heading-scale, 1)); }
.tenant-theme-container h4 { font-size: calc(1.25rem * var(--tenant-section-heading-scale, 1)); }
.tenant-theme-container h5 { font-size: calc(1.125rem * var(--tenant-section-heading-scale, 1)); }
.tenant-theme-container h6 { font-size: calc(1rem * var(--tenant-section-heading-scale, 1)); }

/* === BUTTONS (CTA-style within sections) === */
/* Only target inline CTA links (with bg color), not card wrappers that use rounded + overflow-hidden */
.tenant-theme-container section button[class*="bg-"],
.tenant-theme-container section a[class*="bg-"] {
  border-radius: var(--tenant-button-radius) !important;
  padding: var(--tenant-button-padding);
  font-size: var(--tenant-button-font-size);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

/* === BUTTON HOVER EFFECTS === */
.tenant-theme-container[data-hover="lift"] section a[class*="bg-"]:hover,
.tenant-theme-container[data-hover="lift"] section button[class*="bg-"]:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgb(0 0 0 / 0.18);
}
.tenant-theme-container[data-hover="glow"] section a[class*="bg-"]:hover,
.tenant-theme-container[data-hover="glow"] section button[class*="bg-"]:hover {
  box-shadow: 0 0 28px hsl(var(--primary) / 0.4);
}
.tenant-theme-container[data-hover="scale"] section a[class*="bg-"]:hover,
.tenant-theme-container[data-hover="scale"] section button[class*="bg-"]:hover {
  transform: scale(1.06);
}
.tenant-theme-container[data-hover="pulse"] section a[class*="bg-"]:hover,
.tenant-theme-container[data-hover="pulse"] section button[class*="bg-"]:hover {
  animation: tenant-pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@keyframes tenant-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.75; }
}

/* === CARDS — border radius + shadows === */
.tenant-theme-container section div[class*="rounded-lg"],
.tenant-theme-container section div[class*="rounded-xl"],
.tenant-theme-container section div[class*="rounded-2xl"] {
  border-radius: var(--tenant-border-radius);
}
.tenant-theme-container section div[class*="shadow-sm"],
.tenant-theme-container section div[class*="shadow-md"],
.tenant-theme-container section div[class*="shadow-lg"],
.tenant-theme-container section div[class*="shadow-xl"] {
  box-shadow: var(--tenant-shadow);
}

/* === GLASS EFFECT — frosted glass on cards within sections === */
.tenant-theme-container[data-glass="light"] section div[class*="rounded"][class*="border"],
.tenant-theme-container[data-glass="light"] section div[class*="rounded"][class*="bg-white"],
.tenant-theme-container[data-glass="light"] section div[class*="rounded"][class*="bg-card"] {
  backdrop-filter: blur(var(--tenant-backdrop-blur));
  -webkit-backdrop-filter: blur(var(--tenant-backdrop-blur));
  background: rgba(255, 255, 255, 0.7) !important;
  border: 1px solid rgba(255, 255, 255, 0.3);
}
.tenant-theme-container[data-glass="heavy"] section div[class*="rounded"][class*="border"],
.tenant-theme-container[data-glass="heavy"] section div[class*="rounded"][class*="bg-white"],
.tenant-theme-container[data-glass="heavy"] section div[class*="rounded"][class*="bg-card"] {
  backdrop-filter: blur(var(--tenant-backdrop-blur));
  -webkit-backdrop-filter: blur(var(--tenant-backdrop-blur));
  background: rgba(255, 255, 255, 0.45) !important;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* === SECTION SPACING SCALE === */
.tenant-theme-container section > div[class*="py-"],
.tenant-theme-container section > section[class*="py-"] {
  padding-top: calc(3rem * var(--tenant-spacing-scale, 1));
  padding-bottom: calc(3rem * var(--tenant-spacing-scale, 1));
}
@media (min-width: 768px) {
  .tenant-theme-container section > div[class*="py-"],
  .tenant-theme-container section > section[class*="py-"] {
    padding-top: calc(4rem * var(--tenant-spacing-scale, 1));
    padding-bottom: calc(4rem * var(--tenant-spacing-scale, 1));
  }
}
`;

/**
 * Apply theme CSS variables to SCOPED container (not document root)
 */
function applyThemeToContainer(
  container: HTMLElement,
  designSystem: any,
  settings: TenantSettings,
) {
  const root = container;

  // === COMPREHENSIVE DESIGN SYSTEM ===
  if (designSystem) {
    // Apply colors
    if (designSystem.colors) {
      // 1. Set specific tenant variables using formatColorValue
      // Skip nested objects (color scales like sage.50, teal.100, etc.)
      Object.entries(designSystem.colors).forEach(([key, value]) => {
        if (value && typeof value === 'string' && value.trim() !== '') {
          const colorValue = formatColorValue(value);
          if (colorValue && colorValue.trim() !== '') {
            root.style.setProperty(
              `--tenant-color-${camelToKebab(key)}`,
              colorValue,
            );
          }
        }
      });

      // 2. Set CORE Tailwind/Shadcn variables using the RAW HSL value if available
      const primary = designSystem.colors.primary;
      const secondary = designSystem.colors.secondary;
      const accent = designSystem.colors.accent;
      const background = designSystem.colors.background;
      const text = designSystem.colors.text;

      // Helper to strip "hsl(" and ")" if present
      const toChannels = (val: string) => {
        if (!val) return null;
        if (val.startsWith("hsl("))
          return val.replace("hsl(", "").replace(")", "");
        return val;
      };

      if (primary && (primary as string).trim())
        root.style.setProperty("--primary", toChannels(primary as string));
      if (secondary && (secondary as string).trim())
        root.style.setProperty("--secondary", toChannels(secondary as string));
      if (accent && (accent as string).trim())
        root.style.setProperty("--accent", toChannels(accent as string));
      if (background && (background as string).trim())
        root.style.setProperty(
          "--background",
          toChannels(background as string),
        );
      // Map text color to foreground
      if (text && (text as string).trim())
        root.style.setProperty("--foreground", toChannels(text as string));
    }

    // === TYPOGRAPHY ===
    const fontMap: Record<string, string> = {
      // Sans-serif
      inter: "'Inter', sans-serif",
      roboto: "'Roboto', sans-serif",
      lato: "'Lato', sans-serif",
      montserrat: "'Montserrat', sans-serif",
      poppins: "'Poppins', sans-serif",
      outfit: "'Outfit', sans-serif",
      nunito: "'Nunito', sans-serif",
      "open-sans": "'Open Sans', sans-serif",
      raleway: "'Raleway', sans-serif",
      "work-sans": "'Work Sans', sans-serif",
      "dm-sans": "'DM Sans', sans-serif",
      "source-sans-3": "'Source Sans 3', sans-serif",
      manrope: "'Manrope', sans-serif",
      "space-grotesk": "'Space Grotesk', sans-serif",
      "plus-jakarta-sans": "'Plus Jakarta Sans', sans-serif",
      sora: "'Sora', sans-serif",
      urbanist: "'Urbanist', sans-serif",
      figtree: "'Figtree', sans-serif",
      // Serif
      playfair: "'Playfair Display', serif",
      merriweather: "'Merriweather', serif",
      lora: "'Lora', serif",
      "dm-serif-display": "'DM Serif Display', serif",
      "cormorant-garamond": "'Cormorant Garamond', serif",
      "libre-baskerville": "'Libre Baskerville', serif",
      "eb-garamond": "'EB Garamond', serif",
      "crimson-text": "'Crimson Text', serif",
      bitter: "'Bitter', serif",
      // Display
      oswald: "'Oswald', sans-serif",
      "bebas-neue": "'Bebas Neue', sans-serif",
      antonio: "'Antonio', sans-serif",
      righteous: "'Righteous', sans-serif",
    };

    // === TYPOGRAPHY ===
    // Read from designSystem first (branding form saves here), fall back to legacy settings
    const dsTypo = designSystem.typography?.fontFamily;
    const dsFontBody = dsTypo?.body || dsTypo?.base;
    const dsFontHeading = dsTypo?.heading;

    // Resolve: full CSS string passes through, short IDs get mapped
    const resolveFont = (val: string | undefined, fallbackId: string) => {
      if (!val) return fontMap[fallbackId] || "'Inter', sans-serif";
      // Already a full CSS font-family string (contains comma or quote)
      if (val.includes(",") || val.includes("'")) return val;
      // Short ID — look up in map
      return fontMap[val] || val;
    };

    const bodyFont = resolveFont(dsFontBody, settings.fontFamily || "inter");
    const headingFont = resolveFont(dsFontHeading, settings.headingFontFamily || settings.fontFamily || "inter");

    root.style.setProperty("--tenant-font-body", bodyFont);
    root.style.setProperty("--tenant-font-heading", headingFont);

    // Font weight
    const fontWeightMap: Record<string, string> = { "300": "300", "400": "400", "500": "500", "700": "700" };
    const headingWeightMap: Record<string, string> = { "400": "400", "500": "500", "600": "600", "700": "700", "800": "800" };
    const dsFontWeight = designSystem.typography?.fontWeight?.body;
    const dsHeadingWeight = designSystem.typography?.fontWeight?.heading;
    root.style.setProperty(
      "--tenant-font-weight",
      fontWeightMap[dsFontWeight] || fontWeightMap[settings.fontWeight || "400"] || "400",
    );
    root.style.setProperty(
      "--tenant-font-weight-heading",
      headingWeightMap[dsHeadingWeight] || headingWeightMap[settings.headingFontWeight || "700"] || "700",
    );

    // Letter spacing
    const letterSpacingMap: Record<string, string> = {
      tight: "-0.025em",
      normal: "0",
      wide: "0.025em",
      wider: "0.05em",
    };
    const dsLetterSpacing = designSystem.typography?.letterSpacing;
    root.style.setProperty(
      "--tenant-letter-spacing",
      letterSpacingMap[dsLetterSpacing] || letterSpacingMap[settings.letterSpacingPreset || "normal"] || "0",
    );

    // Font size — accepts px number (e.g. "16") or legacy preset (small/medium/large)
    const fontSizePresetMap: Record<string, string> = { small: "14", medium: "16", large: "18" };
    const dsFontSize = designSystem.typography?.fontSize?.base;
    const rawBodySize = dsFontSize || settings.fontSize || "16";
    const bodyPx = fontSizePresetMap[rawBodySize] || (isNaN(Number(rawBodySize)) ? "16" : rawBodySize);
    root.style.setProperty("--tenant-font-size-base", `${bodyPx}px`);

    // Hero title size (h1) — accepts px number or legacy preset
    const heroPresetMap: Record<string, string> = { small: "30", medium: "36", large: "42", xlarge: "48" };
    const dsHeroFontSize = designSystem.typography?.fontSize?.hero || designSystem.typography?.fontSize?.heading;
    const rawHeroSize = dsHeroFontSize || settings.heroFontSize || settings.headingFontSize || "36";
    const heroPx = heroPresetMap[rawHeroSize] || (isNaN(Number(rawHeroSize)) ? "36" : rawHeroSize);
    root.style.setProperty("--tenant-hero-scale", String(Number(heroPx) / 36));

    // Section heading size (h2–h6) — independent from hero
    const sectionPresetMap: Record<string, string> = { small: "24", medium: "30", large: "36", xlarge: "42" };
    const dsSectionFontSize = designSystem.typography?.fontSize?.section;
    const rawSectionSize = dsSectionFontSize || settings.sectionFontSize || "30";
    const sectionPx = sectionPresetMap[rawSectionSize] || (isNaN(Number(rawSectionSize)) ? "30" : rawSectionSize);
    root.style.setProperty("--tenant-section-heading-scale", String(Number(sectionPx) / 30));

    // === BORDER RADIUS ===
    const borderRadiusMap: Record<string, string> = {
      none: "0",
      small: "0.25rem",
      medium: "0.5rem",
      large: "1rem",
    };
    const dsBorderRadius = designSystem.borderRadius?.container;
    root.style.setProperty(
      "--tenant-border-radius",
      borderRadiusMap[dsBorderRadius] || borderRadiusMap[settings.borderRadius || "medium"] || "0.5rem",
    );

    // Button-specific border radius
    const buttonStyleMap: Record<string, string> = {
      rounded: "0.5rem",
      square: "0.25rem",
      pill: "9999px",
    };
    const dsButtonStyle = designSystem.borderRadius?.button;
    root.style.setProperty(
      "--tenant-button-radius",
      buttonStyleMap[dsButtonStyle] || buttonStyleMap[settings.buttonStyle || "rounded"] || "0.5rem",
    );

    // === SPACING ===
    const spacingMap: Record<string, string> = {
      compact: "0.75",
      normal: "1",
      comfortable: "1.5",
    };
    const dsSpacing = designSystem.spacing?.scale;
    root.style.setProperty(
      "--tenant-spacing-scale",
      spacingMap[dsSpacing] || spacingMap[settings.spacing || "normal"] || "1",
    );

    // === SHADOWS ===
    const shadowMap: Record<string, string> = {
      none: "none",
      soft: "0 1px 3px 0 rgb(0 0 0 / 0.1)",
      medium: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
      bold: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
    };
    const dsShadow = designSystem.shadows?.card;
    root.style.setProperty(
      "--tenant-shadow",
      shadowMap[dsShadow] || shadowMap[settings.shadowStyle || "soft"] || "0 1px 3px 0 rgb(0 0 0 / 0.1)",
    );

    // === GLASS EFFECT ===
    const glassMap: Record<string, { blur: string, opacity: string }> = {
      none: { blur: "0px", opacity: "1" },
      light: { blur: "8px", opacity: "0.8" },
      heavy: { blur: "16px", opacity: "0.6" },
    };
    const dsGlass = designSystem.glassEffect;
    const glassConfig = glassMap[dsGlass] || glassMap[settings.glassEffect || "none"] || glassMap["none"];
    root.style.setProperty("--tenant-backdrop-blur", glassConfig.blur);
    root.style.setProperty("--tenant-card-opacity", glassConfig.opacity);


    // === BUTTON SIZE ===
    const buttonSizeMap: Record<string, { padding: string; fontSize: string }> =
    {
      small: { padding: "0.5rem 1rem", fontSize: "0.875rem" },
      medium: { padding: "0.75rem 1.5rem", fontSize: "1rem" },
      large: { padding: "1rem 2rem", fontSize: "1.125rem" },
    };
    const dsButtonSize = designSystem.button?.size;
    const buttonSize = buttonSizeMap[dsButtonSize] || buttonSizeMap[settings.buttonSize || "medium"] || buttonSizeMap["medium"];
    root.style.setProperty("--tenant-button-padding", buttonSize.padding);
    root.style.setProperty("--tenant-button-font-size", buttonSize.fontSize);

    // === BUTTON HOVER EFFECT ===
    // Consumed via data-hover attribute on container, CSS rules defined in TENANT_SCOPED_CSS
    const hoverEffect = designSystem.buttonHoverEffect || (settings as any).buttonHoverEffect || "none";
    root.setAttribute("data-hover", hoverEffect);

    // === GLASS EFFECT (data-attr for CSS) ===
    const glass = designSystem.glassEffect || settings.glassEffect || "none";
    root.setAttribute("data-glass", glass);
  }
}

/**
 * Convert camelCase to kebab-case
 */
function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Format color value to RAW HSL channels for CSS variables.
 * Components wrap with hsl(): `hsl(var(--tenant-color-primary))`
 * So variables MUST store raw channels: `178 48% 21%`
 * If we stored `hsl(178 48% 21%)`, components would produce `hsl(hsl(...))` = INVALID.
 * If we stored `#ffffff`, components would produce `hsl(#ffffff)` = INVALID.
 */
function formatColorValue(value: string | null | undefined): string {
  if (!value || typeof value !== "string") {
    return "";
  }

  // Strip hsl() wrapper if present — we need raw channels only
  if (value.startsWith("hsl(") && value.endsWith(")")) {
    return value.slice(4, -1).trim();
  }

  // Raw HSL channels like "178 48% 21%" — pass through
  if (value.includes("%") && !value.includes("(") && !value.includes("#")) {
    return value;
  }

  // Convert hex to HSL channels (prevents invalid `hsl(#hex)` in templates)
  if (value.startsWith("#")) {
    return hexToHslChannels(value);
  }

  return value;
}

/**
 * Convert hex color (#rrggbb or #rgb) to raw HSL channel string "H S% L%"
 */
function hexToHslChannels(hex: string): string {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  } else {
    return "";
  }

  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Get Tailwind classes for tenant theme
 */
function getTenantThemeClasses(settings: TenantSettings): string {
  const classes: string[] = [];

  // Template classes
  if (settings.template) {
    classes.push(`template-${settings.template}`);
  }

  return classes.join(" ");
}

