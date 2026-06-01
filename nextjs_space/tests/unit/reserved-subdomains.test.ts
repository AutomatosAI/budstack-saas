import { describe, it, expect } from "vitest";
import {
  RESERVED_SUBDOMAINS,
  isReservedSubdomain,
  isValidSubdomain,
} from "@/lib/reserved-subdomains";

// PRD-212 AC-4 — verify the `_cd` reservation (delivered by PRD-201, already on
// main) and assert it is rejected at subdomain registration/rename. Both the
// onboarding route (app/api/onboarding/route.ts) and the super-admin rename
// route (app/api/super-admin/tenants/[id]/route.ts) gate on isReservedSubdomain,
// so asserting on that function proves the rejection at the real boundary.

describe("PRD-212 AC-4 — `_cd` custom-domain placeholder is reserved", () => {
  it("is present in RESERVED_SUBDOMAINS (PRD-201 dependency, already merged)", () => {
    expect(RESERVED_SUBDOMAINS.has("_cd")).toBe(true);
  });

  it("is rejected by isReservedSubdomain (the onboarding + rename gate)", () => {
    expect(isReservedSubdomain("_cd")).toBe(true);
  });

  it("is rejected case-insensitively and with surrounding whitespace", () => {
    expect(isReservedSubdomain("_CD")).toBe(true);
    expect(isReservedSubdomain("  _cd  ")).toBe(true);
  });

  it("also fails the subdomain format check (leading underscore is not a valid charset)", () => {
    // Defense-in-depth: even without the reservation, `_cd` can never be
    // registered because the charset forbids a leading underscore.
    expect(isValidSubdomain("_cd")).toBe(false);
  });

  it("still permits ordinary tenant subdomains (no over-broad reservation)", () => {
    expect(isReservedSubdomain("healingbuds")).toBe(false);
    expect(isReservedSubdomain("tenant-a")).toBe(false);
  });
});
