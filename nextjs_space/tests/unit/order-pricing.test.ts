import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/drgreen/drgreen-api-client", () => ({ callDrGreenAPI: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  moneyOrNull,
  orderDetailsOf,
  planTotalsUpdate,
  priceOrderLines,
  subtotalFromCreatedOrder,
  totalsFromOrderDetails,
  unitPricesFromOrderLines,
} from "@/lib/drgreen/order-pricing";

/**
 * BS-F02: local order rows carry Dr Green's numbers. Fixtures follow the
 * shapes dr-green-backend returns today (order.service.ts createOrder /
 * getOrderById): the create response is the Order row with no lines; the
 * detail response is data.orderDetails with lines whose
 * localPrice.productAmount is the LINE total.
 */
const detailResponse = {
  success: true,
  data: {
    orderDetails: {
      id: "dg-1",
      totalAmount: 50, // USD base sum — overwritten by Dr Green's reader
      deliveryCharge: 110,
      currency: "ZAR",
      localPrice: { currency: "ZAR", totalAmount: 1185 },
      orderLines: [
        { quantity: 5, strain: { id: "s-1" }, localPrice: { productAmount: 825 } },
        { quantity: 2, strain: { id: "s-2" }, localPrice: { productAmount: 360 } },
      ],
    },
  },
};

const input = (strainId: string, quantity: number, clientPrice: number | null = null) => ({
  strainId,
  quantity,
  name: strainId,
  clientPrice,
});

describe("reading Dr Green responses", () => {
  it("unwraps orderDetails and turns line totals into unit prices", () => {
    const prices = unitPricesFromOrderLines(orderDetailsOf(detailResponse)?.orderLines);
    expect(prices.get("s-1")).toBe(165);
    expect(prices.get("s-2")).toBe(180);
  });

  it("skips lines it cannot price rather than guessing", () => {
    const prices = unitPricesFromOrderLines([
      { quantity: 0, strain: { id: "zero" }, localPrice: { productAmount: 10 } },
      { quantity: 2, strain: { id: "no-price" } },
      { quantity: 2, localPrice: { productAmount: 10 } },
    ]);
    expect(prices.size).toBe(0);
    expect(unitPricesFromOrderLines(undefined).size).toBe(0);
  });

  it("reads the create response's line-items total", () => {
    expect(subtotalFromCreatedOrder({ id: "dg-1", totalAmount: 1185, deliveryCharge: 110 })).toBe(1185);
    expect(subtotalFromCreatedOrder({ id: "dg-1" })).toBeNull();
    expect(moneyOrNull("12.5")).toBe(12.5);
    expect(moneyOrNull(-1)).toBeNull();
    expect(moneyOrNull("")).toBeNull();
  });

  it("syncs from localPrice.totalAmount, never the overwritten USD totalAmount", () => {
    expect(totalsFromOrderDetails(orderDetailsOf(detailResponse))).toEqual({
      subtotal: 1185,
      deliveryCharge: 110,
    });
  });
});

describe("priceOrderLines", () => {
  it("prices every line from Dr Green and ignores the browser's price", () => {
    const result = priceOrderLines({
      items: [input("s-1", 5, 200), input("s-2", 2, 180)],
      drGreenUnitPrices: unitPricesFromOrderLines(orderDetailsOf(detailResponse)?.orderLines),
      drGreenSubtotal: 1185,
    });
    expect(result.lines.map((l) => [l.strainId, l.price, l.source])).toEqual([
      ["s-1", 165, "drgreen"],
      ["s-2", 180, "drgreen"],
    ]);
    expect(result.subtotal).toBe(1185);
    expect(result.linesDisagreeWithTotal).toBe(false);
    // Only the line whose browser price differs is reported.
    expect(result.mismatches).toEqual([
      { strainId: "s-1", clientPrice: 200, price: 165, source: "drgreen" },
    ]);
  });

  it("falls back to the server catalogue, then to the unaccounted part of Dr Green's total", () => {
    const result = priceOrderLines({
      items: [input("s-1", 5), input("s-2", 2), input("s-3", 4)],
      drGreenUnitPrices: new Map([["s-1", 165]]),
      catalogueUnitPrices: { "s-2": 180 },
      drGreenSubtotal: 1185 + 400,
    });
    expect(result.lines.map((l) => [l.price, l.source])).toEqual([
      [165, "drgreen"],
      [180, "catalogue"],
      [100, "allocated"], // (1585 − 825 − 360) ÷ 4 g
    ]);
    expect(result.subtotal).toBe(1585);
    expect(result.linesDisagreeWithTotal).toBe(false);
  });

  it("keeps Dr Green's subtotal and flags lines that do not add up to it", () => {
    const result = priceOrderLines({
      items: [input("s-1", 5)],
      drGreenUnitPrices: new Map(),
      catalogueUnitPrices: { "s-1": 160 },
      drGreenSubtotal: 825,
    });
    expect(result.subtotal).toBe(825);
    expect(result.lines[0].price).toBe(160);
    expect(result.linesDisagreeWithTotal).toBe(true);
  });

  it("uses the lines' sum when Dr Green gave no total (older backend)", () => {
    const result = priceOrderLines({
      items: [input("s-1", 5, 999)],
      drGreenUnitPrices: new Map([["s-1", 165]]),
      drGreenSubtotal: null,
    });
    expect(result.subtotal).toBe(825);
    expect(result.linesDisagreeWithTotal).toBe(false);
  });
});

describe("planTotalsUpdate", () => {
  const current = { subtotal: 1000, shippingCost: 5, total: 1005 };

  it("moves every total that differs from Dr Green's", () => {
    expect(planTotalsUpdate(current, { subtotal: 1185, deliveryCharge: 110 })).toEqual({
      subtotal: 1185,
      shippingCost: 110,
      total: 1295,
    });
  });

  it("writes nothing when the row is already in step", () => {
    expect(
      planTotalsUpdate({ subtotal: 1185, shippingCost: 110, total: 1295 }, { subtotal: 1185, deliveryCharge: 110 }),
    ).toEqual({});
  });

  it("keeps the local value of a field Dr Green did not report (pre-#539 delivery)", () => {
    expect(planTotalsUpdate(current, { subtotal: 1185, deliveryCharge: null })).toEqual({
      subtotal: 1185,
      total: 1190,
    });
    expect(planTotalsUpdate(current, { subtotal: null, deliveryCharge: null })).toEqual({});
  });
});
