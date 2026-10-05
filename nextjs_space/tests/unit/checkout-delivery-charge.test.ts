import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/drgreen/drgreen-api-client", () => ({ callDrGreenAPI: vi.fn() }));
vi.mock("@/lib/exchange-rates", () => ({
  convertFromEUR: vi.fn(async (value: number) => value),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { callDrGreenAPI } from "@/lib/drgreen/drgreen-api-client";
import { fetchProducts, invalidateProductCache } from "@/lib/drgreen/doctor-green-api";
import {
  DR_GREEN_DEFAULT_DELIVERY_CHARGE,
  deliveryChargeFromLocation,
} from "@/lib/drgreen/delivery";
import {
  catalogueDeliveryQuote,
  deliveryChargeForBasket,
} from "@/lib/checkout/delivery-charge";
import type { CartItem } from "@/lib/cart-store";

/**
 * BS-F01: checkout shows Dr Green's delivery charge from the catalogue
 * (strainLocations[].location.deliveryCharge on /dapp/strains), falling back
 * to the customer's server-cart quote, then to "Calculated by Dr Green".
 */
const config = { apiKey: "k", secretKey: "s", apiUrl: "https://stage/api/v1" };

const strain = (id: string, location: Record<string, unknown> | undefined) => ({
  id,
  name: id,
  description: "",
  thc: 20,
  cbd: 1,
  type: "Indica",
  retailPrice: 10,
  isActive: true,
  strainLocations: [
    { isActive: true, isAvailable: true, stockQuantity: 5, retailPrice: 165, location },
  ],
});

const item = (productId: string, currency = "R"): CartItem => ({
  id: productId,
  productId,
  name: productId,
  price: 165,
  quantity: 5,
  currency,
});

describe("deliveryChargeFromLocation", () => {
  it("reads the market's charge", () => {
    expect(deliveryChargeFromLocation({ currency: "ZAR", deliveryCharge: 110 })).toBe(110);
    expect(deliveryChargeFromLocation({ deliveryCharge: 0 })).toBe(0);
    expect(deliveryChargeFromLocation({ deliveryCharge: "110.5" })).toBe(110.5);
  });

  it("null means the market has none set, so Dr Green bills its default (6)", () => {
    expect(deliveryChargeFromLocation({ currency: "ZAR", deliveryCharge: null })).toBe(
      DR_GREEN_DEFAULT_DELIVERY_CHARGE,
    );
    expect(DR_GREEN_DEFAULT_DELIVERY_CHARGE).toBe(6);
  });

  it("is unknown when the field is absent (older backend) or unusable", () => {
    expect(deliveryChargeFromLocation({ currency: "ZAR" })).toBeNull();
    expect(deliveryChargeFromLocation(undefined)).toBeNull();
    expect(deliveryChargeFromLocation({ deliveryCharge: undefined })).toBeNull();
    expect(deliveryChargeFromLocation({ deliveryCharge: -1 })).toBeNull();
    expect(deliveryChargeFromLocation({ deliveryCharge: "" })).toBeNull();
    expect(deliveryChargeFromLocation({ deliveryCharge: "abc" })).toBeNull();
  });
});

describe("fetchProducts keeps the location's delivery charge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateProductCache();
  });

  it("normalises deliveryCharge + its currency symbol per product", async () => {
    (callDrGreenAPI as any).mockResolvedValue({
      data: {
        strains: [
          strain("set", { currency: "ZAR", countryCode: "ZAF", deliveryCharge: 110 }),
          strain("unset", { currency: "ZAR", countryCode: "ZAF", deliveryCharge: null }),
          strain("old-backend", { currency: "ZAR", countryCode: "ZAF" }),
        ],
      },
    });
    const products = await fetchProducts("ZA", config);
    const byId = Object.fromEntries(products.map((p) => [p.id, p]));
    expect(byId.set.deliveryCharge).toBe(110);
    expect(byId.set.deliveryCurrency).toBe("R");
    expect(byId.unset.deliveryCharge).toBe(6);
    expect(byId.unset.deliveryCurrency).toBe("R");
    expect(byId["old-backend"].deliveryCharge).toBeNull();
    expect(byId["old-backend"].deliveryCurrency).toBeNull();
  });

  it("carries no charge when the location has no currency", async () => {
    (callDrGreenAPI as any).mockResolvedValue({
      data: { strains: [strain("no-currency", { deliveryCharge: 110 })] },
    });
    const [product] = await fetchProducts("ZA", config);
    expect(product.deliveryCharge).toBeNull();
    expect(product.deliveryCurrency).toBeNull();
  });
});

describe("catalogueDeliveryQuote", () => {
  const catalogue = [
    { id: "a", price: 165, deliveryCharge: 110, deliveryCurrency: "R" },
    { id: "b", price: 150, deliveryCharge: 110, deliveryCurrency: "R" },
    { id: "c", price: 150, deliveryCharge: null, deliveryCurrency: null },
    { id: "d", price: 150, deliveryCharge: 60, deliveryCurrency: "R" },
  ];

  it("returns the market charge for the basket", () => {
    expect(catalogueDeliveryQuote([item("a"), item("b")], catalogue)).toEqual({
      charge: 110,
      symbol: "R",
    });
  });

  it("is null when a line's product carries no charge", () => {
    expect(catalogueDeliveryQuote([item("a"), item("c")], catalogue)).toBeNull();
    expect(catalogueDeliveryQuote([item("missing")], catalogue)).toBeNull();
  });

  it("is null when lines disagree, and for an empty basket", () => {
    expect(catalogueDeliveryQuote([item("a"), item("d")], catalogue)).toBeNull();
    expect(catalogueDeliveryQuote([], catalogue)).toBeNull();
  });
});

describe("deliveryChargeForBasket", () => {
  const catalogueQuote = { charge: 110, symbol: "R" };
  const cartQuote = { charge: 95, symbol: "R" };

  it("prefers the catalogue, falls back to the server cart", () => {
    expect(deliveryChargeForBasket("R", [catalogueQuote, cartQuote])).toBe(110);
    expect(deliveryChargeForBasket("R", [null, cartQuote])).toBe(95);
  });

  it("only shows a charge quoted in the basket's currency", () => {
    expect(deliveryChargeForBasket("R", [{ charge: 6, symbol: "$" }, cartQuote])).toBe(95);
    expect(deliveryChargeForBasket("€", [catalogueQuote, cartQuote])).toBeNull();
  });

  it("is null (\"Calculated by Dr Green\") with no quote or no basket currency", () => {
    expect(deliveryChargeForBasket("R", [null, null])).toBeNull();
    expect(deliveryChargeForBasket(undefined, [catalogueQuote])).toBeNull();
  });
});
