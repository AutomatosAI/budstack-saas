import { describe, expect, it } from "vitest";

import { buildTenantDomains } from "@/lib/integrations/automatos-provision";

describe("buildTenantDomains (US-008/US-009)", () => {
  it("subdomain only — platform host alone", () => {
    expect(buildTenantDomains("healingbuds", null, "budstacks.io")).toEqual([
      "healingbuds.budstacks.io",
    ]);
  });

  it("custom domain adds apex + www twin", () => {
    expect(
      buildTenantDomains("healingbuds", "healingbuds.co.za", "budstacks.io"),
    ).toEqual([
      "healingbuds.budstacks.io",
      "healingbuds.co.za",
      "www.healingbuds.co.za",
    ]);
  });

  it("www custom domain normalizes to apex + www (no www.www)", () => {
    expect(
      buildTenantDomains("healingbuds", "www.healingbuds.co.za", "budstacks.io"),
    ).toEqual([
      "healingbuds.budstacks.io",
      "healingbuds.co.za",
      "www.healingbuds.co.za",
    ]);
  });

  it("strips scheme and paths from a pasted URL", () => {
    expect(
      buildTenantDomains("hb", "https://healingbuds.co.za/shop", "budstacks.io"),
    ).toEqual(["hb.budstacks.io", "healingbuds.co.za", "www.healingbuds.co.za"]);
  });

  it("dedupes when the custom domain equals the platform host", () => {
    expect(
      buildTenantDomains("hb", "hb.budstacks.io", "budstacks.io"),
    ).toEqual(["hb.budstacks.io", "www.hb.budstacks.io"]);
  });
});
