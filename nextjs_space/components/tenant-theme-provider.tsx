"use client";

'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Tenant } from '@/types/client';
import { TenantSettings } from '@/lib/types';

interface TenantThemeProviderProps {
  tenant?: Tenant;
  tenantTemplate?: {
    designSystem?: any;
    customCss?: string | null;
  };
  children: React.ReactNode;
}

/**
 * Scoped Theme Provider for Multi-Tenant Theming
 *
 * This component injects CSS variables into a SCOPED container
 * (not document root) based on tenant branding settings or TenantTemplate.
 * This ensures BudStack.io core pages are NOT affected by tenant themes.
 *
 * Supports BOTH:
 * - NEW: tenantTemplate with designSystem (TenantTemplate)
 * - LEGACY: tenant.settings (Tenant)
 */
export function TenantThemeProvider({
  tenant,
  tenantTemplate,
  children,
}: TenantThemeProviderProps) {
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const settings = tenant ? (tenant.settings as TenantSettings) || {} : {};
  // Prioritize tenantTemplate.designSystem, then settings.designSystem
  const designSystem =
    tenantTemplate?.designSystem || (settings as any).designSystem;
  const customCss = tenantTemplate?.customCss || settings.customCSS;
  const sanitizedCustomCss = useMemo(() => sanitizeCustomCss(customCss), [customCss]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Apply theme to SCOPED container only (not document root)
    if (containerRef.current) {
      applyThemeToContainer(containerRef.current, designSystem, settings);
    }
  }, [settings, designSystem]);

  return (
    <>
      {/* Inject custom CSS if provided */}
      {sanitizedCustomCss && (
        <style dangerouslySetInnerHTML={{ __html: sanitizedCustomCss }} />
      )}

      {/* Apply theme class to scoped container */}
      <div
        ref={containerRef}
        className={`tenant-theme-container theme-force-light ${getTenantThemeClasses(settings)}`}
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
      // 1. Set specific tenant variables using formatColorValue (Example: --tenant-color-primary: hsl(123 45% 67%))
      Object.entries(designSystem.colors).forEach(([key, value]) => {
        if (value) {
          const colorValue = formatColorValue(value as string);
          if (colorValue) {
            root.style.setProperty(
              `--tenant-color-${camelToKebab(key)}`,
              colorValue,
            );
          }
        }
      });

      // 2. Set CORE Tailwind/Shadcn variables using the RAW HSL value if available
      // Shadcn expects variables like --primary: 123 45% 67%; (NO hsl() wrapper)
      // If the value in designSystem is raw HSL, use it directly. If it's hex, we might need conversion (or just use hex if standard css)
      // Assuming designSystem stores valid CSS values. For Shadcn, we really need the HSL channels.

      const primary = designSystem.colors.primary;
      const secondary = designSystem.colors.secondary;
      const accent = designSystem.colors.accent;
      const background = designSystem.colors.background;
      const text = designSystem.colors.text;

      // Helper to strip "hsl(" and ")" if present, or return as is if it looks like raw channels
      const toChannels = (val: string) => {
        if (!val) return null;
        if (val.startsWith("hsl("))
          return val.replace("hsl(", "").replace(")", "");
        return val;
      };

      if (primary)
        root.style.setProperty("--primary", toChannels(primary as string));
      if (secondary)
        root.style.setProperty("--secondary", toChannels(secondary as string));
      if (accent)
        root.style.setProperty("--accent", toChannels(accent as string));
      if (background)
        root.style.setProperty(
          "--background",
          toChannels(background as string),
        );
      // Map text color to foreground
      if (text)
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
    };

    root.style.setProperty(
      "--tenant-font-body",
      fontMap[settings.fontFamily || "inter"] ||
        settings.fontFamily ||
        "'Inter', sans-serif",
    );
    root.style.setProperty(
      "--tenant-font-heading",
      fontMap[settings.headingFontFamily || settings.fontFamily || "inter"] ||
        settings.headingFontFamily ||
        "'Inter', sans-serif",
    );

    // Font size scale
    const fontSizeMap: Record<string, string> = {
      small: "0.875rem",
      medium: "1rem",
      large: "1.125rem",
    };
    root.style.setProperty(
      "--tenant-font-size-base",
      fontSizeMap[settings.fontSize || "medium"],
    );

    // === BORDER RADIUS ===
    const borderRadiusMap: Record<string, string> = {
      none: "0",
      small: "0.25rem",
      medium: "0.5rem",
      large: "1rem",
    };
    root.style.setProperty(
      "--tenant-border-radius",
      borderRadiusMap[settings.borderRadius || "medium"],
    );

    // Button-specific border radius
    const buttonStyleMap: Record<string, string> = {
      rounded: "0.5rem",
      square: "0.25rem",
      pill: "9999px",
    };
    root.style.setProperty(
      "--tenant-button-radius",
      buttonStyleMap[settings.buttonStyle || "rounded"],
    );

    // === SPACING ===
    const spacingMap: Record<string, string> = {
      compact: "0.75",
      normal: "1",
      comfortable: "1.5",
    };
    root.style.setProperty(
      "--tenant-spacing-scale",
      spacingMap[settings.spacing || "normal"],
    );

    // === SHADOWS ===
    const shadowMap: Record<string, string> = {
      none: "none",
      soft: "0 1px 3px 0 rgb(0 0 0 / 0.1)",
      medium: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
      bold: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
    };
    root.style.setProperty(
      "--tenant-shadow",
      shadowMap[settings.shadowStyle || "soft"],
    );

    // === BUTTON SIZE ===
    const buttonSizeMap: Record<string, { padding: string; fontSize: string }> =
      {
        small: { padding: "0.5rem 1rem", fontSize: "0.875rem" },
        medium: { padding: "0.75rem 1.5rem", fontSize: "1rem" },
        large: { padding: "1rem 2rem", fontSize: "1.125rem" },
      };
    const buttonSize = buttonSizeMap[settings.buttonSize || "medium"];
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
 * Format color value to raw HSL values (H S% L%)
 * This is required for shadcn/Tailwind core variables like --background, --foreground
 */
function formatRawHSL(value: string | null | undefined): string {
  if (!value || typeof value !== "string") return "";
  // If it's already an HSL-like string with spaces and %, return it as is
  if (value.includes("%") && !value.includes("(") && !value.includes("#")) {
    return value;
  }
  // For basic hex to HSL conversion if needed, but here we expect the design system to provide raw HSL
  return value;
}

/**
 * Format color value to proper CSS format
 * Converts HSL values like "178 48% 21%" to "hsl(178 48% 21%)"
 * Passes through hex colors and other formats unchanged
 */
function formatColorValue(value: string | null | undefined): string {
  // Handle null/undefined values
  if (!value || typeof value !== "string") {
    return "";
  }

  // Check if it's an HSL value without the hsl() wrapper
  // HSL values typically contain % and spaces but no parentheses
  if (value.includes("%") && !value.includes("(") && !value.includes("#")) {
    // Assume it's in "H S% L%" format used by Tailwind
    return `hsl(${value})`;
  }
  // Return as-is for hex colors, rgb(), hsl(), etc.
  return value;
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
  if (!css) return '';

  return css
    .replace(/@import[^;]+;/gi, '')
    .replace(/url\(([^)]+)\)/gi, '')
    .replace(/expression\(([^)]+)\)/gi, '');
}

function sanitizeCustomCss(css?: string | null): string {
  if (!css) return '';

  return css
    .replace(/@import[^;]+;/gi, '')
    .replace(/url\(([^)]+)\)/gi, '')
    .replace(/expression\(([^)]+)\)/gi, '');
}

function sanitizeCustomCss(css?: string | null): string {
  if (!css) return '';

  return css
    .replace(/@import[^;]+;/gi, '')
    .replace(/url\(([^)]+)\)/gi, '')
    .replace(/expression\(([^)]+)\)/gi, '');
}

function sanitizeCustomCss(css?: string | null): string {
  if (!css) return '';

  return css
    .replace(/@import[^;]+;/gi, '')
    .replace(/url\(([^)]+)\)/gi, '')
    .replace(/expression\(([^)]+)\)/gi, '');
}

function sanitizeCustomCss(css?: string | null): string {
  if (!css) return '';

  return css
    .replace(/@import[^;]+;/gi, '')
    .replace(/url\(([^)]+)\)/gi, '')
    .replace(/expression\(([^)]+)\)/gi, '');
}

function sanitizeCustomCss(css?: string | null): string {
  if (!css) return '';

  return css
    .replace(/@import[^;]+;/gi, '')
    .replace(/url\(([^)]+)\)/gi, '')
    .replace(/expression\(([^)]+)\)/gi, '');
}
