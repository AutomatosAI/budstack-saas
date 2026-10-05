import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/drgreen/drgreen-api-client", () => ({ callDrGreenAPI: vi.fn() }));

import { callDrGreenAPI } from "@/lib/drgreen/drgreen-api-client";
import {
  deliveryQuoteFromCart,
  fetchDeliveryQuote,
  pickClientCart,
} from "@/lib/drgreen/delivery-quote";

/**
 * BS-F01: checkout reads Dr Green's delivery charge off the customer's OWN
 * server cart. GET /dapp/carts lists every client of the key with a cart and
 * ignores clientId, so the pick must be by id, never `clients[0]`.
 */
const cart = (deliveryCharge: unknown, currency = "ZAR") => ({
  id: "cart-1",
  cartItems: [],
  localPrices: { currency, totalAmount: 825, deliveryCharge, grandTotal: 935 },
});

const listResponse = {
  success: true,
  data: {
    clients: [
      { id: "someone-else", clientCart: [cart(60, "EUR")] },
      { id: "client-1", clientCart: [cart(110)] },
    ],
  },
};

describe("pickClientCart", () => {
  it("returns this customer's cart, not the first client in the list", () => {
    expect(pickClientCart(listResponse, "client-1")?.localPrices.deliveryCharge).toBe(110);
  });

  it("returns null when the customer has no cart in the list", () => {
    expect(pickClientCart(listResponse, "client-404")).toBeNull();
    expect(pickClientCart({ data: { clients: [] } }, "client-1")).toBeNull();
    expect(pickClientCart(null, "client-1")).toBeNull();
    expect(pickClientCart(listResponse, "")).toBeNull();
  });
});

describe("deliveryQuoteFromCart", () => {
  it("reads localPrices.deliveryCharge and currency", () => {
    expect(deliveryQuoteFromCart(cart(110))).toEqual({ deliveryCharge: 110, currency: "ZAR" });
  });

  it("accepts free delivery and numeric strings", () => {
    expect(deliveryQuoteFromCart(cart(0))?.deliveryCharge).toBe(0);
    expect(deliveryQuoteFromCart(cart("110.5"))?.deliveryCharge).toBe(110.5);
  });

  it.each([[undefined], [null], ["free"], [-1]])("never invents a charge from %s", (value) => {
    expect(deliveryQuoteFromCart(cart(value))).toBeNull();
  });

  it("returns null when there is no cart", () => {
    expect(deliveryQuoteFromCart(null)).toBeNull();
  });
});

describe("fetchDeliveryQuote", () => {
  beforeEach(() => vi.clearAllMocks());

  it("narrows the signed GET by the customer's email and picks by id", async () => {
    (callDrGreenAPI as any).mockResolvedValue(listResponse);
    const quote = await fetchDeliveryQuote({
      clientId: "client-1",
      email: "ann@example.com",
      apiKey: "k",
      secretKey: "s",
      apiUrl: "https://stage/api/v1",
    });
    expect(quote).toEqual({ deliveryCharge: 110, currency: "ZAR" });
    const [endpoint, opts] = (callDrGreenAPI as any).mock.calls[0];
    expect(endpoint).toBe("/dapp/carts");
    expect(opts).toMatchObject({
      method: "GET",
      baseUrl: "https://stage/api/v1",
      queryParams: { search: "ann@example.com" },
    });
  });
});
