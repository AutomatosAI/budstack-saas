import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * BS-A02 on the consultation submit route: the referral code reaches Dr Green
 * as `affiliateCode` + `affiliateCodeSource` on both client-create paths, a
 * malformed code never fails the registration, a sign-up without a code sends
 * exactly what it sent before, and the bs_ref cookie is cleared once the
 * sign-up succeeds. Same mock harness as consultation-submit-sa-id.test.ts.
 */

const clerkMock = vi.hoisted(() => ({
  currentUser: vi.fn(),
  createUser: vi.fn(),
  clerkClient: vi.fn(),
}));
const prismaMock = vi.hoisted(() => ({
  users: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  consultation_questionnaires: { create: vi.fn(), update: vi.fn() },
}));
const libMock = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getTenantFromRequest: vi.fn(),
  resolveTenant: vi.fn(),
  checkPolicyGate: vi.fn(),
  getTenantVerificationMode: vi.fn(),
  isSaIdUploadEnabled: vi.fn(),
  isSaIdEligibleTenant: vi.fn(),
  getTenantDrGreenConfig: vi.fn(),
  callDrGreenAPI: vi.fn(),
  createSaIdClient: vi.fn(),
  uploadIdentityDocument: vi.fn(),
  recordIdDocumentOutcome: vi.fn(),
  createAuditLog: vi.fn(),
  triggerWebhook: vi.fn(),
  mapMedicalConditionsForDrGreen: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: clerkMock.currentUser,
  clerkClient: clerkMock.clerkClient,
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: libMock.checkRateLimit }));
vi.mock("@/lib/tenant/tenant", () => ({ getTenantFromRequest: libMock.getTenantFromRequest }));
vi.mock("@/lib/tenant/tenant-resolver", () => ({ resolveTenant: libMock.resolveTenant }));
vi.mock("@/lib/legal/policy-gate", () => ({ checkPolicyGate: libMock.checkPolicyGate }));
vi.mock("@/lib/verification-mode", () => ({
  getTenantVerificationMode: libMock.getTenantVerificationMode,
  isSaIdUploadEnabled: libMock.isSaIdUploadEnabled,
  isSaIdEligibleTenant: libMock.isSaIdEligibleTenant,
}));
vi.mock("@/lib/tenant/tenant-config", () => ({
  getTenantDrGreenConfig: libMock.getTenantDrGreenConfig,
}));
vi.mock("@/lib/drgreen/drgreen-api-client", () => ({ callDrGreenAPI: libMock.callDrGreenAPI }));
vi.mock("@/lib/drgreen-identity", () => ({
  createSaIdClient: libMock.createSaIdClient,
  uploadIdentityDocument: libMock.uploadIdentityDocument,
}));
vi.mock("@/lib/verification/id-document-status", () => ({
  recordIdDocumentOutcome: libMock.recordIdDocumentOutcome,
}));
vi.mock("@/lib/drgreen/dr-green-mapping", () => ({
  mapMedicalConditionsForDrGreen: libMock.mapMedicalConditionsForDrGreen,
}));
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: libMock.createAuditLog,
  AUDIT_ACTIONS: { CONSULTATION_SUBMITTED: "consultation.submitted" },
  getClientInfo: () => ({}),
}));
vi.mock("@/lib/integrations/webhook", () => ({
  triggerWebhook: libMock.triggerWebhook,
  WEBHOOK_EVENTS: { CONSULTATION_SUBMITTED: "consultation.submitted" },
}));

import { POST } from "@/app/api/consultation/submit/route";

const KYC_TENANT = { id: "tenant-pt", subdomain: "lisboa", countryCode: "PT", settings: {} };
const ZA_TENANT = {
  id: "tenant-za",
  subdomain: "lekker",
  countryCode: "ZA",
  settings: { verificationMode: "ID_UPLOAD" },
};

function kycSubmission(over: Record<string, unknown> = {}) {
  return {
    firstName: "Ana",
    lastName: "Silva",
    email: "ana-new@example.com",
    password: "sup3rsecret!",
    phoneCode: "+351",
    phoneNumber: "912345678",
    countryCode: "PT",
    country: "Portugal",
    addressLine1: "Rua A 1",
    city: "Lisboa",
    state: "Lisboa",
    postalCode: "1000-001",
    dateOfBirth: "1990-01-01",
    gender: "Female",
    ...over,
  };
}

function request(body: unknown, cookie?: string) {
  return new NextRequest("http://lisboa.localhost/api/consultation/submit", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.10",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

/** The body the KYC branch posted to Dr Green /dapp/clients. */
function drGreenBody(): Record<string, unknown> {
  expect(libMock.callDrGreenAPI).toHaveBeenCalledTimes(1);
  const [endpoint, opts] = libMock.callDrGreenAPI.mock.calls[0];
  expect(endpoint).toBe("/dapp/clients");
  return opts.body;
}

function setCookieHeader(res: Response): string {
  return res.headers.get("set-cookie") ?? "";
}

beforeEach(() => {
  vi.clearAllMocks();
  libMock.checkRateLimit.mockResolvedValue({ success: true });
  libMock.getTenantFromRequest.mockResolvedValue(KYC_TENANT);
  libMock.checkPolicyGate.mockResolvedValue({ allowed: true });
  libMock.getTenantVerificationMode.mockReturnValue("KYC");
  libMock.isSaIdUploadEnabled.mockReturnValue(false);
  libMock.isSaIdEligibleTenant.mockReturnValue(false);
  libMock.getTenantDrGreenConfig.mockResolvedValue({
    apiKey: "k",
    secretKey: "s",
    apiUrl: "https://stage/api/v1",
  });
  libMock.callDrGreenAPI.mockResolvedValue({ data: { client: { id: "drg-kyc", kycLink: "https://kyc" } } });
  libMock.createSaIdClient.mockResolvedValue({ clientId: "drg-id" });
  libMock.uploadIdentityDocument.mockResolvedValue({ id: "doc-1" });
  libMock.recordIdDocumentOutcome.mockResolvedValue(true);
  libMock.mapMedicalConditionsForDrGreen.mockReturnValue([]);
  libMock.createAuditLog.mockResolvedValue(undefined);
  libMock.triggerWebhook.mockResolvedValue(undefined);
  clerkMock.currentUser.mockResolvedValue(null);
  clerkMock.createUser.mockResolvedValue({ id: "clerk_new" });
  clerkMock.clerkClient.mockResolvedValue({ users: { createUser: clerkMock.createUser } });
  prismaMock.users.findUnique.mockResolvedValue(null);
  prismaMock.users.create.mockResolvedValue({ id: "clerk_new" });
  prismaMock.users.update.mockResolvedValue({});
  prismaMock.consultation_questionnaires.create.mockResolvedValue({ id: "q-1" });
  prismaMock.consultation_questionnaires.update.mockResolvedValue({});
});

describe("consultation submit — affiliate code (BS-A02)", () => {
  it("link-only: the remembered code, left as pre-filled, is forwarded as 'link'", async () => {
    const res = await POST(request(kycSubmission({ affiliateCode: "test-code" }), "bs_ref=TEST-CODE"));

    expect(res.status).toBe(200);
    const body = drGreenBody();
    expect(body.affiliateCode).toBe("TEST-CODE");
    expect(body.affiliateCodeSource).toBe("link");
  });

  it("typed-overrides-link: a different code replaces the remembered one as 'typed'", async () => {
    const res = await POST(request(kycSubmission({ affiliateCode: "MY-OWN-CODE" }), "bs_ref=TEST-CODE"));

    expect(res.status).toBe(200);
    const body = drGreenBody();
    expect(body.affiliateCode).toBe("MY-OWN-CODE");
    expect(body.affiliateCodeSource).toBe("typed");
  });

  it("malformed typed code: no 400 — the sign-up completes without a code", async () => {
    const res = await POST(request(kycSubmission({ affiliateCode: "X!" }), "bs_ref=TEST-CODE"));

    expect(res.status).toBe(200);
    expect(clerkMock.createUser).toHaveBeenCalledTimes(1);
    const body = drGreenBody();
    expect("affiliateCode" in body).toBe(false);
    expect("affiliateCodeSource" in body).toBe(false);
  });

  it("a malformed code beside another invalid field reports the other field", async () => {
    const res = await POST(
      request(kycSubmission({ affiliateCode: "X!", email: "not-an-email" })),
    );

    expect(res.status).toBe(400);
    const error = JSON.stringify(await res.json());
    expect(error).toMatch(/email/);
    expect(error).not.toMatch(/affiliateCode/);
    expect(clerkMock.createUser).not.toHaveBeenCalled();
  });

  it("absent = unchanged payload: no field, no cookie sends no affiliate keys", async () => {
    const res = await POST(request(kycSubmission()));

    expect(res.status).toBe(200);
    const body = drGreenBody();
    expect("affiliateCode" in body).toBe(false);
    expect("affiliateCodeSource" in body).toBe(false);
  });

  it("a cleared field sends nothing even when the landing cookie is set", async () => {
    await POST(request(kycSubmission({ affiliateCode: "" }), "bs_ref=TEST-CODE"));

    const body = drGreenBody();
    expect("affiliateCode" in body).toBe(false);
  });

  it("ID-upload path: createSaIdClient receives the code and its source", async () => {
    libMock.getTenantFromRequest.mockResolvedValue(ZA_TENANT);
    libMock.getTenantVerificationMode.mockReturnValue("ID_UPLOAD");
    libMock.isSaIdUploadEnabled.mockReturnValue(true);
    libMock.isSaIdEligibleTenant.mockReturnValue(true);

    const res = await POST(
      request(
        kycSubmission({
          countryCode: "ZA",
          country: "South Africa",
          affiliateCode: "TEST-CODE",
        }),
        "bs_ref=TEST-CODE",
      ),
    );

    expect(res.status).toBe(200);
    expect(libMock.createSaIdClient).toHaveBeenCalledWith(
      expect.objectContaining({ affiliateCode: "TEST-CODE", affiliateCodeSource: "link" }),
    );
  });

  it("BS-A03: keeps the forwarded code on the local user with the Dr Green client id", async () => {
    await POST(request(kycSubmission({ affiliateCode: "MY-OWN-CODE" }), "bs_ref=TEST-CODE"));

    const linkWrite = prismaMock.users.update.mock.calls
      .map((c: any[]) => c[0])
      .find((arg: any) => arg.data.drGreenClientId === "drg-kyc");
    expect(linkWrite?.data).toEqual(
      expect.objectContaining({ affiliateCode: "MY-OWN-CODE", affiliateCodeSource: "typed" }),
    );
  });

  it("BS-A03: writes no affiliate columns when there is no code", async () => {
    await POST(request(kycSubmission()));

    for (const [arg] of prismaMock.users.update.mock.calls) {
      expect("affiliateCode" in arg.data).toBe(false);
      expect("affiliateCodeSource" in arg.data).toBe(false);
    }
    const created = prismaMock.users.create.mock.calls[0][0].data;
    expect("affiliateCode" in created).toBe(false);
  });

  it("clears the bs_ref cookie after a successful sign-up", async () => {
    const res = await POST(request(kycSubmission({ affiliateCode: "TEST-CODE" }), "bs_ref=TEST-CODE"));

    expect(res.status).toBe(200);
    const header = setCookieHeader(res);
    expect(header).toMatch(/bs_ref=;/);
    expect(header).toMatch(/Max-Age=0/i);
  });

  it("keeps the cookie when Dr Green refuses the registration (the customer will retry)", async () => {
    libMock.callDrGreenAPI.mockRejectedValue(new Error("Dr Green API error: 409 Phone Number already exists"));

    const res = await POST(request(kycSubmission({ affiliateCode: "TEST-CODE" }), "bs_ref=TEST-CODE"));

    expect(res.status).toBe(409);
    expect(setCookieHeader(res)).not.toMatch(/bs_ref/);
  });
});
