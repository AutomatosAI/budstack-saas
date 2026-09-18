import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/drgreen/drgreen-api-client", () => ({ callDrGreenAPI: vi.fn() }));
vi.mock("@/lib/exchange-rates", () => ({
  convertFromEUR: vi.fn(async (value: number) => value),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { callDrGreenAPI } from "@/lib/drgreen/drgreen-api-client";
import {
  fetchProduct,
  fetchProducts,
  invalidateProductCache,
} from "@/lib/drgreen/doctor-green-api";

/**
 * BS-401 (Dr Green Phase 4 US-405): the storefront reads the SIGNED catalogue
 * and never shows a product the order gate would refuse.
 */
const config = { apiKey: "k", secretKey: "s", apiUrl: "https://stage/api/v1" };

const active = {
  id: "s-active",
  name: "Active",
  description: "",
  thc: 20,
  cbd: 1,
  type: "Indica",
  retailPrice: 10,
  isActive: true,
  strainLocations: [{ isActive: true, isAvailable: true, stockQuantity: 5 }],
};
const inactiveWithStock = {
  ...active,
  id: "s-inactive",
  name: "Inactive",
  isActive: false, // delisted at strain level, even though a location has stock
};
const noStock = {
  ...active,
  id: "s-nostock",
  name: "No stock",
  strainLocations: [{ isActive: true, isAvailable: true, stockQuantity: 0 }],
};
const legacyNoLocations = {
  ...active,
  id: "s-legacy",
  name: "Legacy",
  strainLocations: [],
  stockQuantity: 3,
  isAvailable: true,
  isActive: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  invalidateProductCache();
  (callDrGreenAPI as any).mockResolvedValue({
    data: { strains: [active, inactiveWithStock, noStock, legacyNoLocations] },
  });
});

describe("fetchProducts", () => {
  it("calls the signed /dapp/strains route with the same query as before", async () => {
    await fetchProducts("ZA", config);
    expect(callDrGreenAPI).toHaveBeenCalledTimes(1);
    const [endpoint, opts] = (callDrGreenAPI as any).mock.calls[0];
    expect(endpoint).toBe("/dapp/strains");
    expect(opts.apiKey).toBe("k");
    expect(opts.secretKey).toBe("s");
    expect(opts.baseUrl).toBe("https://stage/api/v1");
    expect(opts.queryParams).toEqual({
      countryCode: "ZAF",
      orderBy: "desc",
      take: 100,
      page: 1,
    });
  });

  it("delists a strain flagged inactive, even when a location still holds stock", async () => {
    const products = await fetchProducts("ZA", config);
    const ids = products.map((p) => p.id);
    expect(ids).toEqual(["s-active", "s-nostock"]);
    expect(ids).not.toContain("s-inactive");
    expect(ids).not.toContain("s-legacy");
  });

  it("keeps an active strain with no stock listed but not purchasable", async () => {
    const products = await fetchProducts("ZA", config);
    const byId = Object.fromEntries(products.map((p) => [p.id, p]));
    expect(byId["s-active"].in_stock).toBe(true);
    expect(byId["s-active"].stock_quantity).toBe(5);
    expect(byId["s-nostock"].in_stock).toBe(false);
    expect(byId["s-nostock"].isAvailable).toBe(false);
  });
});

describe("fetchProduct (detail via the cached list)", () => {
  it("resolves an active strain and refuses a delisted one", async () => {
    const found = await fetchProduct("s-active", "ZA", config);
    expect(found.id).toBe("s-active");
    await expect(fetchProduct("s-inactive", "ZA", config)).rejects.toThrow(/not found/);
    // Both lookups came from one cached listing.
    expect(callDrGreenAPI).toHaveBeenCalledTimes(1);
  });
});
