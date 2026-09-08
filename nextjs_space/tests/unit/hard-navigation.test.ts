import { describe, expect, it } from "vitest";

import { needsFullDocument, shouldFullLoad } from "@/lib/admin/hard-navigation";

/**
 * The analytics pages carry a wider CSP ('unsafe-eval' for plotly) than the
 * rest of the admin. A policy belongs to the document, so links into and out
 * of those pages must be full loads — the same trap that blocked the guide
 * videos on /documents (PR #278), applied to scripts instead of frames.
 */
describe("needsFullDocument", () => {
  it("recognises both analytics routes, with sub-paths and query strings", () => {
    expect(needsFullDocument("/tenant-admin/analytics")).toBe(true);
    expect(needsFullDocument("/super-admin/analytics")).toBe(true);
    expect(needsFullDocument("/tenant-admin/analytics/retention")).toBe(true);
    expect(needsFullDocument("/tenant-admin/analytics?period=30d")).toBe(true);
  });

  it("leaves every other admin route on client-side navigation", () => {
    expect(needsFullDocument("/tenant-admin")).toBe(false);
    expect(needsFullDocument("/tenant-admin/analytics-export")).toBe(false);
    expect(needsFullDocument("/tenant-admin/orders")).toBe(false);
    expect(needsFullDocument("/super-admin/tenants")).toBe(false);
  });
});

describe("shouldFullLoad", () => {
  it("forces a full load INTO analytics from an ordinary page", () => {
    expect(shouldFullLoad("/tenant-admin/orders", "/tenant-admin/analytics")).toBe(true);
  });

  it("forces a full load OUT of analytics so the wider policy does not travel", () => {
    expect(shouldFullLoad("/tenant-admin/analytics", "/tenant-admin/orders")).toBe(true);
  });

  it("keeps ordinary admin links client-side", () => {
    expect(shouldFullLoad("/tenant-admin/orders", "/tenant-admin/customers")).toBe(false);
    expect(shouldFullLoad(null, "/tenant-admin/customers")).toBe(false);
  });
});
