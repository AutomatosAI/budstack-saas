import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { canClaimAccount, emailsMatch } from "@/lib/security/email-ownership";

/**
 * Account-takeover guard for the public consultation signup.
 *
 * The hole this closes: `POST /api/consultation/submit` is unauthenticated
 * (it IS the signup), and it used to swallow Clerk's "email already exists"
 * and carry on against the existing account — ending in a write that pointed
 * that user's `drGreenClientId`/`tenantId` at the caller's freshly created
 * Dr Green client. An attacker submitting a victim's address, then getting
 * their own genuine ID approved, would have the victim's account inherit
 * VERIFIED — and with status webhooks live, in near real time.
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
  });

  it("does not treat different addresses as equal", () => {
    expect(emailsMatch("ann@example.com", "ann@example.co")).toBe(false);
    expect(emailsMatch("ann+tag@example.com", "ann@example.com")).toBe(false);
  });
});

describe("canClaimAccount", () => {
  it("REFUSES the takeover case: anonymous caller, address already taken", () => {
    expect(
      canClaimAccount({
        accountJustCreated: false,
        sessionEmail: null,
        submittedEmail: "victim@example.com",
      }),
    ).toBe(false);
  });

  it("REFUSES a signed-in caller submitting someone else's address", () => {
    expect(
      canClaimAccount({
        accountJustCreated: false,
        sessionEmail: "attacker@example.com",
        submittedEmail: "victim@example.com",
      }),
    ).toBe(false);
  });

  it("allows a brand-new account (the identity provider vouched nobody held it)", () => {
    expect(
      canClaimAccount({
        accountJustCreated: true,
        sessionEmail: null,
        submittedEmail: "new@example.com",
      }),
    ).toBe(true);
  });

  it("allows a signed-in caller completing their own consultation", () => {
    expect(
      canClaimAccount({
        accountJustCreated: false,
        sessionEmail: "Ann@Example.com",
        submittedEmail: "ann@example.com",
      }),
    ).toBe(true);
  });
});

/**
 * Static regression guard, in the same spirit as the Article 9 persistence
 * check: the rule above only protects anything if the route actually applies
 * it to the write that links a user row to a Dr Green client.
 */
describe("consultation submit route wiring", () => {
  const source = readFileSync(
    join(process.cwd(), "app/api/consultation/submit/route.ts"),
    "utf8",
  );

  it("gates the Dr Green client-id linking write on proven ownership", () => {
    expect(source).toMatch(/if\s*\(\s*userId\s*&&\s*callerOwnsAccount\s*\)/);
  });

  it("refuses, rather than silently reuses, an existing Clerk account", () => {
    expect(source).toContain("form_identifier_exists");
    expect(source).toMatch(/canClaimAccount\s*\(/);
    // The pre-fix comment that marked the vulnerable "carry on anyway" path.
    expect(source).not.toContain("for now we proceed");
  });
});
