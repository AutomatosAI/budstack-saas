import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * BS-202 on the consultation submit route (SA ID-upload registration): an
 * impossible South African ID number is refused BEFORE any account,
 * questionnaire or Dr Green client exists — the customer fixes the number and
 * resubmits with nothing to clean up. Same mock harness as
 * consultation-submit-ownership.test.ts: the real handler runs against mocked
 * module boundaries.
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
import { SA_ID_INVALID_CODE, SA_ID_INVALID_MESSAGE } from "@/lib/verification/sa-id";

const ZA_TENANT = {
  id: "tenant-za",
  subdomain: "lekker",
  countryCode: "ZA",
  settings: { verificationMode: "ID_UPLOAD" },
};

// Synthetic numbers from lib/verification/__tests__/sa-id-vectors.json.
const VALID_SA_ID = "9001015009086";
const VALID_SA_ID_SPACED = "900101 5009 086";
const INVALID_SA_ID = "9001015009087"; // check digit off by one

function idDocument(over: Record<string, unknown> = {}) {
  return {
    fileBase64: Buffer.from("fake-png").toString("base64"),
    mimeType: "image/png",
    documentType: "ID",
    documentNumber: INVALID_SA_ID,
    ...over,
  };
}

function submission(over: Record<string, unknown> = {}) {
  return {
    firstName: "Thabo",
    lastName: "Mokoena",
    email: "thabo-new@example.com",
    password: "sup3rsecret!",
    phoneCode: "+27",
    phoneNumber: "821234567",
    countryCode: "ZA",
    country: "South Africa",
    addressLine1: "1 Long St",
    city: "Cape Town",
    state: "Western Cape",
    postalCode: "8001",
    idDocument: idDocument(),
    ...over,
  };
}

function request(body: unknown) {
  return new NextRequest("http://lekker.localhost/api/consultation/submit", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  libMock.checkRateLimit.mockResolvedValue({ success: true });
  libMock.getTenantFromRequest.mockResolvedValue(ZA_TENANT);
  libMock.checkPolicyGate.mockResolvedValue({ allowed: true });
  libMock.getTenantVerificationMode.mockReturnValue("ID_UPLOAD");
  libMock.isSaIdUploadEnabled.mockReturnValue(true);
  libMock.isSaIdEligibleTenant.mockReturnValue(true);
  libMock.getTenantDrGreenConfig.mockResolvedValue({
    apiKey: "k",
    secretKey: "s",
    apiUrl: "https://stage/api/v1",
  });
  libMock.createSaIdClient.mockResolvedValue({ clientId: "drg-1" });
  libMock.uploadIdentityDocument.mockResolvedValue({ id: "doc-1" });
  libMock.recordIdDocumentOutcome.mockResolvedValue(true);
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

/** A refused number must leave no trace anywhere. */
function expectNothingCreated() {
  expect(clerkMock.createUser).not.toHaveBeenCalled();
  expect(prismaMock.users.create).not.toHaveBeenCalled();
  expect(prismaMock.users.update).not.toHaveBeenCalled();
  expect(prismaMock.consultation_questionnaires.create).not.toHaveBeenCalled();
  expect(libMock.createSaIdClient).not.toHaveBeenCalled();
  expect(libMock.uploadIdentityDocument).not.toHaveBeenCalled();
  expect(libMock.recordIdDocumentOutcome).not.toHaveBeenCalled();
}

describe("consultation submit — South African ID number (BS-202)", () => {
  it("400s with SA_ID_INVALID before any account or client exists", async () => {
    const res = await POST(request(submission()));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      code: SA_ID_INVALID_CODE,
      error: SA_ID_INVALID_MESSAGE,
    });
    expectNothingCreated();
  });

  it("creates the client and forwards a valid number space-stripped", async () => {
    const res = await POST(
      request(submission({ idDocument: idDocument({ documentNumber: VALID_SA_ID_SPACED }) })),
    );

    expect(res.status).toBe(200);
    expect(libMock.createSaIdClient).toHaveBeenCalledTimes(1);
    expect(libMock.uploadIdentityDocument).toHaveBeenCalledTimes(1);
    const upload = libMock.uploadIdentityDocument.mock.calls[0][0];
    expect(upload.documentNumber).toBe(VALID_SA_ID);
    expect(upload.documentType).toBe("ID");
    expect(libMock.recordIdDocumentOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "UPLOADED" }),
    );
  });

  it("leaves a passport number unchecked and forwards it as typed", async () => {
    const res = await POST(
      request(
        submission({
          idDocument: idDocument({ documentType: "PASSPORT", documentNumber: "A1234567" }),
        }),
      ),
    );

    expect(res.status).toBe(200);
    const upload = libMock.uploadIdentityDocument.mock.calls[0][0];
    expect(upload.documentNumber).toBe("A1234567");
  });

  it("does not apply the rules on a non-South-African tenant", async () => {
    libMock.isSaIdEligibleTenant.mockReturnValue(false);
    libMock.getTenantVerificationMode.mockReturnValue("KYC");
    libMock.callDrGreenAPI.mockResolvedValue({ data: { client: { id: "drg-kyc" } } });

    const res = await POST(
      request(submission({ countryCode: "PT", dateOfBirth: "1990-01-01", gender: "Other" })),
    );

    expect(res.status).not.toBe(400);
    expect(libMock.callDrGreenAPI).toHaveBeenCalled();
  });

  it("still rejects a malformed idDocument object as a plain validation error", async () => {
    const res = await POST(
      request(submission({ idDocument: { fileBase64: "x", mimeType: "image/png", documentType: "NOPE", documentNumber: "1" } })),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBeUndefined();
    expectNothingCreated();
  });
});
