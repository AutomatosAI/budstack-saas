import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock IO modules; keep @/lib/drgreen-webhook-verify REAL so the HMAC and
// timestamp validators actually run.
vi.mock("@/lib/db", () => ({
  prisma: {
    orders: { findFirst: vi.fn(), update: vi.fn() },
    drgreen_webhook_logs: { create: vi.fn() },
  },
}));

vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn(() => "tenant-secret"),
}));

vi.mock("@/lib/webhook", () => ({
  triggerWebhook: vi.fn(),
  WEBHOOK_EVENTS: new Proxy({}, { get: () => "evt" }),
}));

import { POST as fiatPOST } from "@/app/api/webhooks/drgreen/fiat/route";
import { POST as cryptoPOST } from "@/app/api/webhooks/drgreen/crypto/route";
import { prisma } from "@/lib/db";

const mockedPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const PLATFORM_SECRET = "platform-webhook-secret";
const INVALID_SIG = "sha256=" + "00".repeat(32);

function makeReq(path: string, body: string, signature: string) {
  return new Request(`https://app.test${path}`, {
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
});

afterEach(() => {
  delete process.env.DRGREEN_WEBHOOK_SECRET;
  vi.restoreAllMocks();
});

describe("DrGreen fiat webhook — verify before resolve (US-012)", () => {
  it("platform secret set + invalid signature -> 401 before orders.findFirst", async () => {
    process.env.DRGREEN_WEBHOOK_SECRET = PLATFORM_SECRET;
    const body = JSON.stringify({
      payment_id: "p1",
      status: "OK",
      code: 200,
      custom: "nonce-attacker",
      timestamp: new Date().toISOString(),
    });
    const res = await fiatPOST(makeReq("/api/webhooks/drgreen/fiat", body, INVALID_SIG));

    expect(res.status).toBe(401);
    expect(mockedPrisma.orders.findFirst).not.toHaveBeenCalled();
    expect(mockedPrisma.drgreen_webhook_logs.create).not.toHaveBeenCalled();
  });

  it("platform secret UNSET -> existing resolve-then-verify preserved (orders.findFirst runs, then per-tenant 401)", async () => {
    // Resolve a real order carrying a tenant secret so the flow reaches the
    // per-tenant signature check; the invalid sig then 401s AFTER resolution —
    // proving resolve-then-verify ordering is unchanged when the flag is unset.
    mockedPrisma.orders.findFirst.mockResolvedValue({
      id: "o1",
      tenantId: "t1",
      tenants: { drGreenSecretKey: "enc:tenant-secret" },
      users: { email: "buyer@example.com" },
      paymentStatus: "PENDING",
      drGreenInvoiceNum: null,
    });
    const body = JSON.stringify({
      payment_id: "p1",
      status: "OK",
      code: 200,
      custom: "nonce-1",
      timestamp: new Date().toISOString(),
    });
    const res = await fiatPOST(makeReq("/api/webhooks/drgreen/fiat", body, INVALID_SIG));

    expect(res.status).toBe(401);
    expect(mockedPrisma.orders.findFirst).toHaveBeenCalled();
  });
});

describe("DrGreen crypto webhook — verify before resolve (US-012)", () => {
  it("platform secret set + invalid signature -> 401 before orders.findFirst", async () => {
    process.env.DRGREEN_WEBHOOK_SECRET = PLATFORM_SECRET;
    const body = JSON.stringify({
      invoice_id: "i1",
      status_code: 1,
      custom_data2: "order-attacker",
      timestamp: new Date().toISOString(),
    });
    const res = await cryptoPOST(makeReq("/api/webhooks/drgreen/crypto", body, INVALID_SIG));

    expect(res.status).toBe(401);
    expect(mockedPrisma.orders.findFirst).not.toHaveBeenCalled();
    expect(mockedPrisma.drgreen_webhook_logs.create).not.toHaveBeenCalled();
  });
});
