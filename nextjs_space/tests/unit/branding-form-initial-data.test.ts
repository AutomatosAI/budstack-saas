import { describe, it, expect } from "vitest";

import { buildInitialFormData } from "@/app/tenant-admin/branding/branding-form-initial-data";
import type { tenant_templates } from "@prisma/client";

/**
 * The write half of the `letterSpacingPreset` defect.
 *
 * `EditorFormData.letterSpacingPreset` is a `string` — one of the four tokens the
 * Type tab offers, and one of the four keys `tenant-theme-provider` resolves. A
 * design system stores the CHOSEN token under `typography.letterSpacing`; some
 * templates instead hold the whole letter-spacing MAP there. This builder used to
 * read that node raw, so the map became the field value, the branding save wrote
 * it to `tenants.settings`, and every storefront read then failed to parse the
 * blob — taking that store's search-engine verification tags, GA4 id, tagline and
 * cookie copy with it.
 */

const LETTER_SPACING_MAP = {
  wide: "0.025em",
  tight: "-0.02em",
  wider: "0.05em",
  normal: "0",
  widest: "0.1em",
};

function templateWith(designSystem: unknown): tenant_templates {
  return { designSystem } as unknown as tenant_templates;
}

const TENANT = { businessName: "LekkerWeed", settings: {} };

describe("buildInitialFormData — letterSpacingPreset is always a token", () => {
  it("ignores a design system holding the whole map, rather than adopting it", () => {
    const form = buildInitialFormData(
      TENANT,
      templateWith({ typography: { letterSpacing: LETTER_SPACING_MAP } }),
    );

    expect(typeof form.letterSpacingPreset).toBe("string");
    expect(form.letterSpacingPreset).toBe("normal");
  });

  it("takes the design system's value when it IS one of the tokens", () => {
    const form = buildInitialFormData(
      TENANT,
      templateWith({ typography: { letterSpacing: "wide" } }),
    );

    expect(form.letterSpacingPreset).toBe("wide");
  });

  it("ignores an already-corrupted stored value instead of round-tripping it", () => {
    const form = buildInitialFormData(
      { businessName: "LekkerWeed", settings: { letterSpacingPreset: LETTER_SPACING_MAP } },
      templateWith({}),
    );

    expect(form.letterSpacingPreset).toBe("normal");
  });

  it("keeps a well-formed stored token when the template offers none", () => {
    const form = buildInitialFormData(
      { businessName: "LekkerWeed", settings: { letterSpacingPreset: "tight" } },
      templateWith({}),
    );

    expect(form.letterSpacingPreset).toBe("tight");
  });

  it("rejects a token that is not on the select's list", () => {
    const form = buildInitialFormData(
      { businessName: "LekkerWeed", settings: { letterSpacingPreset: "widest" } },
      templateWith({}),
    );

    expect(form.letterSpacingPreset).toBe("normal");
  });
});

/**
 * About page editor state. The Pages tab edits a fixed section list whose
 * configs are SPARSE — an untouched tenant loads empty configs so the page
 * keeps rendering its stock content (with live businessName interpolation).
 * Legacy flat keys written by the old Brand-tab About fields must surface in
 * the new section configs so no existing customisation is lost.
 */
function templateWithPageContent(pageContent: unknown): tenant_templates {
  return { designSystem: {}, pageContent } as unknown as tenant_templates;
}

describe("buildInitialFormData — aboutSections", () => {
  it("loads the fixed section list with empty configs for an untouched tenant", () => {
    const form = buildInitialFormData(TENANT, templateWith({}));

    expect(form.aboutSections.map((s) => s.id)).toEqual([
      "about-hero",
      "about-mission",
      "about-stats",
      "about-values",
      "about-facilities",
      "about-timeline",
      "about-cta",
    ]);
    for (const section of form.aboutSections) {
      expect(section.visible).toBe(true);
      expect(section.config).toEqual({});
    }
  });

  it("maps legacy flat about keys into the matching section configs", () => {
    const form = buildInitialFormData(
      TENANT,
      templateWithPageContent({
        about: {
          heroTitle: "About LekkerWeed",
          missionTitle: "Why we exist",
          missionParagraphs: ["One.", "Two."],
        },
      }),
    );

    expect(form.aboutSections.find((s) => s.id === "about-hero")?.config).toEqual({
      heading: "About LekkerWeed",
    });
    expect(form.aboutSections.find((s) => s.id === "about-mission")?.config).toEqual({
      heading: "Why we exist",
      paragraphs: ["One.", "Two."],
    });
  });

  it("overlays v2 sections and seeds their colour overrides into the shared map", () => {
    const form = buildInitialFormData(
      TENANT,
      templateWithPageContent({
        about: {
          version: 2,
          sections: [
            {
              id: "about-cta",
              type: "AboutCta",
              visible: false,
              config: { heading: "Reach out" },
              colorOverrides: { background: "#101010" },
            },
          ],
        },
      }),
    );

    const cta = form.aboutSections.find((s) => s.id === "about-cta");
    expect(cta?.visible).toBe(false);
    expect(cta?.config).toEqual({ heading: "Reach out" });
    expect(form.sectionColorOverrides["about-cta"]).toEqual({ background: "#101010" });
  });
});
