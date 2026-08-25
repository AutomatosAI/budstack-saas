import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Account-takeover guard on the PUBLIC consultation signup.
 *
 * The hole: this route is unauthenticated (it IS the signup), so the submitted
 * address is unproven. It used to swallow Clerk's "email already exists" and
 * carry on against the existing account, ending in
 * `users.update({ drGreenClientId, tenantId })` — re-pointing a stranger's
 * account at a Dr Green client the caller controls. Approving the caller's own
 * genuine ID then made the stranger's account read VERIFIED, which the
 * purchase gate, the tenant-admin badge and the status webhooks all trust.
 *
 * The first fix was itself defective: it accepted "Clerk just minted a new
 * account" as proof of ownership, which is true of the CLERK identity and says
 * nothing about a local row that predates the request — so the mirror-image
 * case (local row exists, no Clerk account for it) walked straight through a
 * guard that could never fire. These tests drive the real handler, because a
 * unit test of the helper and a regex over the source both passed against that
 * defective version.
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

const TENANT = { id: "tenant-1", countryCode: "ZA", settings: {} };
const VICTIM_EMAIL = "victim@example.com";

/** A users row that already exists — the thing an attacker wants to re-point. */
const existingVictimRow = {
  id: "user-victim",
  email: VICTIM_EMAIL,
  tenantId: "tenant-victim",
  drGreenClientId: "drg_victim_original",
};

function submission(over: Record<string, unknown> = {}) {
  return {
    firstName: "Attacker",
    lastName: "Person",
    email: VICTIM_EMAIL,
    password: "sup3rsecret!",
    phoneCode: "+27",
    phoneNumber: "821234567",
    dateOfBirth: "1990-01-01",
    gender: "Other",
    ...over,
  };
}

function request(body: unknown) {
  return new NextRequest("http://store.localhost/api/consultation/submit", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
    body: JSON.stringify(body),
  });
}

/** Signed-in session for `email`, shaped like Clerk's verified primary. */
function session(email: string) {
  return {
    primaryEmailAddressId: "idn_1",
    emailAddresses: [
      { id: "idn_1", emailAddress: email, verification: { status: "verified" } },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  libMock.checkRateLimit.mockResolvedValue({ success: true });
  libMock.getTenantFromRequest.mockResolvedValue(TENANT);
  libMock.checkPolicyGate.mockResolvedValue({ allowed: true });
  libMock.getTenantVerificationMode.mockReturnValue("KYC");
  libMock.isSaIdUploadEnabled.mockReturnValue(false);
  libMock.getTenantDrGreenConfig.mockResolvedValue({ apiKey: "k", secretKey: "s" });
  libMock.mapMedicalConditionsForDrGreen.mockReturnValue([]);
  libMock.callDrGreenAPI.mockResolvedValue({
    data: { data: { id: "drg_attacker_client", kycLink: "https://kyc.example/x" } },
  });
  libMock.createAuditLog.mockResolvedValue(undefined);
  libMock.triggerWebhook.mockResolvedValue(undefined);
  clerkMock.clerkClient.mockResolvedValue({ users: { createUser: clerkMock.createUser } });
  prismaMock.consultation_questionnaires.create.mockResolvedValue({ id: "q-1" });
  prismaMock.consultation_questionnaires.update.mockResolvedValue({});
  prismaMock.users.create.mockResolvedValue({ id: "user-new" });
  prismaMock.users.update.mockResolvedValue({});
});

/** Nothing may be written for a submission the caller has not proven it owns. */
function expectNoSideEffects() {
  expect(prismaMock.users.update).not.toHaveBeenCalled();
  expect(prismaMock.users.create).not.toHaveBeenCalled();
  expect(prismaMock.consultation_questionnaires.create).not.toHaveBeenCalled();
  expect(libMock.callDrGreenAPI).not.toHaveBeenCalled();
  expect(libMock.createSaIdClient).not.toHaveBeenCalled();
}

describe("consultation submit — ownership of an existing account", () => {
  it("refuses an anonymous caller when Clerk already holds the address", async () => {
    clerkMock.currentUser.mockResolvedValue(null);
    clerkMock.createUser.mockRejectedValue({
      errors: [{ code: "form_identifier_exists", message: "That email address is taken." }],
    });
    prismaMock.users.findUnique.mockResolvedValue(existingVictimRow);

    const response = await POST(request(submission()));

    expect(response.status).toBe(409);
    expectNoSideEffects();
  });

  it("refuses an anonymous caller when a local row exists but Clerk does NOT hold the address", async () => {
    // The mirror-image case the first fix missed: Clerk mints an account for
    // the attacker (the address was free THERE), while a users row for it —
    // legacy import, or a dropped Clerk delete-webhook — already exists.
    clerkMock.currentUser.mockResolvedValue(null);
    clerkMock.createUser.mockResolvedValue({ id: "clerk_attacker" });
    prismaMock.users.findUnique.mockResolvedValue(existingVictimRow);

    const response = await POST(request(submission()));

    expect(response.status).toBe(409);
    expectNoSideEffects();
    // The specific write the takeover needs: the pre-existing row must keep
    // pointing at its own Dr Green client, in its own tenant.
    expect(prismaMock.users.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: existingVictimRow.id } }),
    );
  });

  it("refuses a caller signed in as somebody else", async () => {
    clerkMock.currentUser.mockResolvedValue(session("attacker@example.com"));
    clerkMock.createUser.mockResolvedValue({ id: "clerk_attacker" });
    prismaMock.users.findUnique.mockResolvedValue(existingVictimRow);

    const response = await POST(request(submission()));

    expect(response.status).toBe(409);
    expectNoSideEffects();
  });

  it("refuses when the session's primary address is unverified", async () => {
    clerkMock.currentUser.mockResolvedValue({
      primaryEmailAddressId: "idn_1",
      emailAddresses: [
        { id: "idn_1", emailAddress: VICTIM_EMAIL, verification: { status: "unverified" } },
      ],
    });
    clerkMock.createUser.mockResolvedValue({ id: "clerk_attacker" });
    prismaMock.users.findUnique.mockResolvedValue(existingVictimRow);

    const response = await POST(request(submission()));

    expect(response.status).toBe(409);
    expectNoSideEffects();
  });
});

describe("consultation submit — legitimate flows still work", () => {
  it("lets a brand-new address through the gate", async () => {
    clerkMock.currentUser.mockResolvedValue(null);
    clerkMock.createUser.mockResolvedValue({ id: "clerk_new_user" });
    prismaMock.users.findUnique.mockResolvedValue(null);

    const response = await POST(request(submission({ email: "brand-new@example.com" })));

    expect(response.status).not.toBe(409);
    expect(prismaMock.users.create).toHaveBeenCalled();
    expect(prismaMock.consultation_questionnaires.create).toHaveBeenCalled();
  });

  it("lets a signed-in customer complete their own consultation", async () => {
    clerkMock.currentUser.mockResolvedValue(session(VICTIM_EMAIL));
    clerkMock.createUser.mockRejectedValue({
      errors: [{ code: "form_identifier_exists", message: "That email address is taken." }],
    });
    prismaMock.users.findUnique.mockResolvedValue(existingVictimRow);

    const response = await POST(request(submission()));

    expect(response.status).not.toBe(409);
    expect(prismaMock.consultation_questionnaires.create).toHaveBeenCalled();
  });
});
