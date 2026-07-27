import { describe, expect, it } from "vitest";
import { decide, enforcementDate, isEnforcing } from "@/lib/legal/policy-gate";

/**
 * WS2 US-010 — the gate on collecting personal data with no published notice.
 *
 * The property that matters most is that deploying this changes nothing until
 * someone deliberately sets a date. Enforcing on deploy would stop live
 * storefronts taking orders: a self-inflicted outage in the name of compliance.
 */

const PAST = { LEGAL_POLICY_ENFORCEMENT_DATE: "2026-01-01" } as NodeJS.ProcessEnv;
const FUTURE = { LEGAL_POLICY_ENFORCEMENT_DATE: "2099-01-01" } as NodeJS.ProcessEnv;
const UNSET = {} as NodeJS.ProcessEnv;
const NOW = new Date("2026-07-27T12:00:00Z");

describe("enforcementDate", () => {
  it("is null when unset", () => {
    expect(enforcementDate(UNSET)).toBeNull();
  });

  it("is null when blank", () => {
    expect(
      enforcementDate({ LEGAL_POLICY_ENFORCEMENT_DATE: "   " } as NodeJS.ProcessEnv),
    ).toBeNull();
  });

  it("is null — not a crash — when the value is nonsense", () => {
    expect(
      enforcementDate({ LEGAL_POLICY_ENFORCEMENT_DATE: "soon" } as NodeJS.ProcessEnv),
    ).toBeNull();
  });

  it("parses a valid date", () => {
    expect(enforcementDate(PAST)?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("isEnforcing", () => {
  it("is off when no date is configured", () => {
    expect(isEnforcing(NOW, UNSET)).toBe(false);
  });

  it("is off before the date", () => {
    expect(isEnforcing(NOW, FUTURE)).toBe(false);
  });

  it("is on once the date has passed", () => {
    expect(isEnforcing(NOW, PAST)).toBe(true);
  });
});

describe("decide", () => {
  it("allows a tenant with a published policy", () => {
    expect(decide(true, NOW, PAST)).toEqual({ allowed: true, published: true });
  });

  it("allows an unpublished tenant while enforcement is unconfigured", () => {
    // The deploy-safety property: shipping this must not block anyone.
    expect(decide(false, NOW, UNSET)).toEqual({ allowed: true, published: false });
  });

  it("allows an unpublished tenant before the enforcement date", () => {
    expect(decide(false, NOW, FUTURE)).toEqual({ allowed: true, published: false });
  });

  it("blocks an unpublished tenant once enforcement begins", () => {
    const result = decide(false, NOW, PAST);
    expect(result.allowed).toBe(false);
    expect(result.allowed === false && result.reason).toContain("privacy policy");
  });

  it("still allows a published tenant after enforcement begins", () => {
    expect(decide(true, NOW, PAST).allowed).toBe(true);
  });
});
