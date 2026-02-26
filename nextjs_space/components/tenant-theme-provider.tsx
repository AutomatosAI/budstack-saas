"use client";

import { useEffect, useMemo, useRef } from "react";
import { Tenant } from "@/types/client";
import { TenantSettings } from "@/lib/types";

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
    () => sanitizeCustomCss(customCss),
    [customCss],
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Apply theme to SCOPED container only (not document root)
    if (containerRef.current) {
      applyThemeToContainer(containerRef.current, designSystem, settings);
    }
  }, [settings, designSystem]);

  return (
    <>
      {/* Load Google Fonts at runtime */}
      {googleFontsUrl && (
        <link href={googleFontsUrl} rel="stylesheet" />
      )}

      {/* Inject custom CSS if provided */}
      {/* Must use dangerouslySetInnerHTML — React escapes > to \u003e breaking CSS child combinators */}
      {sanitizedCustomCss && (
        <style dangerouslySetInnerHTML={{ __html: sanitizedCustomCss }} />
      )}

      {/* Apply theme class to scoped container */}
      <div
        ref={containerRef}
        className={`tenant-theme-container ${getTenantThemeClasses(settings)}`}
        style={{ minHeight: "100vh" }}
      >
        {children}
      </div>
    </>
  );
}

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
      inter: "'Inter', sans-serif",
      playfair: "'Playfair Display', serif",
      roboto: "'Roboto', sans-serif",
      montserrat: "'Montserrat', sans-serif",
      lato: "'Lato', sans-serif",
      poppins: "'Poppins', sans-serif",
      outfit: "'Outfit', sans-serif",
      nunito: "'Nunito', sans-serif",
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

    // Font size scale — designSystem.typography.fontSize.base OR settings.fontSize
    const fontSizeMap: Record<string, string> = {
      small: "0.875rem",
      medium: "1rem",
      large: "1.125rem",
    };
    const dsFontSize = designSystem.typography?.fontSize?.base;
    root.style.setProperty(
      "--tenant-font-size-base",
      fontSizeMap[dsFontSize] || fontSizeMap[settings.fontSize || "medium"] || "1rem",
    );

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

function sanitizeCustomCss(css?: string | null): string {
  if (!css) return "";

  return css
    .replace(/@import[^;]+;/gi, "")
    .replace(/url\([^)]+\)/gi, "")
    .replace(/expression\([^)]+\)/gi, "");
}
