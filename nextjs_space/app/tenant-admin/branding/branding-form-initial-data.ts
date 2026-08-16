import { hslToHex } from "@/lib/color-utils";
import {
  DEFAULT_NAV_LINKS,
  DEFAULT_FOOTER_SECTIONS,
} from "@/lib/templates/section-schemas";
import type { tenant_templates } from "@prisma/client";
import type { TenantSettings } from "@/lib/types";
import type { EditorFormData } from "./tabs/types";

// --- Constants ---

const FONTS_MAP: Record<string, boolean> = {
  inter: true, roboto: true, lato: true, montserrat: true,
  poppins: true, playfair: true, outfit: true, nunito: true,
};

const FONT_NAMES: Record<string, string> = {
  inter: "Inter", roboto: "Roboto", lato: "Lato", montserrat: "Montserrat",
  poppins: "Poppins", playfair: "Playfair Display", outfit: "Outfit", nunito: "Nunito",
};

function resolveFontId(cssValue: string | undefined): string | undefined {
  if (!cssValue) return undefined;
  if (!cssValue.includes(",") && !cssValue.includes("'")) {
    return FONTS_MAP[cssValue] ? cssValue : undefined;
  }
  const first = cssValue.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
  const entry = Object.entries(FONT_NAMES).find(
    ([, name]) => name.toLowerCase() === first.toLowerCase(),
  );
  return entry?.[0];
}

function matchOption(value: any, options: string[]): string | undefined {
  if (!value || typeof value !== "string") return undefined;
  return options.includes(value) ? value : undefined;
}

// Convert legacy preset names to px values
const FONT_SIZE_TO_PX: Record<string, string> = { small: "14", medium: "16", large: "18" };
const HERO_SIZE_TO_PX: Record<string, string> = { small: "30", medium: "36", large: "42", xlarge: "48" };
const SECTION_SIZE_TO_PX: Record<string, string> = { small: "24", medium: "30", large: "36", xlarge: "42" };

const BUTTON_STYLES = ["rounded", "square", "pill"];
const BORDER_RADII = ["none", "small", "medium", "large"];
const SPACINGS = ["compact", "normal", "comfortable"];
const SHADOW_STYLES = ["none", "soft", "medium", "bold"];
/**
 * The four tokens the Type tab's Letter Spacing select offers, and the four keys
 * `tenant-theme-provider`'s `letterSpacingMap` resolves. A design system stores
 * the CHOSEN one of these under `typography.letterSpacing`, not the map of all
 * of them — see the note on `letterSpacingPreset` below for why that distinction
 * had teeth.
 */
const LETTER_SPACINGS = ["tight", "normal", "wide", "wider"];

interface InitialFormDataTenant {
  businessName: string;
  settings: unknown;
}

export function buildInitialFormData(
  tenant: InitialFormDataTenant,
  activeTemplate?: tenant_templates | null,
): EditorFormData {
  const settings = (tenant.settings as TenantSettings) || {};

  const getVal = (path: string[], fallback: any) => {
    if (activeTemplate?.designSystem) {
      let current: any = activeTemplate.designSystem;
      for (const key of path) {
        if (current?.[key] === undefined) return fallback;
        current = current[key];
      }
      return current;
    }
    return fallback;
  };

  const templateContent = (activeTemplate?.pageContent as any) || {};
  const settingsContent = (settings.pageContent as any) || {};

  // Parse initial layout sections
  const initialSectionConfigs: Record<string, Record<string, any>> = {};
  const initialLayoutSections: any[] = [];
  const initialColorOverrides: Record<string, Record<string, string>> = {};
  if ((activeTemplate as any)?.layout?.sections) {
    ((activeTemplate as any).layout.sections as any[]).forEach((section: any, index: number) => {
      const sectionId = section.id || `section-${index}`;
      initialLayoutSections.push({ ...section, id: sectionId });
      if (section.config) {
        initialSectionConfigs[sectionId] = { ...section.config };
      }
      // Initialize color overrides from stored layout (hex values)
      if (section.colorOverrides) {
        initialColorOverrides[sectionId] = { ...section.colorOverrides };
      }
    });
  }

  return {
    sectionConfigs: initialSectionConfigs,
    layoutSections: initialLayoutSections,

    businessName: tenant.businessName,
    tagline: settings.tagline || "",

    primaryColor: hslToHex(getVal(["colors", "primary"], null), settings.primaryColor || "#059669"),
    secondaryColor: hslToHex(getVal(["colors", "secondary"], null), settings.secondaryColor || "#34d399"),
    accentColor: hslToHex(getVal(["colors", "accent"], null), settings.accentColor || "#10b981"),
    backgroundColor: hslToHex(getVal(["colors", "background"], null), settings.backgroundColor || "#ffffff"),
    textColor: hslToHex(getVal(["colors", "text"], null), settings.textColor || "#1f2937"),
    headingColor: hslToHex(getVal(["colors", "heading"], null), settings.headingColor || "#111827"),

    sectionColorOverrides: initialColorOverrides,

    navColorOverrides: (activeTemplate as any)?.layout?.navigationConfig?.colorOverrides || {},
    footerColorOverrides: (activeTemplate as any)?.layout?.footerConfig?.colorOverrides || {},

    fontFamily:
      resolveFontId(getVal(["typography", "fontFamily", "base"], undefined)) ||
      resolveFontId(getVal(["typography", "fontFamily", "body"], undefined)) ||
      settings.fontFamily || "inter",
    headingFontFamily:
      resolveFontId(getVal(["typography", "fontFamily", "heading"], undefined)) ||
      settings.headingFontFamily || settings.fontFamily || "inter",
    fontSize: (() => {
      const raw = getVal(["typography", "fontSize", "base"], undefined) || settings.fontSize || "medium";
      return FONT_SIZE_TO_PX[raw] || (isNaN(Number(raw)) ? "16" : raw);
    })(),
    heroFontSize: (() => {
      const raw = getVal(["typography", "fontSize", "hero"], undefined) ||
        getVal(["typography", "fontSize", "heading"], undefined) ||
        settings.heroFontSize || settings.headingFontSize || "36";
      return HERO_SIZE_TO_PX[raw] || (isNaN(Number(raw)) ? "36" : raw);
    })(),
    sectionFontSize: (() => {
      const raw = getVal(["typography", "fontSize", "section"], undefined) ||
        settings.sectionFontSize || "30";
      return SECTION_SIZE_TO_PX[raw] || (isNaN(Number(raw)) ? "30" : raw);
    })(),
    fontWeight: getVal(["typography", "fontWeight", "body"], undefined) || settings.fontWeight || "400",
    headingFontWeight: getVal(["typography", "fontWeight", "heading"], undefined) || settings.headingFontWeight || "700",
    // Pinned to the token list on BOTH sources, which is the fix for a defect
    // that reached production: this line used to take
    // `typography.letterSpacing` raw, while every sibling above drills one level
    // deeper (`fontSize.base`) and/or runs a normaliser. A template whose design
    // system holds the letter-spacing MAP there — `{tight, normal, wide, …}` —
    // therefore put an OBJECT into this `string` field, the branding save wrote
    // it to `tenants.settings.letterSpacingPreset`, and `parseTenantSettings`
    // then rejected the whole blob on every storefront read (one bad key used to
    // fail the settings object as a unit), silently taking that tenant's
    // verification tags, GA4 id, tagline and cookie copy down with it.
    // `matchOption` returns undefined for a non-string, so a map now falls
    // through to the stored value and then to "normal".
    letterSpacingPreset:
      matchOption(getVal(["typography", "letterSpacing"], undefined), LETTER_SPACINGS) ||
      matchOption(settings.letterSpacingPreset, LETTER_SPACINGS) ||
      "normal",

    template: settings.template || "modern",
    buttonStyle:
      matchOption(getVal(["borderRadius", "button"], undefined), BUTTON_STYLES) ||
      settings.buttonStyle || "rounded",
    buttonSize: getVal(["button", "size"], undefined) || settings.buttonSize || "medium",
    borderRadius:
      matchOption(getVal(["borderRadius", "container"], undefined), BORDER_RADII) ||
      settings.borderRadius || "medium",
    spacing:
      matchOption(getVal(["spacing", "scale"], undefined), SPACINGS) ||
      settings.spacing || "normal",
    shadowStyle:
      matchOption(getVal(["shadows", "card"], undefined), SHADOW_STYLES) ||
      settings.shadowStyle || "soft",

    glassEffect: getVal(["glassEffect"], undefined) || settings.glassEffect || "none",
    animationType: getVal(["animationType"], undefined) || settings.animationType || "none",
    dividerStyle: getVal(["dividerStyle"], undefined) || settings.dividerStyle || "none",
    buttonHoverEffect: getVal(["buttonHoverEffect"], undefined) || (settings as any).buttonHoverEffect || "none",

    // Navigation & Footer — read from layout.json data on template
    navigationStyle: (activeTemplate as any)?.layout?.navigation || "NavDark",
    navigationConfig: {
      links: (activeTemplate as any)?.layout?.navigationConfig?.links
        || (activeTemplate?.navigation as any)?.links
        || DEFAULT_NAV_LINKS,
      cta: (activeTemplate as any)?.layout?.navigationConfig?.cta
        || (activeTemplate?.navigation as any)?.cta
        || { label: "Check Eligibility", href: "/consultation" },
      cta2: (activeTemplate as any)?.layout?.navigationConfig?.cta2
        || (activeTemplate?.navigation as any)?.cta2
        || undefined,
      showCart: (activeTemplate as any)?.layout?.navigationConfig?.showCart
        ?? (activeTemplate?.navigation as any)?.showCart
        ?? true,
    },
    footerStyle: (activeTemplate as any)?.layout?.footer || "FooterBrand",
    footerConfig: {
      tagline: (activeTemplate as any)?.layout?.footerConfig?.tagline
        || (activeTemplate?.footer as any)?.tagline
        || "",
      sections: (activeTemplate as any)?.layout?.footerConfig?.sections
        || (activeTemplate?.footer as any)?.sections
        || DEFAULT_FOOTER_SECTIONS,
      socialLinks: (activeTemplate as any)?.layout?.footerConfig?.socialLinks
        || (activeTemplate?.footer as any)?.socialLinks
        || [],
      disclaimer: (activeTemplate as any)?.layout?.footerConfig?.disclaimer
        || (activeTemplate?.footer as any)?.disclaimer
        || "",
      address: (activeTemplate as any)?.layout?.footerConfig?.address
        || (activeTemplate?.footer as any)?.address
        || "",
      email: (activeTemplate as any)?.layout?.footerConfig?.email
        || (activeTemplate?.footer as any)?.email
        || "",
    },

    educationHotspots: settingsContent.educationHotspots || [],

    logoPlacement: templateContent.logoPlacement || settingsContent.logoPlacement || {
      navPosition: "left",
      navSize: 52,
      showBusinessName: true,
      heroShowLogo: true,
      heroX: 50,
      heroY: 20,
      heroSize: 80,
      heroStyle: "circular",
      footerShowLogo: true,
    },

    homeHeroTitle: templateContent.home?.heroTitle || templateContent.homeHeroTitle || settingsContent.home?.heroTitle || "Welcome to Your Medical Cannabis Journey",
    homeHeroSubtitle: templateContent.home?.heroSubtitle || templateContent.homeHeroSubtitle || settingsContent.home?.heroSubtitle || "Premium medical cannabis products delivered with care",
    homeHeroCtaText: templateContent.home?.heroCtaText || templateContent.homeHeroCtaText || settingsContent.home?.heroCtaText || "Get Started",
    homeHeroAlignment: templateContent.home?.heroAlignment || settingsContent.home?.heroAlignment || "left",
    homeHeroHeight: templateContent.home?.heroHeight || settingsContent.home?.heroHeight || "large",
    homeHeroOverlayStyle: templateContent.home?.heroOverlayStyle || settingsContent.home?.heroOverlayStyle || "gradient-dark",
    homeHeroOverlayOpacity: templateContent.home?.heroOverlayOpacity ?? settingsContent.home?.heroOverlayOpacity ?? 70,

    // About — read the keys AboutContent actually uses, with legacy fallbacks
    aboutHeroTitle:
      templateContent.about?.heroTitle
      || templateContent.about?.title
      || templateContent.aboutTitle
      || settingsContent.about?.heroTitle
      || settingsContent.about?.title
      || "",
    aboutHeroSubtitle:
      templateContent.about?.heroSubtitle
      || settingsContent.about?.heroSubtitle
      || "",
    aboutMissionTitle:
      templateContent.about?.missionTitle
      || settingsContent.about?.missionTitle
      || "Our Mission",
    aboutMissionParagraphs: (() => {
      const paras =
        templateContent.about?.missionParagraphs
        || settingsContent.about?.missionParagraphs;
      if (Array.isArray(paras)) return paras.join("\n\n");
      // Fallback: legacy free-form content field
      return (
        templateContent.about?.content
        || templateContent.aboutContent
        || templateContent.aboutMission
        || settingsContent.about?.content
        || ""
      );
    })(),

    contactTitle: templateContent.contact?.title || settingsContent.contact?.title || "Get in Touch",
    contactDescription: templateContent.contact?.description || settingsContent.contact?.description || "Have questions? We are here to help.",
    contactEmail:
      templateContent.contact?.email
      || templateContent.support?.contactEmail
      || settingsContent.contact?.email
      || "",
    contactPhone:
      templateContent.contact?.phone
      || templateContent.support?.contactPhone
      || settingsContent.contact?.phone
      || "",
    contactAddress: templateContent.contact?.address || settingsContent.contact?.address || "",

    customCSS: activeTemplate?.customCss || settings.customCSS || "",
  };
}
