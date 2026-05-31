import { describe, it, expect, vi, beforeEach } from "vitest";

// PRD-205 US-003 (AC-2) — lib/tenant.ts is now a set of thin delegators onto the
// canonical resolveTenant. These tests mock the resolver at the module boundary and
// prove each public helper (a) calls the resolver with the right discriminated input,
// (b) unwraps .tenant/.tenantId, (c) keeps its throw/error-swallow ergonomics.
//
// react's cache() is stubbed to identity so a cache-wrapped delegator is deterministic
// per call outside a React request scope.
const { resolveTenant } = vi.hoisted(() => ({ resolveTenant: vi.fn() }));
vi.mock("@/lib/tenant-resolver", () => ({ resolveTenant }));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));

import {
  getCurrentTenant,
  getCurrentTenantId,
  requireTenant,
  getTenantBySlug,
  getTenantFromRequest,
} from "@/lib/tenant";

const tenant = { id: "t-1", subdomain: "acme", isActive: true };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCurrentTenant — delegates to resolveTenant({ kind: 'headers' })", () => {
  it("unwraps the resolved tenant", async () => {
    resolveTenant.mockResolvedValueOnce({ tenantId: "t-1", tenant });
    await expect(getCurrentTenant()).resolves.toMatchObject({ id: "t-1" });
    expect(resolveTenant).toHaveBeenCalledWith({ kind: "headers" });
  });

  it("returns null when the resolver returns null", async () => {
    resolveTenant.mockResolvedValueOnce(null);
    await expect(getCurrentTenant()).resolves.toBeNull();
  });

  it("swallows a resolver error and returns null (backward-compat)", async () => {
    resolveTenant.mockRejectedValueOnce(new Error("db down"));
    await expect(getCurrentTenant()).resolves.toBeNull();
  });
});

describe("getCurrentTenantId / requireTenant ergonomics", () => {
  it("getCurrentTenantId returns the tenant id", async () => {
    resolveTenant.mockResolvedValueOnce({ tenantId: "t-1", tenant });
    await expect(getCurrentTenantId()).resolves.toBe("t-1");
  });

  it("getCurrentTenantId returns null with no tenant", async () => {
    resolveTenant.mockResolvedValueOnce(null);
    await expect(getCurrentTenantId()).resolves.toBeNull();
  });

  it("requireTenant returns the tenant when present", async () => {
    resolveTenant.mockResolvedValueOnce({ tenantId: "t-1", tenant });
    await expect(requireTenant()).resolves.toMatchObject({ id: "t-1" });
  });

  it("requireTenant throws when no tenant resolves", async () => {
    resolveTenant.mockResolvedValueOnce(null);
    await expect(requireTenant()).rejects.toThrow("Tenant not found or inactive");
  });
});

describe("getTenantBySlug — delegates to resolveTenant({ kind: 'slug' })", () => {
  it("passes the slug through and unwraps", async () => {
    resolveTenant.mockResolvedValueOnce({ tenantId: "t-1", tenant });
    await expect(getTenantBySlug("Acme")).resolves.toMatchObject({ id: "t-1" });
    expect(resolveTenant).toHaveBeenCalledWith({ kind: "slug", slug: "Acme" });
  });

  it("returns null when the resolver returns null", async () => {
    resolveTenant.mockResolvedValueOnce(null);
    await expect(getTenantBySlug("nope")).resolves.toBeNull();
  });
});

describe("getTenantFromRequest — delegates to resolveTenant({ kind: 'host' })", () => {
  it("derives host + pathname from the request and unwraps", async () => {
    resolveTenant.mockResolvedValueOnce({ tenantId: "t-1", tenant });
    const req = new Request("https://acme.budstacks.io/store/acme/products");

    await expect(getTenantFromRequest(req)).resolves.toMatchObject({ id: "t-1" });
    expect(resolveTenant).toHaveBeenCalledWith({
      kind: "host",
      host: "acme.budstacks.io",
      pathname: "/store/acme/products",
    });
  });

  it("prefers the Host header over the URL host", async () => {
    resolveTenant.mockResolvedValueOnce({ tenantId: "t-1", tenant });
    const req = new Request("https://internal.local/api/x", {
      headers: { host: "shop.example.com" },
    });

    await getTenantFromRequest(req);
    expect(resolveTenant).toHaveBeenCalledWith({
      kind: "host",
      host: "shop.example.com",
      pathname: "/api/x",
    });
  });

  it("swallows a resolver error and returns null", async () => {
    resolveTenant.mockRejectedValueOnce(new Error("db down"));
    const req = new Request("https://acme.budstacks.io/");
    await expect(getTenantFromRequest(req)).resolves.toBeNull();
  });
});
