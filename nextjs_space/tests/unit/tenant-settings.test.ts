import { describe, it, expect, vi, afterEach } from "vitest";

// PRD-208 AC-3/AC-3a — Zod parse-on-read for tenant.settings. Pure (no DB/Docker):
// schema acceptance, safeParse surfacing issues, and the "return typed default,
// never throw" contract are all exercised directly.
import {
  parseTenantSettings,
  parseTenantSettingsResult,
  tenantSettingsReadSchema,
} from "@/lib/tenant/tenant-settings";

afterEach(() => {
  vi.restoreAllMocks();
});

const GOOD_BLOB = {
  tagline: "Wellness, delivered",
  primaryColor: "#10b981",
  secondaryColor: "#059669",
  fontFamily: "Inter",
  buttonStyle: "rounded",
  // unknown-but-live keys the storefront relies on (passthrough must keep these)
  clerkOrgId: "org_123",
  railwayDomainId: "dom_456",
  layoutSections: [{ id: "hero" }],
};

describe("tenantSettingsReadSchema — accepts a known-good blob", () => {
  it("safeParse succeeds on a well-formed settings object", () => {
    const result = tenantSettingsReadSchema.safeParse(GOOD_BLOB);
    expect(result.success).toBe(true);
  });

  it("preserves unknown keys (.passthrough policy, OQ-4) instead of dropping them", () => {
    const result = tenantSettingsReadSchema.safeParse(GOOD_BLOB);
    expect(result.success).toBe(true);
    if (result.success) {
      // server-managed + structural keys must survive the round-trip read
      expect((result.data as Record<string, unknown>).clerkOrgId).toBe("org_123");
      expect((result.data as Record<string, unknown>).layoutSections).toEqual([
        { id: "hero" },
      ]);
    }
  });
});

describe("tenantSettingsReadSchema — surfaces issues on a malformed blob", () => {
  it("safeParse reports an issue when a known key has the wrong type", () => {
    // primaryColor is a (nullable) string; a number is invalid
    const result = tenantSettingsReadSchema.safeParse({ primaryColor: 1234 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it("rejects an over-long customCSS (size cap is an XSS guard)", () => {
    const result = tenantSettingsReadSchema.safeParse({
      customCSS: "a".repeat(200_001),
    });
    expect(result.success).toBe(false);
  });
});

describe("parseTenantSettings — returns a typed default, never throws", () => {
  it("returns the parsed object for a good blob", () => {
    const parsed = parseTenantSettings(GOOD_BLOB);
    expect(parsed.primaryColor).toBe("#10b981");
    expect(parsed.buttonStyle).toBe("rounded");
  });

  it("returns {} for null / undefined (a tenant with no settings yet) — not a failure", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(parseTenantSettings(null)).toEqual({});
    expect(parseTenantSettings(undefined)).toEqual({});
    // null/undefined is a valid empty blob: it must NOT log a parse failure
    expect(errSpy).not.toHaveBeenCalled();
  });

  it("returns {} (typed default) on a malformed blob INSTEAD of throwing", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // a primitive is not an object — would explode three layers down if cast as-any
    expect(() => parseTenantSettings("not-an-object")).not.toThrow();
    expect(parseTenantSettings("not-an-object")).toEqual({});
  });

  it("logs a redacted server-side failure signal on a bad blob (no raw blob leaked)", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    parseTenantSettings({ primaryColor: 1234 }, { tenantId: "t_1" });
    expect(errSpy).toHaveBeenCalledTimes(1);
    const [message, payload] = errSpy.mock.calls[0];
    expect(message).toContain("parse failed");
    expect(payload).toMatchObject({
      event: "security.tenant_settings_parse_failed",
      tenantId: "t_1",
    });
    // the redacted log must carry only an issue COUNT, never the offending value
    expect(JSON.stringify(payload)).not.toContain("1234");
  });
});

describe("parseTenantSettingsResult — exposes validity + issue count", () => {
  it("reports ok=true, issueCount=0 for a good blob", () => {
    const result = parseTenantSettingsResult(GOOD_BLOB);
    expect(result.ok).toBe(true);
    expect(result.issueCount).toBe(0);
  });

  it("reports ok=false with a non-zero issue count for a bad blob", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = parseTenantSettingsResult({ primaryColor: 1234 });
    expect(result.ok).toBe(false);
    expect(result.issueCount).toBeGreaterThan(0);
    expect(result.settings).toEqual({});
  });

  it("treats null as ok=true with an empty settings object", () => {
    const result = parseTenantSettingsResult(null);
    expect(result.ok).toBe(true);
    expect(result.issueCount).toBe(0);
    expect(result.settings).toEqual({});
  });
});

/**
 * The production defect: one cosmetic key made the whole blob unreadable, which
 * switched off Search Console verification, GA4, the tagline and the cookie copy
 * for that store. The stored value below is the real one — a template's
 * design-system letter-spacing MAP written into a field that holds one token.
 */
describe("parseTenantSettingsResult — one bad key must not take the blob down", () => {
  const LETTER_SPACING_MAP = {
    wide: "0.025em",
    tight: "-0.02em",
    wider: "0.05em",
    normal: "0",
    widest: "0.1em",
  };

  const REAL_WORLD_BLOB = {
    ...GOOD_BLOB,
    googleSiteVerification: "aO6R48veBlW75o-L9QyZ1M2dfQTyjz0vQyJTuKkOBng",
    analyticsEnabled: true,
    ga4MeasurementId: "G-ABCD123456",
    // the one offending key — a string field holding an object
    letterSpacingPreset: LETTER_SPACING_MAP,
  };

  it("keeps every OTHER key when a single key fails", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { settings } = parseTenantSettingsResult(REAL_WORLD_BLOB);

    expect(settings.googleSiteVerification).toBe(
      "aO6R48veBlW75o-L9QyZ1M2dfQTyjz0vQyJTuKkOBng",
    );
    expect(settings.ga4MeasurementId).toBe("G-ABCD123456");
    expect(settings.analyticsEnabled).toBe(true);
    expect(settings.tagline).toBe("Wellness, delivered");
    expect(settings.primaryColor).toBe("#10b981");
  });

  it("drops only the offending key, and reports it by name", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = parseTenantSettingsResult(REAL_WORLD_BLOB);

    expect(result.ok).toBe(false);
    expect(result.droppedKeys).toEqual(["letterSpacingPreset"]);
    expect(result.settings).not.toHaveProperty("letterSpacingPreset");
  });

  it("names the dropped key in the failure log without leaking any value", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    parseTenantSettingsResult(REAL_WORLD_BLOB, { tenantId: "t_1" });

    const [, payload] = errSpy.mock.calls[0];
    expect(payload).toMatchObject({
      event: "security.tenant_settings_parse_failed",
      tenantId: "t_1",
      droppedKeys: ["letterSpacingPreset"],
    });
    // the offending VALUE must still never reach the log
    expect(JSON.stringify(payload)).not.toContain("0.025em");
  });

  it("attributes a nested failure to its top-level key and keeps the siblings", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = parseTenantSettingsResult({
      ...GOOD_BLOB,
      footer: { certifications: [{ name: 42 }] },
    });

    expect(result.droppedKeys).toEqual(["footer"]);
    expect(result.settings.tagline).toBe("Wellness, delivered");
  });

  it("still returns the typed default when the blob itself is the wrong type", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = parseTenantSettingsResult("not-an-object");

    expect(result.settings).toEqual({});
    expect(result.droppedKeys).toEqual([]);
  });
});
