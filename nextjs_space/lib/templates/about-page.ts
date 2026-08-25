/**
 * About-page section layout — the single source of truth for how a tenant's
 * /about page is assembled.
 *
 * The About page renders through the same TemplateRenderer as the store home,
 * but its layout is FIXED (defined here) rather than stored in S3 layout.json.
 * Tenant customisation lives in `tenant_templates.pageContent.about` as a
 * versioned, per-section overlay:
 *
 *   { version: 2, sections: [{ id, type, visible?, config?, colorOverrides? }] }
 *
 * Configs are SPARSE — only keys the tenant actually edited are stored. Every
 * section component carries its own defaults (including live businessName
 * interpolation), so an untouched section always renders the stock page.
 *
 * Pre-v2 tenants may have flat legacy keys (heroTitle, missionParagraphs, …)
 * written by the old Brand-tab fields; buildAboutLayout maps those into the
 * equivalent section configs so no existing customisation is lost.
 *
 * This module is pure and isomorphic (no React, no server imports): it is
 * shared by the store /about page (server), the branding editor's live
 * preview (client), and the /store/preview route.
 */

import type {
  LayoutSection,
  SectionColorOverrides,
  TemplateLayout,
} from "@/lib/types/template-layout";

export const ABOUT_PAGE_CONTENT_VERSION = 2;

export interface AboutSectionEntry {
  id: string;
  type: string;
  visible?: boolean;
  config?: Record<string, any>;
  colorOverrides?: SectionColorOverrides;
}

export interface AboutPageContentV2 {
  version: number;
  sections: AboutSectionEntry[];
}

/** Fixed section list for Option A. Order is authoritative; a future
 *  per-page layout builder (Option B) can honour a stored order instead. */
export const DEFAULT_ABOUT_SECTIONS: ReadonlyArray<{ id: string; type: string }> = [
  { id: "about-hero", type: "AboutHero" },
  { id: "about-mission", type: "AboutMission" },
  { id: "about-stats", type: "AboutStats" },
  { id: "about-values", type: "AboutValues" },
  { id: "about-facilities", type: "AboutFacilities" },
  { id: "about-timeline", type: "AboutTimeline" },
  { id: "about-cta", type: "AboutCta" },
];

/** The hero can never be hidden — a fully blank About page is always a bug. */
export const ABOUT_ALWAYS_VISIBLE_IDS = new Set(["about-hero"]);

// ─── Canonical section defaults ──────────────────────────────────
// These reproduce the legacy hardcoded About page exactly. The section
// components import them as render fallbacks; the editor imports them to
// seed array editors so tenants start from what is actually on their page.

export const DEFAULT_ABOUT_STATS = [
  { value: "10,000+", label: "Patients Served" },
  { value: "50+", label: "Products Available" },
  { value: "100%", label: "Quality Certified" },
  { value: "24/7", label: "Patient Support" },
];

export const DEFAULT_ABOUT_VALUES = [
  {
    icon: "Target",
    title: "Excellence",
    description: "Uncompromising quality in every product and process",
  },
  {
    icon: "Heart",
    title: "Patient-Focused",
    description: "Putting patient needs and wellbeing at the heart of everything we do",
  },
  {
    icon: "Globe",
    title: "Global Reach",
    description: "Serving patients across continents with consistent standards",
  },
  {
    icon: "Shield",
    title: "Integrity",
    description: "Operating with transparency, compliance, and ethical responsibility",
  },
];

export const DEFAULT_ABOUT_FACILITIES = [
  {
    title: "Cultivation & Processing",
    description:
      "State-of-the-art cultivation and processing facility meeting the highest international quality standards.",
    features: [
      "GMP-certified production",
      "Advanced indoor growing systems",
      "Quality control laboratories",
      "Sustainable practices",
    ],
  },
  {
    title: "Distribution & Fulfilment",
    description:
      "Efficient distribution network ensuring timely, secure delivery of medical cannabis products to patients.",
    features: [
      "Temperature-controlled storage",
      "Tracked delivery systems",
      "Regulatory compliance",
      "Discreet packaging",
    ],
  },
];

export const DEFAULT_ABOUT_TIMELINE = [
  { year: "Founded", description: "Established with a mission to improve patient access to medical cannabis" },
  { year: "Licensed", description: "Obtained all regulatory approvals and licensing for medical cannabis operations" },
  { year: "Expanded", description: "Grew our product range and extended our services to more patients" },
  { year: "Today", description: "Continuing to innovate and improve patient outcomes through quality cannabis medicine" },
];

/** Display seeds for the editor's array fields, keyed `sectionId.fieldKey`. */
export const ABOUT_ARRAY_FIELD_SEEDS: Record<string, any[]> = {
  "about-stats.items": DEFAULT_ABOUT_STATS,
  "about-values.items": DEFAULT_ABOUT_VALUES,
  "about-facilities.items": DEFAULT_ABOUT_FACILITIES,
  "about-timeline.entries": DEFAULT_ABOUT_TIMELINE,
};

// ─── pageContent.about parsing ───────────────────────────────────

export function isAboutContentV2(about: unknown): about is AboutPageContentV2 {
  return (
    !!about &&
    typeof about === "object" &&
    (about as any).version >= ABOUT_PAGE_CONTENT_VERSION &&
    Array.isArray((about as any).sections)
  );
}

/** Map the pre-v2 flat keys (written by the old Brand-tab About fields, and
 *  read by the legacy about-content.tsx) into sparse per-section configs. */
export function legacyAboutToSectionConfigs(
  about: Record<string, any> | null | undefined,
): Record<string, Record<string, any>> {
  if (!about || typeof about !== "object") return {};
  const configs: Record<string, Record<string, any>> = {};
  const put = (id: string, key: string, value: unknown) => {
    if (value === undefined || value === null || value === "") return;
    configs[id] = { ...(configs[id] || {}), [key]: value };
  };

  put("about-hero", "heading", about.heroTitle || about.title);
  put("about-hero", "subtitle", about.heroSubtitle);
  put("about-mission", "heading", about.missionTitle);
  if (Array.isArray(about.missionParagraphs) && about.missionParagraphs.length > 0) {
    put("about-mission", "paragraphs", about.missionParagraphs);
  } else if (typeof about.content === "string" && about.content.trim()) {
    // Oldest shape: a single free-form content string
    put("about-mission", "paragraphs", about.content);
  }
  put("about-mission", "imageUrl", about.missionImage);
  if (Array.isArray(about.stats) && about.stats.length > 0) {
    put("about-stats", "items", about.stats);
  }
  if (Array.isArray(about.values) && about.values.length > 0) {
    put("about-values", "items", about.values);
  }
  if (Array.isArray(about.facilities) && about.facilities.length > 0) {
    put("about-facilities", "items", about.facilities);
  }
  if (Array.isArray(about.timeline)) {
    // Legacy semantics: an explicitly-empty timeline hid the section.
    put("about-timeline", "entries", about.timeline.length > 0 ? about.timeline : undefined);
    if (about.timeline.length === 0) {
      configs["about-timeline"] = { ...(configs["about-timeline"] || {}), entries: [] };
    }
  }
  put("about-cta", "heading", about.ctaTitle);
  put("about-cta", "subtitle", about.ctaSubtitle);

  return configs;
}

/** Resolve `pageContent.about` (v2, legacy, or absent) into the fixed
 *  section entries the About page renders. Configs stay sparse. */
export function resolveAboutSections(about: unknown): AboutSectionEntry[] {
  if (isAboutContentV2(about)) {
    const byId = new Map(about.sections.map((s) => [s.id, s]));
    return DEFAULT_ABOUT_SECTIONS.map(({ id, type }) => {
      const saved = byId.get(id);
      return {
        id,
        type,
        visible: ABOUT_ALWAYS_VISIBLE_IDS.has(id) ? true : saved?.visible !== false,
        config: { ...(saved?.config || {}) },
        colorOverrides: saved?.colorOverrides,
      };
    });
  }

  const legacyConfigs = legacyAboutToSectionConfigs(
    about as Record<string, any> | null | undefined,
  );
  return DEFAULT_ABOUT_SECTIONS.map(({ id, type }) => ({
    id,
    type,
    visible: true,
    config: { ...(legacyConfigs[id] || {}) },
  }));
}

/** Editor-side section state (branding Store Editor "Pages" tab). */
export interface AboutSectionState {
  id: string;
  type: string;
  visible: boolean;
  config: Record<string, any>;
}

/** Serialise editor section state (+ the editor's per-section colour override
 *  map, keyed by section id) into the versioned pageContent.about payload. */
export function aboutSectionsToContentV2(
  sections: AboutSectionState[],
  colorOverrides?: Record<string, Record<string, string>>,
): AboutPageContentV2 {
  return {
    version: ABOUT_PAGE_CONTENT_VERSION,
    sections: sections.map((s) => {
      const overrides = colorOverrides?.[s.id];
      const hasOverrides =
        overrides && Object.keys(overrides).some((k) => overrides[k]?.trim());
      return {
        id: s.id,
        type: s.type,
        visible: ABOUT_ALWAYS_VISIBLE_IDS.has(s.id) ? true : s.visible,
        config: s.config,
        ...(hasOverrides ? { colorOverrides: overrides } : {}),
      };
    }),
  };
}

/** Optional nav/footer passthrough so the editor preview can render the
 *  About page with the tenant's chrome. Store-side renders use
 *  renderChrome={false} (the store layout owns nav/footer) and skip this. */
export interface AboutLayoutChrome {
  navigation?: string;
  navigationConfig?: Record<string, any>;
  footer?: string;
  footerConfig?: Record<string, any>;
}

/** Build the TemplateLayout for a tenant's About page. */
export function buildAboutLayout(
  about: unknown,
  chrome?: AboutLayoutChrome,
): TemplateLayout {
  const sections: LayoutSection[] = resolveAboutSections(about).map((s) => ({
    type: s.type,
    id: s.id,
    config: s.config,
    visible: s.visible,
    ...(s.colorOverrides ? { colorOverrides: s.colorOverrides } : {}),
  }));

  return {
    version: "1",
    navigation: chrome?.navigation || "NavDark",
    navigationConfig: chrome?.navigationConfig,
    footer: chrome?.footer || "FooterBrand",
    footerConfig: chrome?.footerConfig,
    sections,
  };
}
