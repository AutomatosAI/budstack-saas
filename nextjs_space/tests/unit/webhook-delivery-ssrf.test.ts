import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Prisma client so delivery runs without a database.
vi.mock("@/lib/db", () => ({
  prisma: {
    webhooks: { findUnique: vi.fn() },
    webhookDelivery: { create: vi.fn() },
  },
}));

import { deliverWebhook } from "@/lib/integrations/webhook";
import { prisma } from "@/lib/db";

const mockedPrisma = prisma as unknown as {
  webhooks: { findUnique: ReturnType<typeof vi.fn> };
  webhookDelivery: { create: ReturnType<typeof vi.fn> };
};

const payload = {
  event: "order.completed",
  data: { orderId: "o1" },
  timestamp: "2026-05-29T00:00:00Z",
};

// Literal IPs so assertSafeWebhookUrl never performs a real DNS lookup:
// public (allowed) vs RFC-1918 (blocked).
const PUBLIC_URL = "https://93.184.216.34/hook";
const INTERNAL_URL = "https://10.0.0.5/internal";

beforeEach(() => {
  vi.clearAllMocks();
  mockedPrisma.webhookDelivery.create.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("deliverWebhook SSRF guard", () => {
  it("blocks delivery to an internal URL before any fetch", async () => {
    mockedPrisma.webhooks.findUnique.mockResolvedValue({
      id: "wh1",
      isActive: true,
      url: INTERNAL_URL,
      secret: "shh",
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await deliverWebhook("wh1", payload);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockedPrisma.webhookDelivery.create).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.webhookDelivery.create.mock.calls[0][0].data.success).toBe(
      false,
    );
  });

  it("blocks a public->internal 302 at redirect re-validation (internal never fetched)", async () => {
    mockedPrisma.webhooks.findUnique.mockResolvedValue({
      id: "wh2",
      isActive: true,
      url: PUBLIC_URL,
      secret: "shh",
    });
    const fetchSpy = vi.fn().mockResolvedValue({
      status: 302,
      headers: new Headers({ location: INTERNAL_URL }),
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchSpy);

    await deliverWebhook("wh2", payload);

    // Only the first (public) hop is fetched; the internal Location is not.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe(PUBLIC_URL);
    expect(mockedPrisma.webhookDelivery.create).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.webhookDelivery.create.mock.calls[0][0].data.success).toBe(
      false,
    );
  });

  it("delivers to a public URL and records a successful delivery", async () => {
    mockedPrisma.webhooks.findUnique.mockResolvedValue({
      id: "wh3",
      isActive: true,
      url: PUBLIC_URL,
      secret: "shh",
    });
    const fetchSpy = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
      text: async () => "ok",
    });
    vi.stubGlobal("fetch", fetchSpy);

    await deliverWebhook("wh3", payload);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const arg = mockedPrisma.webhookDelivery.create.mock.calls[0][0];
    expect(arg.data.success).toBe(true);
    expect(arg.data.statusCode).toBe(200);
  });
});
