import { describe, it, expect, vi, beforeEach } from "vitest";

// withAuth → identity wrapper so the handlers are the raw (req, {user}, {slug}) form.
vi.mock("@/lib/api-auth", () => ({ withAuth: (h: any) => h }));
vi.mock("@/lib/validation/parse-uuid", () => ({ parseSlug: vi.fn() }));
vi.mock("@/lib/tenant/tenant", () => ({ getCurrentTenant: vi.fn() }));
vi.mock("@/lib/tenant/tenant-config", () => ({
  getTenantDrGreenConfig: vi.fn(async () => ({
    apiKey: "k",
    secretKey: "s",
    apiUrl: "https://stage/api/v1",
  })),
}));
vi.mock("@/lib/db", () => ({
  prisma: { users: { findFirst: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn(async () => undefined),
  getClientInfo: () => ({ ipAddress: "203.0.113.9", userAgent: "vitest" }),
  AUDIT_ACTIONS: {
    CUSTOMER_MARKETING_CONSENT_GRANTED: "customer.marketing_consent_granted",
    CUSTOMER_MARKETING_CONSENT_REVOKED: "customer.marketing_consent_revoked",
  },
}));
// The real apiError lets an ApiError (parseJsonBody's 400) keep its own status.
vi.mock("@/lib/api-error", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-error")>();
  return {
    ...original,
    apiError: (e: any, o: any) =>
      new Response(
        JSON.stringify({ error: e?.safeForClient ? e.message : (o?.safeMessage ?? "error") }),
        {
          status: e?.safeForClient ? e.status : (o?.status ?? 500),
          headers: { "content-type": "application/json" },
        },
      ),
  };
});
// Keep the REAL mapDrGreenApiError (its mapping is part of what this tests);
// stub only the network call.
vi.mock("@/lib/drgreen-identity", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/drgreen-identity")>()),
  updateClientMarketingConsent: vi.fn(),
}));

import { GET, PATCH } from "@/app/api/store/[slug]/consent/route";
import { getCurrentTenant } from "@/lib/tenant/tenant";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { updateClientMarketingConsent } from "@/lib/drgreen-identity";
import { CONSENT_SOURCE } from "@/lib/customers/marketing-consent";

/**
 * BS-304 — the customer's own consent toggle. The local column is written
 * first and always (it gates every BudStacks campaign); Dr Green is updated
 * best-effort and the response says whether that landed.
 */
const TENANT = { id: "tenant-1", countryCode: "ZA", settings: {} };
const CONSENTED_AT = new Date("2026-09-01T10:00:00Z");

const patchReq = (body: unknown) =>
  new Request("https://store.test/api/store/s/consent", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as any;

const getReq = () =>
  new Request("https://store.test/api/store/s/consent", { method: "GET" }) as any;

type SessionUser = { id: string; email: string | null };
const ctx: { user: SessionUser } = {
  user: { id: "user_clerk", email: "t@example.com" },
};
const patch = (body: unknown, user = ctx.user) =>
  (PATCH as any)(patchReq(body), { user }, { slug: "s" });
const get = (user = ctx.user) => (GET as any)(getReq(), { user }, { slug: "s" });

beforeEach(() => {
  vi.clearAllMocks();
  (getCurrentTenant as any).mockResolvedValue(TENANT);
  (prisma.users.findFirst as any).mockResolvedValue({
    id: "u1",
    email: "t@example.com",
    drGreenClientId: "dg-1",
    marketingConsentAt: null,
  });
  (prisma.users.update as any).mockResolvedValue({});
  (updateClientMarketingConsent as any).mockResolvedValue(undefined);
});

describe("GET /api/store/[slug]/consent", () => {
  it("returns the caller's own consent state", async () => {
    (prisma.users.findFirst as any).mockResolvedValue({ marketingConsentAt: CONSENTED_AT });
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      marketingConsent: true,
      marketingConsentAt: CONSENTED_AT.toISOString(),
    });
  });

  it("reads consent as false when the column is null", async () => {
    (prisma.users.findFirst as any).mockResolvedValue({ marketingConsentAt: null });
    expect(await (await get()).json()).toEqual({
      marketingConsent: false,
      marketingConsentAt: null,
    });
  });

  it("404s when the account has no local row", async () => {
    (prisma.users.findFirst as any).mockResolvedValue(null);
    expect((await get()).status).toBe(404);
  });

  it("401s without an email on the session", async () => {
    expect((await get({ id: "x", email: null })).status).toBe(401);
  });
});

describe("PATCH /api/store/[slug]/consent", () => {
  it("grants: writes the column and source, audits, forwards to Dr Green", async () => {
    const res = await patch({ consent: true });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.marketingConsent).toBe(true);
    expect(body.marketingConsentAt).toEqual(expect.any(String));
    expect(body.forwarded).toBe(true);
    expect(body.warning).toBeUndefined();

    expect(prisma.users.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: {
        marketingConsentAt: expect.any(Date),
        marketingConsentSource: CONSENT_SOURCE.STORE_SETTINGS,
        updatedAt: expect.any(Date),
      },
    });
    expect(updateClientMarketingConsent).toHaveBeenCalledWith({
      clientId: "dg-1",
      consent: true,
      consentSource: CONSENT_SOURCE.STORE_SETTINGS,
      config: { apiKey: "k", secretKey: "s" },
      baseUrl: "https://stage/api/v1",
    });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "customer.marketing_consent_granted",
        entityId: "u1",
        userId: "u1",
        tenantId: "tenant-1",
        metadata: expect.objectContaining({ source: CONSENT_SOURCE.STORE_SETTINGS }),
      }),
    );
  });

  it("withdraws: clears the column, audits the revocation, forwards consent:false", async () => {
    (prisma.users.findFirst as any).mockResolvedValue({
      id: "u1",
      email: "t@example.com",
      drGreenClientId: "dg-1",
      marketingConsentAt: CONSENTED_AT,
    });
    const res = await patch({ consent: false });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      marketingConsent: false,
      marketingConsentAt: null,
      forwarded: true,
    });
    expect(prisma.users.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: {
        marketingConsentAt: null,
        marketingConsentSource: CONSENT_SOURCE.STORE_SETTINGS,
        updatedAt: expect.any(Date),
      },
    });
    expect(updateClientMarketingConsent).toHaveBeenCalledWith(
      expect.objectContaining({ consent: false }),
    );
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "customer.marketing_consent_revoked",
        metadata: expect.objectContaining({
          previousConsentAt: CONSENTED_AT.toISOString(),
          newConsentAt: null,
        }),
      }),
    );
  });

  it("keeps the local withdrawal when Dr Green 404s (route not released / client unknown)", async () => {
    (updateClientMarketingConsent as any).mockRejectedValue(
      new Error("Doctor Green API Error: 404 Not Found - {\"message\":\"Cannot PATCH /api/v1/dapp/clients/dg-1/marketing-consent\"}"),
    );
    const res = await patch({ consent: false });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.marketingConsent).toBe(false);
    expect(body.forwarded).toBe(false);
    expect(body.warning).toMatch(/saved for this store/);
    // The local write and the audit row happened regardless.
    expect(prisma.users.update).toHaveBeenCalledTimes(1);
    expect(createAuditLog).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      "[Consent] Dr Green did not take the consent change",
      expect.objectContaining({ status: 404, consent: false }),
    );
  });

  it("surfaces Dr Green's customer-safe 409 reason in the warning", async () => {
    (updateClientMarketingConsent as any).mockRejectedValue(
      new Error('Doctor Green API Error: 409 Conflict - {"success":false,"statusCode":409,"message":"Client is not active"}'),
    );
    const body = await (await patch({ consent: true })).json();
    expect(body.forwarded).toBe(false);
    expect(body.warning).toMatch(/Client is not active/);
  });

  it("is local-only for an account with no Dr Green client", async () => {
    (prisma.users.findFirst as any).mockResolvedValue({
      id: "u1",
      email: "t@example.com",
      drGreenClientId: null,
      marketingConsentAt: null,
    });
    const body = await (await patch({ consent: true })).json();
    expect(body.marketingConsent).toBe(true);
    expect(body.forwarded).toBe(false);
    expect(body.warning).toBeUndefined();
    expect(updateClientMarketingConsent).not.toHaveBeenCalled();
    expect(prisma.users.update).toHaveBeenCalledTimes(1);
  });

  it("400s on a body that is not { consent: boolean } and writes nothing", async () => {
    for (const bad of [{ consent: "yes" }, {}, { consent: true, extra: 1 }, "not json"]) {
      (prisma.users.update as any).mockClear();
      const res = await patch(bad);
      expect(res.status).toBe(400);
      expect(prisma.users.update).not.toHaveBeenCalled();
    }
  });

  it("404s when the tenant cannot be resolved", async () => {
    (getCurrentTenant as any).mockResolvedValue(null);
    expect((await patch({ consent: true })).status).toBe(404);
    expect(prisma.users.update).not.toHaveBeenCalled();
  });

  it("401s without an email on the session", async () => {
    expect((await patch({ consent: true }, { id: "x", email: null })).status).toBe(401);
  });
});
