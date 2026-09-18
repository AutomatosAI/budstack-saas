import { describe, expect, it } from "vitest";

import {
  CUSTOMER_TITLES,
  isCustomerTitle,
  normaliseCustomerTitle,
} from "@/lib/customers/titles";
import {
  CONSENT_SOURCE,
  isExplicitConsent,
  marketingConsentCopy,
} from "@/lib/customers/marketing-consent";

describe("customer titles (BS-303)", () => {
  it("is the Dr Green list, in order", () => {
    expect([...CUSTOMER_TITLES]).toEqual(["Mr", "Mrs", "Ms", "Mx", "Dr", "Prof"]);
  });

  it("normalises a submitted value to the list or null", () => {
    expect(normaliseCustomerTitle("Dr")).toBe("Dr");
    expect(normaliseCustomerTitle(" Ms ")).toBe("Ms");
    expect(normaliseCustomerTitle("")).toBeNull();
    expect(normaliseCustomerTitle("none")).toBeNull();
    expect(normaliseCustomerTitle("Sir")).toBeNull();
    expect(normaliseCustomerTitle(undefined)).toBeNull();
    expect(normaliseCustomerTitle(42)).toBeNull();
    expect(isCustomerTitle("Prof")).toBe(true);
    expect(isCustomerTitle("prof")).toBe(false);
  });
});

describe("marketing consent (BS-302)", () => {
  it("names the four sources BudStacks attributes consent to", () => {
    expect(Object.values(CONSENT_SOURCE)).toEqual([
      "budstacks-consultation",
      "budstacks-id-upload",
      "budstacks-shop-register",
      "budstacks-settings",
    ]);
  });

  it("reads the store name into the copy, with a fallback", () => {
    expect(marketingConsentCopy("Lekker Weed")).toBe(
      "Keep me informed about products and offers from Lekker Weed by email or SMS",
    );
    expect(marketingConsentCopy("  ")).toBe(
      "Keep me informed about products and offers from this store by email or SMS",
    );
    expect(marketingConsentCopy(undefined)).toMatch(/from this store/);
  });

  it("treats only an explicit true as consent", () => {
    expect(isExplicitConsent(true)).toBe(true);
    for (const v of [false, "true", 1, undefined, null, {}]) {
      expect(isExplicitConsent(v)).toBe(false);
    }
  });
});
