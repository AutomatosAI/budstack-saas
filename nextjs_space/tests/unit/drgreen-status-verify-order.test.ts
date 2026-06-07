import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "crypto";

// Mock the heavy/IO modules so the route loads DB/network/email-free. The
// signature/timestamp/payload validators (@/lib/drgreen-webhook-verify) are
// kept REAL so the HMAC check actually runs.
vi.mock("@/lib/db", () => ({
  prisma: {
    consultation_questionnaires: { findFirst: vi.fn(), updateMany: vi.fn() },
    users: { findFirst: vi.fn() },
    tenants: { findUnique: vi.fn() },
    orders: { findFirst: vi.fn(), updateMany: vi.fn() },
    products: { findMany: vi.fn(), updateMany: vi.fn() },
    drgreen_webhook_logs: { create: vi.fn(), update: vi.fn() },
    kyc_journey_logs: { create: vi.fn() },
  },
}));

vi.mock("@/lib/security/encryption", () => ({
  decrypt: vi.fn(() => "tenant-secret"),
}));

vi.mock("@/lib/email/email", () => ({
  sendEmail: vi.fn(),
  emailTemplates: new Proxy({}, { get: () => vi.fn(async () => "<html></html>") }),
}));

vi.mock("@/lib/integrations/webhook", () => ({
  triggerWebhook: vi.fn(),
  WEBHOOK_EVENTS: new Proxy({}, { get: () => "evt" }),
}));

import { POST } from "@/app/api/webhooks/drgreen/status/route";
import { prisma } from "@/lib/db";

const mockedPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const PLATFORM_SECRET = "platform-webhook-secret";
const INVALID_SIG = "sha256=" + "00".repeat(32);

function makeReq(body: string, signature: string) {
  return new Request("https://app.test/api/webhooks/drgreen/status", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-webhook-signature": signature,
    },
    body,
  }) as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedPrisma.drgreen_webhook_logs.create.mockResolvedValue({});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  delete process.env.DRGREEN_WEBHOOK_SECRET;
  vi.restoreAllMocks();
});

describe("DrGreen status webhook — verify before resolve (US-011)", () => {
  it("platform secret set + invalid signature -> 401 before any tenant-resolution query", async () => {
    process.env.DRGREEN_WEBHOOK_SECRET = PLATFORM_SECRET;
    const payload = {
      event: "kyc.verified",
      clientId: "client-123",
      timestamp: new Date().toISOString(),
    };
    const res = await POST(makeReq(JSON.stringify(payload), INVALID_SIG));

    expect(res.status).toBe(401);
    // AC-3: resolveTenant's queries never ran on the attacker's clientId.
    expect(mockedPrisma.consultation_questionnaires.findFirst).not.toHaveBeenCalled();
    expect(mockedPrisma.users.findFirst).not.toHaveBeenCalled();
    // Cheap rejection: no log row written for a forged request.
    expect(mockedPrisma.drgreen_webhook_logs.create).not.toHaveBeenCalled();
  });

  it("platform secret UNSET -> existing resolve-then-verify path preserved (resolve runs, then 401)", async () => {
    // process.env.DRGREEN_WEBHOOK_SECRET intentionally unset
    mockedPrisma.consultation_questionnaires.findFirst.mockResolvedValue({ tenantId: "t1" });
    mockedPrisma.tenants.findUnique.mockResolvedValue({
      id: "t1",
      drGreenSecretKey: "enc:tenant-secret",
    });

    const payload = {
      event: "kyc.verified",
      clientId: "client-123",
      timestamp: new Date().toISOString(),
    };
    const res = await POST(makeReq(JSON.stringify(payload), INVALID_SIG));

    expect(res.status).toBe(401);
    // AC-2: old behaviour — tenant resolution happened BEFORE signature verify.
    expect(mockedPrisma.consultation_questionnaires.findFirst).toHaveBeenCalled();
  });

  it("platform secret set + VALID signature -> verification passes, resolve runs (404 when unknown)", async () => {
    process.env.DRGREEN_WEBHOOK_SECRET = PLATFORM_SECRET;
    mockedPrisma.orders.findFirst.mockResolvedValue(null); // unknown order

    const payload = {
      event: "order.shipped",
      orderId: "order-xyz",
      timestamp: new Date().toISOString(),
    };
    const body = JSON.stringify(payload);
    const sig =
      "sha256=" + crypto.createHmac("sha256", PLATFORM_SECRET).update(body).digest("hex");
    const res = await POST(makeReq(body, sig));

    // 404 (not 401) proves the platform signature verified and resolve ran.
    expect(res.status).toBe(404);
    expect(mockedPrisma.orders.findFirst).toHaveBeenCalled();
  });
});
