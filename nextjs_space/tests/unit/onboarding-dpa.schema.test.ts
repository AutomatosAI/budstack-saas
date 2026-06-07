import { describe, expect, it } from "vitest";
import {
  DPA_VERSION,
  dpaAcceptanceSchema,
} from "@/lib/gdpr/dpa";
import { sanitizeForLogging } from "@/lib/security/redact";

describe("dpaAcceptanceSchema (PRD-213 AC-2a)", () => {
  it("accepts the current DPA version with an ISO timestamp", () => {
    const result = dpaAcceptanceSchema.safeParse({
      dpaVersion: DPA_VERSION,
      dpaAcceptedAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing dpaVersion", () => {
    const result = dpaAcceptanceSchema.safeParse({
      dpaAcceptedAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a stale dpaVersion", () => {
    const result = dpaAcceptanceSchema.safeParse({
      dpaVersion: "2020-01-01.v0",
      dpaAcceptedAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toMatch(/Data Processing Agreement/i);
    }
  });

  it("rejects a non-ISO dpaAcceptedAt", () => {
    const result = dpaAcceptanceSchema.safeParse({
      dpaVersion: DPA_VERSION,
      dpaAcceptedAt: "yesterday",
    });
    expect(result.success).toBe(false);
  });
});

describe("DPA audit metadata redaction (PRD-213 test plan)", () => {
  it("strips PII (email/name) but keeps the dpaVersion in metadata", () => {
    const metadata = {
      dpaVersion: DPA_VERSION,
      businessName: "Green Leaf Ltd",
      userEmail: "owner@greenleaf.example",
      firstName: "Owner",
    };

    const redacted = sanitizeForLogging(metadata);

    // Non-PII compliance fields survive.
    expect(redacted.dpaVersion).toBe(DPA_VERSION);
    expect(redacted.businessName).toBe("Green Leaf Ltd");
    // PII is redacted.
    expect(redacted.userEmail).not.toBe("owner@greenleaf.example");
    expect(redacted.firstName).not.toBe("Owner");
  });

  it("redacts erasure audit metadata (targetUserEmail/targetUserName)", () => {
    const metadata = {
      reason: "clerk_user_deleted",
      drGreenLinkageCleared: true,
      targetUserEmail: "jane@example.com",
      targetUserName: "Jane Doe",
    };

    const redacted = sanitizeForLogging(metadata);

    expect(redacted.reason).toBe("clerk_user_deleted");
    expect(redacted.drGreenLinkageCleared).toBe(true);
    expect(redacted.targetUserEmail).not.toBe("jane@example.com");
    expect(redacted.targetUserName).not.toBe("Jane Doe");
  });
});
