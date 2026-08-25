import { describe, expect, it } from "vitest";

import { emailsMatch } from "@/lib/security/email-ownership";

/**
 * The comparison behind every ownership decision on a public endpoint.
 * The decision itself (who may touch a pre-existing account) is exercised
 * against the real handler in consultation-submit-ownership.test.ts — an
 * earlier version of this suite tested a helper in isolation and a regex over
 * the route's source, and both passed while the route was still exploitable.
 */
describe("emailsMatch", () => {
  it("compares case- and whitespace-insensitively", () => {
    expect(emailsMatch("Ann@Example.com", " ann@example.com ")).toBe(true);
  });

  it("never matches on a missing side", () => {
    expect(emailsMatch(null, "ann@example.com")).toBe(false);
    expect(emailsMatch(undefined, "ann@example.com")).toBe(false);
    expect(emailsMatch("", "ann@example.com")).toBe(false);
    expect(emailsMatch("   ", "ann@example.com")).toBe(false);
    expect(emailsMatch("ann@example.com", null)).toBe(false);
    expect(emailsMatch(null, null)).toBe(false);
  });

  it("does not treat different addresses as equal", () => {
    expect(emailsMatch("ann@example.com", "ann@example.co")).toBe(false);
    expect(emailsMatch("ann+tag@example.com", "ann@example.com")).toBe(false);
    expect(emailsMatch("ann@example.com", "anne@example.com")).toBe(false);
  });
});
