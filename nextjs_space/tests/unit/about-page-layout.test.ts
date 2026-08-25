import { describe, it, expect } from "vitest";

import {
  ABOUT_PAGE_CONTENT_VERSION,
  DEFAULT_ABOUT_SECTIONS,
  aboutSectionsToContentV2,
  buildAboutLayout,
  isAboutContentV2,
  legacyAboutToSectionConfigs,
  resolveAboutSections,
  type AboutSectionState,
} from "@/lib/templates/about-page";

/**
 * The About page contract: `pageContent.about` (v2 sections, legacy flat keys,
 * or nothing) resolves into the FIXED section list the storefront renders.
 * Configs are sparse — an untouched tenant must produce empty configs so the
 * section components fall back to the stock page (including live businessName
 * interpolation, which a baked default would freeze).
 */

const SECTION_IDS = DEFAULT_ABOUT_SECTIONS.map((s) => s.id);

describe("resolveAboutSections — no stored content", () => {
  it("yields the full fixed section list, visible, with empty configs", () => {
    const sections = resolveAboutSections(undefined);

    expect(sections.map((s) => s.id)).toEqual(SECTION_IDS);
    for (const section of sections) {
      expect(section.visible).toBe(true);
      expect(section.config).toEqual({});
    }
  });
});

describe("resolveAboutSections — legacy flat keys", () => {
  const legacy = {
    heroTitle: "About LekkerWeed",
    heroSubtitle: "Cape Town's finest",
    missionTitle: "Why we exist",
    missionParagraphs: ["First para.", "Second para."],
    missionImage: "tenants/t1/uploads/mission.jpg",
    stats: [{ value: "1,000+", label: "Members" }],
    values: [{ icon: "Heart", title: "Care", desc: "We care" }],
    facilities: [{ title: "Farm", description: "Our farm", features: ["Organic"] }],
    timeline: [{ year: "2023", description: "Founded" }],
    ctaTitle: "Talk to us",
    ctaSubtitle: "We reply fast",
  };

  it("maps every legacy key into the matching section config", () => {
    const configs = legacyAboutToSectionConfigs(legacy);

    expect(configs["about-hero"]).toEqual({
      heading: "About LekkerWeed",
      subtitle: "Cape Town's finest",
    });
    expect(configs["about-mission"]).toEqual({
      heading: "Why we exist",
      paragraphs: ["First para.", "Second para."],
      imageUrl: "tenants/t1/uploads/mission.jpg",
    });
    expect(configs["about-stats"]).toEqual({ items: legacy.stats });
    expect(configs["about-values"]).toEqual({ items: legacy.values });
    expect(configs["about-facilities"]).toEqual({ items: legacy.facilities });
    expect(configs["about-timeline"]).toEqual({ entries: legacy.timeline });
    expect(configs["about-cta"]).toEqual({
      heading: "Talk to us",
      subtitle: "We reply fast",
    });
  });

  it("keeps sections with no legacy data sparse", () => {
    const sections = resolveAboutSections({ heroTitle: "Only a title" });

    const hero = sections.find((s) => s.id === "about-hero");
    expect(hero?.config).toEqual({ heading: "Only a title" });
    for (const section of sections.filter((s) => s.id !== "about-hero")) {
      expect(section.config).toEqual({});
    }
  });

  it("falls back to the oldest free-form content string for mission paragraphs", () => {
    const configs = legacyAboutToSectionConfigs({ content: "One big story." });
    expect(configs["about-mission"]).toEqual({ paragraphs: "One big story." });
  });

  it("preserves the legacy hide-timeline semantics of an explicitly empty array", () => {
    const configs = legacyAboutToSectionConfigs({ timeline: [] });
    expect(configs["about-timeline"]).toEqual({ entries: [] });
  });
});

describe("resolveAboutSections — v2 payload", () => {
  const v2 = {
    version: ABOUT_PAGE_CONTENT_VERSION,
    sections: [
      { id: "about-hero", type: "AboutHero", visible: false, config: { heading: "Us" } },
      { id: "about-timeline", type: "AboutTimeline", visible: false, config: {} },
      { id: "about-stats", type: "AboutStats", config: { items: [{ value: "5", label: "Farms" }] } },
      { id: "not-a-real-section", type: "Bogus", config: { x: 1 } },
    ],
  };

  it("is recognised by the version guard", () => {
    expect(isAboutContentV2(v2)).toBe(true);
    expect(isAboutContentV2({ heroTitle: "legacy" })).toBe(false);
    expect(isAboutContentV2(null)).toBe(false);
    expect(isAboutContentV2({ version: 2 })).toBe(false); // sections missing
  });

  it("overlays saved config and visibility by id, in the fixed order", () => {
    const sections = resolveAboutSections(v2);

    expect(sections.map((s) => s.id)).toEqual(SECTION_IDS);
    expect(sections.find((s) => s.id === "about-stats")?.config).toEqual({
      items: [{ value: "5", label: "Farms" }],
    });
    expect(sections.find((s) => s.id === "about-timeline")?.visible).toBe(false);
    // Sections absent from the payload stay visible with empty config
    expect(sections.find((s) => s.id === "about-cta")).toMatchObject({
      visible: true,
      config: {},
    });
  });

  it("never hides the hero, even when the payload says so", () => {
    const sections = resolveAboutSections(v2);
    expect(sections.find((s) => s.id === "about-hero")?.visible).toBe(true);
  });

  it("ignores unknown section ids", () => {
    const sections = resolveAboutSections(v2);
    expect(sections.some((s) => s.id === "not-a-real-section")).toBe(false);
  });
});

describe("aboutSectionsToContentV2 — editor state → payload", () => {
  const state: AboutSectionState[] = DEFAULT_ABOUT_SECTIONS.map(({ id, type }) => ({
    id,
    type,
    visible: id !== "about-facilities",
    config: id === "about-hero" ? { heading: "About Us" } : {},
  }));

  it("stamps the version and carries config + visibility", () => {
    const payload = aboutSectionsToContentV2(state);

    expect(payload.version).toBe(ABOUT_PAGE_CONTENT_VERSION);
    expect(payload.sections.map((s) => s.id)).toEqual(SECTION_IDS);
    expect(payload.sections.find((s) => s.id === "about-hero")?.config).toEqual({
      heading: "About Us",
    });
    expect(payload.sections.find((s) => s.id === "about-facilities")?.visible).toBe(false);
  });

  it("folds in per-section colour overrides only when non-empty", () => {
    const payload = aboutSectionsToContentV2(state, {
      "about-hero": { background: "#112233" },
      "about-cta": { primary: "  " }, // whitespace-only — dropped
      "home-hero-1": { primary: "#ff0000" }, // home section — not About's concern
    });

    expect(payload.sections.find((s) => s.id === "about-hero")?.colorOverrides).toEqual({
      background: "#112233",
    });
    expect(payload.sections.find((s) => s.id === "about-cta")?.colorOverrides).toBeUndefined();
  });

  it("round-trips through resolveAboutSections", () => {
    const payload = aboutSectionsToContentV2(state, { "about-hero": { background: "#112233" } });
    const resolved = resolveAboutSections(payload);

    expect(resolved.find((s) => s.id === "about-hero")).toMatchObject({
      config: { heading: "About Us" },
      colorOverrides: { background: "#112233" },
    });
    expect(resolved.find((s) => s.id === "about-facilities")?.visible).toBe(false);
  });
});

describe("buildAboutLayout", () => {
  it("produces a renderable layout with default chrome", () => {
    const layout = buildAboutLayout(undefined);

    expect(layout.navigation).toBe("NavDark");
    expect(layout.footer).toBe("FooterBrand");
    expect(layout.sections.map((s) => s.type)).toEqual(
      DEFAULT_ABOUT_SECTIONS.map((s) => s.type),
    );
  });

  it("passes the tenant's chrome through for editor/preview renders", () => {
    const layout = buildAboutLayout(undefined, {
      navigation: "NavPill",
      navigationConfig: { showCart: false },
      footer: "FooterSimple",
      footerConfig: { tagline: "Hi" },
    });

    expect(layout.navigation).toBe("NavPill");
    expect(layout.navigationConfig).toEqual({ showCart: false });
    expect(layout.footer).toBe("FooterSimple");
    expect(layout.footerConfig).toEqual({ tagline: "Hi" });
  });
});
