import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * SEO Supercharge US-026 — the route behind the Verification tab.
 *
 * The properties this file exists to hold:
 *
 *  1. GATING IN THE UI IS NOT GATING. A Basic tenant PUTting by hand gets 403
 *     `upgrade_required` and writes nothing; a member without `canEditSeo` is
 *     refused BEFORE the plan is looked up, so they never learn the store's plan.
 *  2. THREE KEYS, AND NOTHING THAT CARRIES MARKUP. `.strict()` refuses any other
 *     key, and each value has to be a token of its own kind.
 *  3. THE MERGE IS NON-DESTRUCTIVE. `tenants.settings` holds the whole storefront
 *     configuration; a save here touches the keys it was sent and nothing else —
 *     including keys this version of the platform has never heard of.
 *  4. THE AUDIT ROW RECORDS THAT IT CHANGED, NOT WHAT IT CHANGED TO.
 *
 * Module-boundary mocks only (getCurrentUser, prisma, permission resolution).
 * The real auth wrapper, the real permission gate, the real `requireFeature` and
 * the real validation all execute. Mirrors tests/unit/seo-redirect-routes.test.ts.
 */
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { resolveUserPermissions } = vi.hoisted(() => ({
  resolveUserPermissions: vi.fn(),
}));
const prismaMock = vi.hoisted(() => ({
  tenants: { findFirst: vi.fn(), update: vi.fn() },
  audit_logs: { create: vi.fn() },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/permissions/current-user-permissions", () => ({
  resolveUserPermissions,
}));

import { AUDIT_ACTIONS } from "@/lib/audit-log";
import { UPGRADE_REQUIRED_CODE } from "@/lib/entitlements/require-feature";
import { PUT as saveVerification } from "@/app/api/tenant-admin/seo/verification/route";

const TENANT_A = "tenant-a";
const GOOGLE_TOKEN = "AbCdEf0123456789_-AbCdEf0123456789_-AbCdEfg";
const BING_TOKEN = "0123456789ABCDEF0123456789ABCDEF";
const GA4_ID = "G-AB12CD34EF";

/** The settings blob a live tenant actually has — most of it nothing to do with SEO. */
const EXISTING_SETTINGS = {
  businessName: "Acme Cannabis Co",
  primaryColor: "#00ff00",
  smtp: { host: "smtp.example.dev", port: 587 },
  aKeyThisVersionHasNeverHeardOf: { nested: true },
};

function adminUser() {
  return {
    id: "admin_1",
    email: "admin@store.dev",
    name: "Admin",
    image: "",
    role: "TENANT_ADMIN",
    tenantId: TENANT_A,
    clerkOrgId: null,
  };
}

function put(body: unknown) {
  return new NextRequest("http://localhost/api/tenant-admin/seo/verification", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** The row both `getTenantPlan` and the settings read see. */
function onPlan(plan: string, settings: unknown = EXISTING_SETTINGS) {
  prismaMock.tenants.findFirst.mockResolvedValue({ id: TENANT_A, plan, settings });
}

/** The settings object the route wrote. */
function writtenSettings(): Record<string, unknown> {
  expect(prismaMock.tenants.update).toHaveBeenCalledTimes(1);
  return prismaMock.tenants.update.mock.calls[0][0].data.settings;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue(adminUser());
  resolveUserPermissions.mockResolvedValue({
    permissions: { canViewSeo: true, canEditSeo: true },
    teamRole: "OWNER",
  });
  onPlan("pro");
  prismaMock.tenants.update.mockResolvedValue({});
  prismaMock.audit_logs.create.mockResolvedValue({});
});

describe("PUT /api/tenant-admin/seo/verification — the two gates", () => {
  it("saves for an entitled member and answers with what was stored", async () => {
    const response = await saveVerification(
      put({
        googleSiteVerification: GOOGLE_TOKEN,
        bingSiteVerification: BING_TOKEN,
        ga4MeasurementId: GA4_ID,
      }),
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.verification).toEqual({
      googleSiteVerification: GOOGLE_TOKEN,
      bingSiteVerification: BING_TOKEN,
      ga4MeasurementId: GA4_ID,
    });
  });

  it("refuses a Basic tenant with upgrade_required, and writes nothing", async () => {
    onPlan("basic");
    const response = await saveVerification(
      put({ googleSiteVerification: GOOGLE_TOKEN }),
    );
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.code).toBe(UPGRADE_REQUIRED_CODE);
    expect(body.feature).toBe("seo.pro");
    expect(prismaMock.tenants.update).not.toHaveBeenCalled();
  });

  it("refuses a member without canEditSeo before the plan is ever read", async () => {
    resolveUserPermissions.mockResolvedValue({
      permissions: { canViewSeo: true, canEditSeo: false },
      teamRole: "STAFF",
    });

    const response = await saveVerification(
      put({ googleSiteVerification: GOOGLE_TOKEN }),
    );
    expect(response.status).toBe(403);

    const body = await response.json();
    // "Ask your admin", not "buy the plan": no plan and no upgrade code.
    expect(body.code).toBeUndefined();
    expect(body.plan).toBeUndefined();
    expect(prismaMock.tenants.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.tenants.update).not.toHaveBeenCalled();
  });

  it("unlocks the trial tenant, like every other Pro surface", async () => {
    onPlan("trial");
    const response = await saveVerification(put({ ga4MeasurementId: GA4_ID }));
    expect(response.status).toBe(200);
  });
});

describe("PUT /api/tenant-admin/seo/verification — what it will accept", () => {
  it("reduces a pasted meta tag to its token", async () => {
    const response = await saveVerification(
      put({
        googleSiteVerification: `<meta name="google-site-verification" content="${GOOGLE_TOKEN}" />`,
      }),
    );
    expect(response.status).toBe(200);
    expect(writtenSettings().googleSiteVerification).toBe(GOOGLE_TOKEN);
  });

  it("names the field it refused, and writes nothing", async () => {
    const response = await saveVerification(
      put({ ga4MeasurementId: "UA-12345-1" }),
    );
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.code).toBe("invalid_field");
    expect(body.field).toBe("ga4MeasurementId");
    expect(body.error).toContain("G-XXXXXXXXXX");
    expect(prismaMock.tenants.update).not.toHaveBeenCalled();
  });

  it("refuses markup in a verification field", async () => {
    const response = await saveVerification(
      put({ googleSiteVerification: "<script>alert(1)</script>" }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).field).toBe("googleSiteVerification");
    expect(prismaMock.tenants.update).not.toHaveBeenCalled();
  });

  it("refuses any key that is not one of the three", async () => {
    // The head-HTML box this story exists not to build, posted by hand.
    const response = await saveVerification(
      put({ headHtml: "<script src='https://evil.example'></script>" }),
    );
    expect(response.status).toBe(400);
    expect(prismaMock.tenants.update).not.toHaveBeenCalled();
  });

  it("refuses a token past the field's cap before it reaches the column", async () => {
    const response = await saveVerification(
      put({ googleSiteVerification: "a".repeat(500) }),
    );
    expect(response.status).toBe(400);
    expect(prismaMock.tenants.update).not.toHaveBeenCalled();
  });
});

describe("PUT /api/tenant-admin/seo/verification — the merge", () => {
  it("leaves every other settings key exactly as it found it", async () => {
    await saveVerification(put({ ga4MeasurementId: GA4_ID }));

    const settings = writtenSettings();
    expect(settings).toMatchObject(EXISTING_SETTINGS);
    expect(settings.ga4MeasurementId).toBe(GA4_ID);
  });

  it("leaves the fields it was not sent alone", async () => {
    onPlan("pro", {
      ...EXISTING_SETTINGS,
      googleSiteVerification: GOOGLE_TOKEN,
      bingSiteVerification: BING_TOKEN,
    });

    await saveVerification(put({ ga4MeasurementId: GA4_ID }));

    const settings = writtenSettings();
    expect(settings.googleSiteVerification).toBe(GOOGLE_TOKEN);
    expect(settings.bingSiteVerification).toBe(BING_TOKEN);
  });

  it("clears a field to null when it is sent empty", async () => {
    onPlan("pro", { ...EXISTING_SETTINGS, googleSiteVerification: GOOGLE_TOKEN });

    const response = await saveVerification(
      put({ googleSiteVerification: "" }),
    );
    expect(response.status).toBe(200);
    expect(writtenSettings().googleSiteVerification).toBeNull();
    expect((await response.json()).verification.googleSiteVerification).toBe("");
  });

  it("survives a tenant whose settings column is null", async () => {
    onPlan("pro", null);

    const response = await saveVerification(put({ ga4MeasurementId: GA4_ID }));
    expect(response.status).toBe(200);
    expect(writtenSettings()).toEqual({ ga4MeasurementId: GA4_ID });
  });

  it("404s a tenant row that is not there, without writing", async () => {
    // The plan lookup fails closed to basic on a missing row, so reaching the
    // settings read at all means the plan resolved — this is the row vanishing
    // between the two.
    prismaMock.tenants.findFirst
      .mockResolvedValueOnce({ id: TENANT_A, plan: "pro" })
      .mockResolvedValueOnce(null);

    const response = await saveVerification(put({ ga4MeasurementId: GA4_ID }));
    expect(response.status).toBe(404);
    expect(prismaMock.tenants.update).not.toHaveBeenCalled();
  });
});

describe("PUT /api/tenant-admin/seo/verification — the audit row", () => {
  it("records which fields changed, and never the values", async () => {
    await saveVerification(
      put({ googleSiteVerification: GOOGLE_TOKEN, ga4MeasurementId: "" }),
    );

    expect(prismaMock.audit_logs.create).toHaveBeenCalledTimes(1);
    const row = prismaMock.audit_logs.create.mock.calls[0][0].data;
    expect(row.action).toBe(AUDIT_ACTIONS.SEO_VERIFICATION_UPDATED);
    expect(row.tenantId).toBe(TENANT_A);
    expect(row.metadata.fields).toEqual([
      "googleSiteVerification",
      "ga4MeasurementId",
    ]);
    expect(row.metadata.cleared).toEqual(["ga4MeasurementId"]);
    expect(JSON.stringify(row)).not.toContain(GOOGLE_TOKEN);
  });

  it("writes no audit row for a request that was refused", async () => {
    onPlan("basic");
    await saveVerification(put({ googleSiteVerification: GOOGLE_TOKEN }));
    expect(prismaMock.audit_logs.create).not.toHaveBeenCalled();
  });
});
