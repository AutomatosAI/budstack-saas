import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * BS-F02: submitOrder writes orders.subtotal/shippingCost/total and
 * order_items.price from Dr Green's order, never from the request body. A
 * browser price that differs is logged at warn and loses.
 */
const prismaMock = vi.hoisted(() => ({
  users: { findUnique: vi.fn() },
  drgreen_carts: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  orders: { create: vi.fn() },
}));
const apiMock = vi.hoisted(() => ({ callDrGreenAPI: vi.fn() }));
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/drgreen/drgreen-api-client", () => apiMock);
vi.mock("@/lib/logger", () => ({ logger: loggerMock }));
vi.mock("@/lib/drgreen/drgreen-client-cart", () => ({
  getClientCartId: vi.fn(async () => "client-cart-1"),
  invalidateClientCartId: vi.fn(async () => undefined),
}));

import { submitOrder } from "@/lib/drgreen/drgreen-orders";

const SHIPPING = {
  address1: "1 Long St",
  city: "Cape Town",
  state: "WC",
  postalCode: "8001",
  country: "South Africa",
};

// What the browser sends today: the add-to-cart price, possibly stale.
const clientCartItems = [
  { strainId: "s-1", quantity: 5, strain: { id: "s-1", name: "Strain One", retailPrice: 200 } },
  { strainId: "s-2", quantity: 2, strain: { id: "s-2", name: "Strain Two", retailPrice: 180 } },
];

// dr-green-backend createOrder → the Order row (no lines), wrapped in `data`.
const createResponse = {
  success: true,
  data: { id: "dg-1", invoiceNumber: "INV-1", totalAmount: 1185, deliveryCharge: 110, currency: "ZAR" },
};
// getOrderById → data.orderDetails; localPrice.productAmount is the line total.
const detailResponse = {
  success: true,
  data: {
    orderDetails: {
      id: "dg-1",
      totalAmount: 50,
      deliveryCharge: 110,
      localPrice: { currency: "ZAR", totalAmount: 1185 },
      orderLines: [
        { quantity: 5, strain: { id: "s-1" }, localPrice: { productAmount: 825 } },
        { quantity: 2, strain: { id: "s-2" }, localPrice: { productAmount: 360 } },
      ],
    },
  },
};

function routeDrGreen(detail: unknown | Error = detailResponse) {
  apiMock.callDrGreenAPI.mockImplementation(async (endpoint: string, opts: any) => {
    if (endpoint === "/dapp/carts" && opts.method === "POST") return { success: true };
    if (endpoint === "/dapp/orders" && opts.method === "POST") return createResponse;
    if (endpoint === "/dapp/orders/dg-1" && opts.method === "GET") {
      if (detail instanceof Error) throw detail;
      return detail;
    }
    throw new Error(`unexpected ${opts.method} ${endpoint}`);
  });
}

const baseParams = {
  userId: "user-1",
  tenantId: "tenant-1",
  shippingInfo: SHIPPING,
  apiKey: "k",
  secretKey: "s",
  apiUrl: "https://stage/api/v1",
  clientCartItems,
};

function savedOrder() {
  return prismaMock.orders.create.mock.calls[0][0].data;
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.users.findUnique.mockResolvedValue({ drGreenClientId: "client-1", email: "a@b.c" });
  prismaMock.drgreen_carts.findUnique.mockResolvedValue(null);
  prismaMock.drgreen_carts.upsert.mockResolvedValue({});
  prismaMock.drgreen_carts.deleteMany.mockResolvedValue({ count: 1 });
  prismaMock.orders.create.mockImplementation(async ({ data }: any) => ({
    ...data,
    order_items: data.order_items.create,
  }));
  routeDrGreen();
});

describe("submitOrder — the local row is priced by Dr Green", () => {
  it("writes Dr Green's totals and line prices, not the browser's", async () => {
    const result = await submitOrder(baseParams);

    const data = savedOrder();
    expect(data.subtotal).toBe(1185);
    expect(data.shippingCost).toBe(110);
    expect(data.total).toBe(1295);
    expect(result.total).toBe(1295);
    expect(data.order_items.create.map((i: any) => [i.productId, i.productName, i.quantity, i.price])).toEqual([
      ["s-1", "Strain One", 5, 165],
      ["s-2", "Strain Two", 2, 180],
    ]);
    // The detail read is the signed GET the rest of the code uses.
    expect(apiMock.callDrGreenAPI).toHaveBeenCalledWith(
      "/dapp/orders/dg-1",
      expect.objectContaining({ method: "GET", signBody: { orderId: "dg-1" }, baseUrl: "https://stage/api/v1" }),
    );
  });

  it("logs the browser-vs-Dr Green difference at warn, and Dr Green wins", async () => {
    await submitOrder(baseParams);

    const warn = loggerMock.warn.mock.calls.find(([msg]) => /differs from Dr Green/.test(msg));
    expect(warn).toBeDefined();
    expect(warn![1].mismatches).toEqual([
      { strainId: "s-1", clientPrice: 200, price: 165, source: "drgreen" },
    ]);
    expect(savedOrder().order_items.create[0].price).toBe(165);
  });

  it("still saves the order when the detail read fails, from the server catalogue", async () => {
    routeDrGreen(new Error("Doctor Green API Error: 502"));
    await submitOrder({ ...baseParams, catalogueUnitPrices: { "s-1": 165, "s-2": 180 } });

    const data = savedOrder();
    expect(data.subtotal).toBe(1185);
    expect(data.order_items.create.map((i: any) => i.price)).toEqual([165, 180]);
    expect(loggerMock.warn).toHaveBeenCalledWith(
      expect.stringMatching(/could not read Dr Green order lines/),
      expect.objectContaining({ drGreenOrderId: "dg-1" }),
    );
  });

  // PRD BS-F02: analytics needs no change once rows are right. It sums
  // orders.total for revenue and order_items.price × quantity for product
  // revenue (app/api/tenant-admin/analytics/route.ts); both now equal Dr
  // Green's figures for the order.
  it("produces a row whose analytics sums equal Dr Green's totals", async () => {
    await submitOrder(baseParams);
    const data = savedOrder();
    const productRevenue = data.order_items.create.reduce(
      (sum: number, i: any) => sum + i.price * i.quantity,
      0,
    );
    expect(productRevenue).toBe(createResponse.data.totalAmount);
    expect(data.total).toBe(createResponse.data.totalAmount + createResponse.data.deliveryCharge);
  });
});
