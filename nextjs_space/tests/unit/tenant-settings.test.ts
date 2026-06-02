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
