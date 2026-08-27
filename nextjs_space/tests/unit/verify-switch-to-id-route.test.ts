import { describe, it, expect, vi, beforeEach } from "vitest";

// withAuth → identity wrapper so POST is the raw handler (req, {user}, {slug}).
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
vi.mock("@/lib/db", () => ({ prisma: { users: { findFirst: vi.fn() } } }));
vi.mock("@/lib/verification-mode", () => ({
  isSaIdUploadEnabled: vi.fn(() => true),
  getTenantVerificationMode: vi.fn(() => "ID_UPLOAD"),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/api-error", () => ({
  apiError: (_e: any, o: any) =>
    new Response(JSON.stringify({ error: o?.safeMessage ?? "error" }), {
      status: o?.status ?? 500,
      headers: { "content-type": "application/json" },
    }),
}));
// Keep the REAL mapDrGreenApiError (its mapping is part of what this file
// tests); stub only the network call.
vi.mock("@/lib/drgreen-identity", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/drgreen-identity")>()),
  switchClientToIdVerification: vi.fn(),
}));

import { POST } from "@/app/api/store/[slug]/verify/switch-to-id/route";
import { getCurrentTenant } from "@/lib/tenant/tenant";
import { prisma } from "@/lib/db";
import {
  isSaIdUploadEnabled,
  getTenantVerificationMode,
} from "@/lib/verification-mode";
import { switchClientToIdVerification } from "@/lib/drgreen-identity";

const ZA_ID_TENANT = {
  id: "tenant-1",
  countryCode: "ZA",
  settings: { verificationMode: "ID_UPLOAD" },
};

const makeReq = () =>
  new Request("https://store.test/api/store/s/verify/switch-to-id", {
    method: "POST",
  }) as any;

const call = () => POST(makeReq(), { user: { email: "t@example.com" } }, { slug: "s" });

describe("POST /api/store/[slug]/verify/switch-to-id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentTenant as any).mockResolvedValue(ZA_ID_TENANT);
    (isSaIdUploadEnabled as any).mockReturnValue(true);
    (getTenantVerificationMode as any).mockReturnValue("ID_UPLOAD");
    (prisma.users.findFirst as any).mockResolvedValue({
      id: "u1",
      drGreenClientId: "dg-1",
    });
    (switchClientToIdVerification as any).mockResolvedValue({
      id: "dg-1",
      verificationType: "ID",
      adminApproval: "PENDING",
    });
  });

  it("switches the caller's own Dr Green client and returns SWITCHED", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "SWITCHED" });
    expect(switchClientToIdVerification).toHaveBeenCalledWith({
      clientId: "dg-1",
      config: { apiKey: "k", secretKey: "s" },
      baseUrl: "https://stage/api/v1",
    });
  });

  it("403s when the SA-ID env flag is off", async () => {
    (isSaIdUploadEnabled as any).mockReturnValue(false);
    const res = await call();
    expect(res.status).toBe(403);
    expect(switchClientToIdVerification).not.toHaveBeenCalled();
  });

  it("403s for a KYC-mode tenant", async () => {
    (getTenantVerificationMode as any).mockReturnValue("KYC");
    const res = await call();
    expect(res.status).toBe(403);
  });

  it("404s when the tenant cannot be resolved", async () => {
    (getCurrentTenant as any).mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(404);
  });

  it("400s when the user has no linked Dr Green client", async () => {
    (prisma.users.findFirst as any).mockResolvedValue({
      id: "u1",
      drGreenClientId: null,
    });
    const res = await call();
    expect(res.status).toBe(400);
    expect(switchClientToIdVerification).not.toHaveBeenCalled();
  });

  it("surfaces Dr Green's customer-safe 409 reason", async () => {
    (switchClientToIdVerification as any).mockRejectedValue(
      new Error(
        'Doctor Green API Error: 409 Conflict - {"success":false,"statusCode":409,"message":"ID verification is only available for South African clients"}',
      ),
    );
    const res = await call();
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe(
      "ID verification is only available for South African clients",
    );
  });

  it("maps an upstream 403 (backend flag off) to fixed copy", async () => {
    (switchClientToIdVerification as any).mockRejectedValue(
      new Error("Doctor Green API Error: 403 Forbidden - {}"),
    );
    const res = await call();
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(
      "Switching to ID verification is not available right now",
    );
  });

  it("falls back to a generic 500 for non-Dr-Green errors", async () => {
    (switchClientToIdVerification as any).mockRejectedValue(
      new Error("ECONNREFUSED"),
    );
    const res = await call();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/Failed to switch/);
  });
});
