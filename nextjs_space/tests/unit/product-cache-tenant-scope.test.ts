import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/drgreen/drgreen-api-client", () => ({ callDrGreenAPI: vi.fn() }));
vi.mock("@/lib/exchange-rates", () => ({
  convertFromEUR: vi.fn(async (value: number) => value),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { callDrGreenAPI } from "@/lib/drgreen/drgreen-api-client";
import { fetchProduct, invalidateProductCache } from "@/lib/drgreen/doctor-green-api";
import { productCacheKey } from "@/lib/drgreen/product-cache";

/**
 * BS-F03: with Dr Green Commission Flex each KEY's catalogue carries its own
 * price, so fetchProduct's 60 s cache must never serve one tenant's price to
 * another. Two tenants, same country, different keys → independent entries.
 */
const API_URL = "https://api.example/api/v1";
const tenantA = { apiKey: "key-tenant-a", secretKey: "s", apiUrl: API_URL };
const tenantB = { apiKey: "key-tenant-b", secretKey: "s", apiUrl: API_URL };

const strainAt = (price: number) => ({
  id: "s-1",
  name: "Strain One",
  description: "",
  thc: 20,
  cbd: 1,
  type: "Indica",
  retailPrice: 10,
  isActive: true,
  strainLocations: [
    { isActive: true, isAvailable: true, stockQuantity: 5, retailPrice: price, location: { currency: "ZAR" } },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
  invalidateProductCache();
  // Each key gets its own (Flex-reduced) price for the same strain.
  (callDrGreenAPI as any).mockImplementation(async (_endpoint: string, opts: any) => ({
    data: { strains: [strainAt(opts.apiKey === tenantA.apiKey ? 165 : 132)] },
  }));
});

describe("fetchProduct cache scoping", () => {
  it("keeps two tenants with different keys in independent entries", async () => {
    const a = await fetchProduct("s-1", "ZA", tenantA);
    const b = await fetchProduct("s-1", "ZA", tenantB);
    expect(a.price).toBe(165);
    expect(b.price).toBe(132);
    expect(callDrGreenAPI).toHaveBeenCalledTimes(2);

    // Each tenant's second lookup is served from its own entry.
    expect((await fetchProduct("s-1", "ZA", tenantA)).price).toBe(165);
    expect((await fetchProduct("s-1", "ZA", tenantB)).price).toBe(132);
    expect(callDrGreenAPI).toHaveBeenCalledTimes(2);
  });

  it("shares one entry between tenants on the same (platform) key", async () => {
    const platformA = { apiKey: "platform-key", secretKey: "s", apiUrl: API_URL };
    const platformB = { ...platformA };
    await fetchProduct("s-1", "ZA", platformA);
    await fetchProduct("s-1", "ZA", platformB);
    expect(callDrGreenAPI).toHaveBeenCalledTimes(1);
  });

  it("invalidateProductCache still clears every tenant's entry", async () => {
    await fetchProduct("s-1", "ZA", tenantA);
    await fetchProduct("s-1", "ZA", tenantB);
    invalidateProductCache();
    await fetchProduct("s-1", "ZA", tenantA);
    await fetchProduct("s-1", "ZA", tenantB);
    expect(callDrGreenAPI).toHaveBeenCalledTimes(4);
  });
});

describe("productCacheKey", () => {
  it("is `${tenantKey}:${country}:${apiUrl}` and never contains the raw key", () => {
    const key = productCacheKey("ZA", tenantA);
    expect(key).toMatch(/^[0-9a-f]{16}:ZA:https:\/\/api\.example\/api\/v1$/);
    expect(key).not.toContain(tenantA.apiKey);
    expect(productCacheKey("ZA", tenantA)).toBe(key);
    expect(productCacheKey("ZA", tenantB)).not.toBe(key);
    expect(productCacheKey("PT", tenantA)).not.toBe(key);
  });
});
