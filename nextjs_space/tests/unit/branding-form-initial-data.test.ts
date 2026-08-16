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
