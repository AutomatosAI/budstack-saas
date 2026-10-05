import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AFFILIATE_CODE_SOURCE,
  affiliatePayloadFields,
  resolveAffiliateAttribution,
} from "@/lib/affiliate/affiliate-code";
import {
  affiliateCodeField,
  parseSignUpWithOptionalAffiliateCode,
} from "@/lib/affiliate/affiliate-code-schema";

/**
 * BS-A02 — which code is forwarded and how it is attributed. The submitted
 * field is the only source of the code; the bs_ref cookie decides link vs
 * typed. A malformed code is a field error, never a failed registration.
 */
describe("resolveAffiliateAttribution", () => {
  it("link-only: the pre-filled code left as it was is attributed to the link", () => {
    expect(resolveAffiliateAttribution("TEST-CODE", "TEST-CODE")).toEqual({
      affiliateCode: "TEST-CODE",
      affiliateCodeSource: AFFILIATE_CODE_SOURCE.LINK,
    });
  });

  it("matches the remembered code case-insensitively and forwards it upper-cased", () => {
    expect(resolveAffiliateAttribution(" test-code ", "TEST-CODE")).toEqual({
      affiliateCode: "TEST-CODE",
      affiliateCodeSource: "link",
    });
  });

  it("typed-overrides-link: a different code wins and is attributed as typed", () => {
    expect(resolveAffiliateAttribution("MY-OWN-CODE", "TEST-CODE")).toEqual({
      affiliateCode: "MY-OWN-CODE",
      affiliateCodeSource: "typed",
    });
  });

  it("a code typed with no landing cookie is typed", () => {
    expect(resolveAffiliateAttribution("TYPED1", undefined)?.affiliateCodeSource).toBe("typed");
  });

  it("a cleared field sends nothing, even with a landing cookie", () => {
    expect(resolveAffiliateAttribution("", "TEST-CODE")).toBeNull();
    expect(resolveAffiliateAttribution(undefined, "TEST-CODE")).toBeNull();
  });

  it("a malformed code sends nothing", () => {
    expect(resolveAffiliateAttribution("AB", "TEST-CODE")).toBeNull();
    expect(resolveAffiliateAttribution("AB/CD", undefined)).toBeNull();
  });

  it("a tampered cookie cannot turn a typed code into a link", () => {
    expect(resolveAffiliateAttribution("TEST-CODE", "test code")?.affiliateCodeSource).toBe("typed");
  });
});

describe("affiliatePayloadFields", () => {
  it("returns both fields together for a code and a known source", () => {
    expect(affiliatePayloadFields({ affiliateCode: "TEST-CODE", affiliateCodeSource: "link" })).toEqual({
      affiliateCode: "TEST-CODE",
      affiliateCodeSource: "link",
    });
  });

  it("returns nothing when either is missing or invalid", () => {
    expect(affiliatePayloadFields({})).toEqual({});
    expect(affiliatePayloadFields({ affiliateCode: null, affiliateCodeSource: null })).toEqual({});
    expect(affiliatePayloadFields({ affiliateCode: "TEST-CODE" })).toEqual({});
    expect(affiliatePayloadFields({ affiliateCode: "TEST-CODE", affiliateCodeSource: "other" })).toEqual({});
    expect(affiliatePayloadFields({ affiliateCode: "AB", affiliateCodeSource: "typed" })).toEqual({});
  });
});

describe("parseSignUpWithOptionalAffiliateCode", () => {
  const schema = z.object({
    email: z.string().email(),
    affiliateCode: affiliateCodeField,
  });

  it("passes a well-formed code through, trimmed", () => {
    const { result, affiliateCodeIssue } = parseSignUpWithOptionalAffiliateCode(schema, {
      email: "a@example.com",
      affiliateCode: " test-code ",
    });
    expect(result.success && result.data.affiliateCode).toBe("test-code");
    expect(affiliateCodeIssue).toBeNull();
  });

  it("accepts an empty field and an absent field", () => {
    expect(parseSignUpWithOptionalAffiliateCode(schema, { email: "a@example.com", affiliateCode: "" }).result.success).toBe(true);
    expect(parseSignUpWithOptionalAffiliateCode(schema, { email: "a@example.com" }).result.success).toBe(true);
  });

  it("malformed typed code: a field error on affiliateCode, and the rest still parses", () => {
    const { result, affiliateCodeIssue } = parseSignUpWithOptionalAffiliateCode(schema, {
      email: "a@example.com",
      affiliateCode: "AB",
    });
    expect(affiliateCodeIssue?.path[0]).toBe("affiliateCode");
    expect(result.success).toBe(true);
    expect(result.success && "affiliateCode" in result.data).toBe(false);
  });

  it("rejects a code over 20 characters as a field error, not a failed parse", () => {
    const { result, affiliateCodeIssue } = parseSignUpWithOptionalAffiliateCode(schema, {
      email: "a@example.com",
      affiliateCode: "A".repeat(21),
    });
    expect(affiliateCodeIssue).not.toBeNull();
    expect(result.success).toBe(true);
  });

  it("still fails on any other invalid field, reporting that field", () => {
    const { result } = parseSignUpWithOptionalAffiliateCode(schema, {
      email: "not-an-email",
      affiliateCode: "AB",
    });
    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues.map((i) => i.path[0])).toEqual(["email"]);
  });
});
