import { describe, expect, it } from "vitest";

import {
  getTenantVerificationMode,
  isSaIdEligibleTenant,
} from "@/lib/verification-mode";

describe("getTenantVerificationMode", () => {
  it("defaults to KYC when nothing is set", () => {
    expect(getTenantVerificationMode({ countryCode: "ZA" })).toBe("KYC");
  });

  it("returns ID_UPLOAD for a ZA tenant that opted in", () => {
    expect(
      getTenantVerificationMode({
        countryCode: "ZA",
        settings: { verificationMode: "ID_UPLOAD" },
      }),
    ).toBe("ID_UPLOAD");
  });

  it("forces KYC for non-ZA tenants even when settings say ID_UPLOAD", () => {
    expect(
      getTenantVerificationMode({
        countryCode: "PT",
        settings: { verificationMode: "ID_UPLOAD" },
      }),
    ).toBe("KYC");
  });

  it("is case-insensitive on countryCode", () => {
    expect(
      getTenantVerificationMode({
        countryCode: "za",
        settings: { verificationMode: "ID_UPLOAD" },
      }),
    ).toBe("ID_UPLOAD");
  });

  it("treats unknown/garbage settings values as KYC", () => {
    expect(
      getTenantVerificationMode({
        countryCode: "ZA",
        settings: { verificationMode: "garbage" },
      }),
    ).toBe("KYC");
  });

  it("handles missing settings/countryCode safely", () => {
    expect(getTenantVerificationMode({})).toBe("KYC");
    expect(getTenantVerificationMode({ countryCode: null })).toBe("KYC");
  });
});

describe("isSaIdEligibleTenant", () => {
  it("is true only for South-African tenants", () => {
    expect(isSaIdEligibleTenant({ countryCode: "ZA" })).toBe(true);
    expect(isSaIdEligibleTenant({ countryCode: "za" })).toBe(true);
    expect(isSaIdEligibleTenant({ countryCode: "PT" })).toBe(false);
    expect(isSaIdEligibleTenant({})).toBe(false);
  });
});
