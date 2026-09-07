import { describe, it, expect } from "vitest";

import {
  MIN_CONTRAST,
  buildColorOverrideVars,
  contrastRatio,
  deriveTenantTokens,
  mixChannels,
  readableOn,
  toHslChannels,
} from "@/lib/theme/tenant-tokens";

/**
 * The storefront theming contract (lib/theme/tenant-tokens.ts).
 *
 * Two live palettes anchor these tests. LekkerWeed is the dark pilot tenant
 * whose dashboard rendered white text on white cards because only five shadcn
 * tokens were remapped; HealingBuds is the light first partner whose rendering
 * must not move. The third palette is the one an operator can always produce
 * with the colour pickers: text and background the same colour.
 */
const LEKKERWEED = {
  primary: "175 70% 42%",
  secondary: "175 70% 42%",
  accent: "335 81% 45%",
  background: "280 45% 8%",
  surface: "280 35% 14%",
  text: "0 0% 100%",
  heading: "0 0% 100%",
  border: "280 30% 25%",
  "primary-scale": { "500": "335 85% 55%" },
};

const HEALINGBUDS = {
  primary: "178 48% 21%",
  secondary: "178 48% 33%",
  accent: "164 48% 53%",
  background: "150 12% 97%",
  surface: "155 10% 99%",
  text: "172 32% 20%",
  heading: "172 32% 20%",
  border: "165 18% 86%",
};

describe("toHslChannels", () => {
  it("accepts hex, hsl() wrappers and raw channels", () => {
    expect(toHslChannels("#ffffff")).toBe("0 0% 100%");
    expect(toHslChannels("#fff")).toBe("0 0% 100%");
    expect(toHslChannels("hsl(280, 45%, 8%)")).toBe("280 45% 8%");
    expect(toHslChannels("hsl(280 45% 8% / 0.5)")).toBe("280 45% 8%");
    expect(toHslChannels("  280   45%  8% ")).toBe("280 45% 8%");
  });

  it("rejects everything hsl(var(--x)) could not consume", () => {
    expect(toHslChannels("red")).toBeNull();
    expect(toHslChannels("")).toBeNull();
    expect(toHslChannels(null)).toBeNull();
    expect(toHslChannels({ "500": "335 85% 55%" })).toBeNull();
    expect(toHslChannels("rgb(1,2,3)")).toBeNull();
  });
});

describe("contrast helpers", () => {
  it("measures WCAG contrast", () => {
    expect(contrastRatio("0 0% 100%", "0 0% 0%")).toBeCloseTo(21, 1);
    expect(contrastRatio("0 0% 100%", "0 0% 100%")).toBeCloseTo(1, 5);
  });

  it("picks black on pale colours and white on dark ones", () => {
    expect(readableOn("280 45% 8%")).toBe("0 0% 100%");
    expect(readableOn("0 0% 100%")).toBe("0 0% 0%");
    // LekkerWeed's teal button: white fails AA on it, black clears it.
    expect(readableOn("175 70% 42%")).toBe("0 0% 0%");
  });

  it("mixes in RGB space", () => {
    expect(mixChannels("0 0% 0%", "0 0% 100%", 0.5)).toBe("0 0% 50%");
    expect(mixChannels("0 0% 0%", "0 0% 100%", 0)).toBe("0 0% 0%");
  });
});

describe("deriveTenantTokens — dark palette (LekkerWeed)", () => {
  const tokens = deriveTenantTokens(LEKKERWEED);

  it("pairs every shadcn surface with a foreground that reads on it", () => {
    expect(tokens["--card"]).toBe("280 35% 14%");
    expect(tokens["--card-foreground"]).toBe("0 0% 100%");
    expect(tokens["--popover"]).toBe("280 35% 14%");
    expect(tokens["--popover-foreground"]).toBe("0 0% 100%");
    expect(tokens["--background"]).toBe("280 45% 8%");
    expect(tokens["--foreground"]).toBe("0 0% 100%");
    expect(contrastRatio(tokens["--muted-foreground"], tokens["--card"])).toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect(contrastRatio(tokens["--muted-foreground"], tokens["--muted"])).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  it("computes button foregrounds from the button colour instead of assuming white", () => {
    expect(tokens["--primary"]).toBe("175 70% 42%");
    expect(tokens["--primary-foreground"]).toBe("0 0% 0%");
    expect(tokens["--accent-foreground"]).toBe("0 0% 100%");
    expect(tokens["--ring"]).toBe("175 70% 42%");
  });

  it("keeps the tenant's own variables and skips nested colour scales", () => {
    expect(tokens["--tenant-color-primary"]).toBe("175 70% 42%");
    expect(tokens["--tenant-color-border"]).toBe("280 30% 25%");
    expect(tokens["--input"]).toBe("280 30% 25%");
    expect(tokens["--tenant-color-primary-scale"]).toBeUndefined();
  });
});

describe("deriveTenantTokens — light palette (HealingBuds)", () => {
  const tokens = deriveTenantTokens(HEALINGBUDS);

  it("leaves the operator's readable choices untouched", () => {
    expect(tokens["--foreground"]).toBe("172 32% 20%");
    expect(tokens["--card"]).toBe("155 10% 99%");
    expect(tokens["--card-foreground"]).toBe("172 32% 20%");
    expect(tokens["--border"]).toBe("165 18% 86%");
    expect(tokens["--primary-foreground"]).toBe("0 0% 100%");
  });

  it("derives a muted foreground that still reads on the card", () => {
    expect(contrastRatio(tokens["--muted-foreground"], tokens["--card"])).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
});

describe("deriveTenantTokens — legibility floor", () => {
  it("substitutes black when an operator picks white text on a white page", () => {
    const tokens = deriveTenantTokens({ background: "#ffffff", text: "#ffffff", heading: "#fefefe" });
    expect(tokens["--foreground"]).toBe("0 0% 0%");
    expect(tokens["--tenant-color-text"]).toBe("0 0% 0%");
    expect(tokens["--tenant-color-heading"]).toBe("0 0% 0%");
    expect(tokens["--card-foreground"]).toBe("0 0% 0%");
  });

  it("substitutes white when the text vanishes into a dark page", () => {
    const tokens = deriveTenantTokens({ background: "#111111", text: "#222222" });
    expect(tokens["--foreground"]).toBe("0 0% 100%");
  });

  it("fills an unset surface: white on a light page, a lifted shade on a dark one", () => {
    expect(deriveTenantTokens({ background: "#ffffff", text: "#111111" })["--card"]).toBe("0 0% 100%");
    const dark = deriveTenantTokens({ background: "280 45% 8%", text: "#ffffff" });
    expect(dark["--card"]).not.toBe("280 45% 8%");
    expect(contrastRatio(dark["--card-foreground"], dark["--card"])).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  it("emits nothing for tenants without colours", () => {
    expect(deriveTenantTokens(undefined)).toEqual({});
    expect(deriveTenantTokens({})).toEqual({});
    expect(deriveTenantTokens({ primary: "" })).toEqual({});
  });
});

describe("buildColorOverrideVars", () => {
  it("returns nothing when there is nothing to override", () => {
    expect(buildColorOverrideVars(undefined)).toEqual({});
    expect(buildColorOverrideVars({ text: "" })).toEqual({});
  });

  it("layers overrides over defaults and converts hex", () => {
    const vars = buildColorOverrideVars(
      { text: "#ffffff" },
      { defaults: { background: "220 15% 10%", text: "0 0% 90%" } },
    );
    expect(vars).toEqual({
      "--tenant-color-background": "220 15% 10%",
      "--tenant-color-text": "0 0% 100%",
    });
  });

  it("re-checks inherited text when a section changes its background", () => {
    const vars = buildColorOverrideVars(
      { background: "#ffffff" },
      { base: LEKKERWEED },
    );
    expect(vars["--tenant-color-background"]).toBe("0 0% 100%");
    expect(vars["--tenant-color-text"]).toBe("0 0% 0%");
    expect(vars["--tenant-color-heading"]).toBe("0 0% 0%");
  });

  it("leaves a readable override alone", () => {
    const vars = buildColorOverrideVars(
      { background: "#7d7878", text: "#ffffff", heading: "#ffffff" },
      { base: LEKKERWEED },
    );
    expect(vars["--tenant-color-text"]).toBe("0 0% 100%");
    expect(vars["--tenant-color-heading"]).toBe("0 0% 100%");
  });
});
