import { describe, expect, it } from "vitest";
import {
  sanitizeForLogging,
  isSensitiveField,
  pinoRedactPaths,
  SENSITIVE_FIELDS,
} from "@/lib/security/redact";

/**
 * PRD-215 AC-1a — the redaction primitive is the single source of truth for
 * what must never reach a log line. These tests pin the headline PHI/PII fields
 * (emails / names / phones / addresses / KYC links / Dr Green payloads) so a
 * future field-set edit can't silently re-open a leak.
 */
describe("sanitizeForLogging", () => {
  it("redacts top-level email/name/phone", () => {
    const out = sanitizeForLogging({
      email: "patient@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      phone: "+15551234567",
    });
    expect(out.email).not.toContain("example.com");
    expect(out.firstName).not.toBe("Ada");
    expect(out.lastName).not.toBe("Lovelace");
    expect(out.phone).not.toContain("5551234567");
  });

  it("redacts the KYC link", () => {
    const out = sanitizeForLogging({ kycLink: "https://kyc.drgreen/abc123secret" });
    expect(out.kycLink).not.toContain("abc123secret");
  });

  it("redacts nested PII (body.email style)", () => {
    const out = sanitizeForLogging({ body: { email: "nested@example.com" } });
    expect(JSON.stringify(out)).not.toContain("nested@example.com");
  });

  it("redacts a Dr Green response so the raw payload is not dumped", () => {
    const drGreenResponse = {
      data: {
        client: {
          id: "client_123",
          email: "patient@example.com",
          kycLink: "https://kyc/secret",
          medicalRecord: { dob: "1990-01-01", medicalConditions: ["anxiety"] },
        },
      },
    };
    const out = sanitizeForLogging({ drGreenResponse });
    const serialized = JSON.stringify(out);
    // The whole response object is a redaction-set key → censored wholesale.
    expect(serialized).not.toContain("patient@example.com");
    expect(serialized).not.toContain("https://kyc/secret");
    expect(serialized).not.toContain("anxiety");
    expect(serialized).not.toContain("1990-01-01");
  });

  it("redacts special-category medical fields", () => {
    const out = sanitizeForLogging({
      medicalConditions: ["epilepsy"],
      prescribedMedications: ["med-x"],
    });
    expect(JSON.stringify(out)).not.toContain("epilepsy");
    expect(JSON.stringify(out)).not.toContain("med-x");
  });

  it("does not mutate the input object (immutability)", () => {
    const input = { email: "a@b.com", safe: "keep" };
    const out = sanitizeForLogging(input);
    expect(input.email).toBe("a@b.com"); // original untouched
    expect(out.safe).toBe("keep"); // non-sensitive passes through
    expect(out).not.toBe(input);
  });

  it("leaves non-sensitive fields intact", () => {
    const out = sanitizeForLogging({ tenantId: "t-1", status: "ok", count: 3 });
    expect(out).toEqual({ tenantId: "t-1", status: "ok", count: 3 });
  });

  it("passes through primitives and null/undefined unchanged", () => {
    expect(sanitizeForLogging("hello")).toBe("hello");
    expect(sanitizeForLogging(42)).toBe(42);
    expect(sanitizeForLogging(null)).toBeNull();
    expect(sanitizeForLogging(undefined)).toBeUndefined();
  });
});

describe("isSensitiveField + SENSITIVE_FIELDS", () => {
  it("flags the headline PHI/PII field names", () => {
    for (const f of ["email", "firstName", "phone", "address", "kycLink", "drGreenResponse"]) {
      expect(isSensitiveField(f)).toBe(true);
    }
  });

  it("does not flag benign ops fields", () => {
    for (const f of ["tenantId", "status", "correlationId", "userId"]) {
      expect(isSensitiveField(f)).toBe(false);
    }
  });
});

describe("pinoRedactPaths", () => {
  it("derives nested paths for every sensitive field (single source of truth)", () => {
    const paths = pinoRedactPaths();
    // three depth variants per field
    expect(paths.length).toBe(SENSITIVE_FIELDS.size * 3);
    expect(paths).toContain("email");
    expect(paths).toContain("*.email");
    expect(paths).toContain("*.*.email");
    expect(paths).toContain("drGreenResponse");
  });
});
