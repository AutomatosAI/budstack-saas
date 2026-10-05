import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * BS-F02: syncOneOrder mirrors Dr Green's totals onto the local row when they
 * differ — the LOCAL line-items total (localPrice.totalAmount) and the stored
 * deliveryCharge, never orderDetails.totalAmount (the reader's USD base sum).
 */
const prismaMock = vi.hoisted(() => ({ orders: { update: vi.fn() } }));
const apiMock = vi.hoisted(() => ({ callDrGreenAPI: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/drgreen/drgreen-api-client", () => apiMock);
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { syncOneOrder } from "@/lib/orders/storefront-orders";

const CONFIG = { apiKey: "k", secretKey: "s", apiUrl: "https://stage/api/v1" };

const row = {
  id: "order-1",
  drGreenOrderId: "dg-1",
  paymentStatus: "PENDING",
  status: "PENDING",
  drGreenInvoiceNum: "INV-1",
  // Priced from a stale browser basket, with the old hardcoded delivery.
  subtotal: 1000,
  shippingCost: 5,
  total: 1005,
};

const details = (over: Record<string, unknown> = {}) => ({
  success: true,
  data: {
    orderDetails: {
      id: "dg-1",
      paymentStatus: "PENDING",
      orderStatus: "PENDING",
      invoiceNumber: "INV-1",
      totalAmount: 50, // USD base — must not be mirrored
      deliveryCharge: 110,
      localPrice: { currency: "ZAR", totalAmount: 1185 },
      ...over,
    },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.orders.update.mockResolvedValue({});
});

describe("syncOneOrder — totals", () => {
  it("mirrors Dr Green's subtotal, delivery and total", async () => {
    apiMock.callDrGreenAPI.mockResolvedValue(details());
    await syncOneOrder(row, CONFIG);
    expect(prismaMock.orders.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { subtotal: 1185, shippingCost: 110, total: 1295 },
    });
  });

  it("writes nothing when the row already matches", async () => {
    apiMock.callDrGreenAPI.mockResolvedValue(details());
    await syncOneOrder({ ...row, subtotal: 1185, shippingCost: 110, total: 1295 }, CONFIG);
    expect(prismaMock.orders.update).not.toHaveBeenCalled();
  });

  it("keeps the local delivery when Dr Green has none locked (older order)", async () => {
    apiMock.callDrGreenAPI.mockResolvedValue(details({ deliveryCharge: null }));
    await syncOneOrder(row, CONFIG);
    expect(prismaMock.orders.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { subtotal: 1185, total: 1190 },
    });
  });

  it("on a paid order mirrors only the stored delivery, not the recomputed line total", async () => {
    apiMock.callDrGreenAPI.mockResolvedValue(details({ paymentStatus: "PAID" }));
    await syncOneOrder(row, CONFIG);
    expect(prismaMock.orders.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { shippingCost: 110, total: 1110, paymentStatus: "PAID" },
    });
  });

  // Until Dr Green's line-price snapshot ships, localPrice.totalAmount is
  // recomputed from today's price; a price move after payment must not
  // rewrite what was charged.
  it("does not rewrite a paid order's total when the catalogue price has since moved", async () => {
    apiMock.callDrGreenAPI.mockResolvedValue(
      details({ paymentStatus: "PAID", localPrice: { currency: "ZAR", totalAmount: 1050 } }),
    );
    await syncOneOrder(
      { ...row, paymentStatus: "PAID", subtotal: 1185, shippingCost: 110, total: 1295 },
      CONFIG,
    );
    expect(prismaMock.orders.update).not.toHaveBeenCalled();
  });

  it("never throws when Dr Green is unreachable", async () => {
    apiMock.callDrGreenAPI.mockRejectedValue(new Error("502"));
    await expect(syncOneOrder(row, CONFIG)).resolves.toBeUndefined();
    expect(prismaMock.orders.update).not.toHaveBeenCalled();
  });
});
