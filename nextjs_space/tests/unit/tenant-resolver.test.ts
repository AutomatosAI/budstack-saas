import { describe, it, expect, vi, beforeEach } from "vitest";

// PRD-205 US-002 (AC-1 / AC-1a / AC-1b) — the canonical resolveTenant(input).
//
// Module-boundary mocks (allowed): the Prisma client (@/lib/db) and next/headers
// are stubbed so the resolver's BRANCHING is exercised without a real DB. The
// tenant-context primitive runs REAL (NOT mocked) — that is how the return-not-bind
// proof (AC-1a) is meaningful: if the resolver ever bound the ALS, getTenantContext()
// would observe it. DB mocks here drive the resolver's logic; they do NOT stand in
// for the Docker integration proof (US-009), which exercises real active/inactive rows.
const { findFirst, findMany, headersMock } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
  headersMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { tenants: { findFirst }, users: { findMany } },
}));
vi.mock("next/headers", () => ({ headers: headersMock }));

import {
  resolveTenant,
  isAmbiguousTenantResolution,
} from "@/lib/tenant-resolver";
import { getTenantContext, hasTenantContext } from "@/lib/tenant-context";

// A plain row shaped like prisma.tenants — the mocked findFirst is untyped so no cast.
function tenantRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "t-1",
    subdomain: "acme",
    customDomain: null,
    isActive: true,
    settings: {},
    ...overrides,
  };
}

function setHeaders(map: Record<string, string>) {
  headersMock.mockReturnValue({
    get: (key: string) => map[key] ?? null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setHeaders({});
});

describe("PRD-205 AC-1 — resolveTenant resolves each kind to the right tenant", () => {
  it("kind:'slug' resolves via subdomain (isActive-enforced)", async () => {
    findFirst.mockResolvedValueOnce(tenantRow());

    const result = await resolveTenant({ kind: "slug", slug: "acme" });

    expect(result).toEqual({ tenantId: "t-1", tenant: tenantRow() });
    expect(findFirst).toHaveBeenCalledWith({
      where: { subdomain: "acme", isActive: true },
    });
  });

  it("kind:'headers' prefers x-tenant-slug", async () => {
    setHeaders({ "x-tenant-slug": "acme" });
    findFirst.mockResolvedValueOnce(tenantRow());

    const result = await resolveTenant({ kind: "headers" });

    expect(result).toMatchObject({ tenantId: "t-1" });
    expect(findFirst).toHaveBeenCalledWith({
      where: { subdomain: "acme", isActive: true },
    });
  });

  it("kind:'headers' falls back x-tenant-subdomain then x-tenant-custom-domain", async () => {
    setHeaders({ "x-tenant-subdomain": "beta" });
    findFirst.mockResolvedValueOnce(tenantRow({ id: "t-2", subdomain: "beta" }));
    let result = await resolveTenant({ kind: "headers" });
    expect(result).toMatchObject({ tenantId: "t-2" });
    expect(findFirst).toHaveBeenLastCalledWith({
      where: { subdomain: "beta", isActive: true },
    });

    setHeaders({ "x-tenant-custom-domain": "shop.example.com" });
    findFirst.mockResolvedValueOnce(
      tenantRow({ id: "t-3", customDomain: "shop.example.com" }),
    );
    result = await resolveTenant({ kind: "headers" });
    expect(result).toMatchObject({ tenantId: "t-3" });
    expect(findFirst).toHaveBeenLastCalledWith({
      where: { customDomain: "shop.example.com", isActive: true },
    });
  });

  it("kind:'headers' with no tenant headers resolves to null", async () => {
    setHeaders({});
    const result = await resolveTenant({ kind: "headers" });
    expect(result).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("kind:'host' subdomain host maps via the shared parser", async () => {
    findFirst.mockResolvedValueOnce(tenantRow());
    const result = await resolveTenant({
      kind: "host",
      host: "acme.budstacks.io",
      pathname: "/",
    });
    expect(result).toMatchObject({ tenantId: "t-1" });
    expect(findFirst).toHaveBeenCalledWith({
      where: { subdomain: "acme", isActive: true },
    });
  });

  it("kind:'host' path-based /store/{slug} wins over the host", async () => {
    findFirst.mockResolvedValueOnce(tenantRow({ id: "t-path", subdomain: "frompath" }));
    const result = await resolveTenant({
      kind: "host",
      host: "www.budstacks.io",
      pathname: "/store/frompath/products",
    });
    expect(result).toMatchObject({ tenantId: "t-path" });
    expect(findFirst).toHaveBeenCalledWith({
      where: { subdomain: "frompath", isActive: true },
    });
  });

  it("kind:'host' custom domain maps to a customDomain lookup", async () => {
    findFirst.mockResolvedValueOnce(
      tenantRow({ id: "t-cd", customDomain: "shop.example.com" }),
    );
    const result = await resolveTenant({
      kind: "host",
      host: "shop.example.com",
      pathname: "/",
    });
    expect(result).toMatchObject({ tenantId: "t-cd" });
    expect(findFirst).toHaveBeenCalledWith({
      where: { customDomain: "shop.example.com", isActive: true },
    });
  });

  it("kind:'host' with an untenanted host (base apex) resolves to null", async () => {
    const result = await resolveTenant({
      kind: "host",
      host: "budstacks.io",
      pathname: "/",
    });
    expect(result).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("retries a lower-cased subdomain when the verbatim lookup misses", async () => {
    findFirst
      .mockResolvedValueOnce(null) // "ACME" miss
      .mockResolvedValueOnce(tenantRow()); // "acme" hit

    const result = await resolveTenant({ kind: "slug", slug: "ACME" });

    expect(result).toMatchObject({ tenantId: "t-1" });
    expect(findFirst).toHaveBeenNthCalledWith(1, {
      where: { subdomain: "ACME", isActive: true },
    });
    expect(findFirst).toHaveBeenNthCalledWith(2, {
      where: { subdomain: "acme", isActive: true },
    });
  });
});

describe("PRD-205 AC-1b — isActive is enforced on every kind (inactive → null)", () => {
  it("subdomain: an inactive tenant (findFirst null under isActive:true) resolves to null", async () => {
    findFirst.mockResolvedValue(null);
    const result = await resolveTenant({ kind: "slug", slug: "acme" });
    expect(result).toBeNull();
    // Both the verbatim and lower-case attempts carry isActive:true.
    for (const call of findFirst.mock.calls) {
      expect(call[0].where).toMatchObject({ isActive: true });
    }
  });

  it("custom domain: isActive:true is part of the where", async () => {
    findFirst.mockResolvedValue(null);
    const result = await resolveTenant({
      kind: "host",
      host: "shop.example.com",
      pathname: "/",
    });
    expect(result).toBeNull();
    expect(findFirst).toHaveBeenCalledWith({
      where: { customDomain: "shop.example.com", isActive: true },
    });
  });

  it("clerk-org: the settings.clerkOrgId lookup is isActive-enforced", async () => {
    findFirst.mockResolvedValueOnce(tenantRow({ id: "t-org" }));
    const result = await resolveTenant({
      kind: "clerk",
      clerkOrgId: "org_123",
      email: null,
    });
    expect(result).toMatchObject({ tenantId: "t-org" });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        isActive: true,
        settings: { path: ["clerkOrgId"], equals: "org_123" },
      },
    });
  });
});

describe("PRD-205 AC-1b — clerk email fallback: ambiguity-aware, active-only", () => {
  it("a single active tenant for the email resolves", async () => {
    findMany.mockResolvedValueOnce([
      { email: "a@x.io", tenants: tenantRow({ id: "t-solo" }) },
    ]);
    const result = await resolveTenant({
      kind: "clerk",
      clerkOrgId: null,
      email: "a@x.io",
    });
    expect(result).toMatchObject({ tenantId: "t-solo" });
  });

  it("only INACTIVE tenants for the email resolves to null (gap closed)", async () => {
    findMany.mockResolvedValueOnce([
      { email: "a@x.io", tenants: tenantRow({ id: "t-dead", isActive: false }) },
    ]);
    const result = await resolveTenant({
      kind: "clerk",
      clerkOrgId: null,
      email: "a@x.io",
    });
    expect(result).toBeNull();
  });

  it(">1 distinct ACTIVE tenant returns a typed AmbiguousTenantResolution (never a silent pick)", async () => {
    findMany.mockResolvedValueOnce([
      { email: "a@x.io", tenants: tenantRow({ id: "t-A" }) },
      { email: "a@x.io", tenants: tenantRow({ id: "t-B" }) },
    ]);
    const result = await resolveTenant({
      kind: "clerk",
      clerkOrgId: null,
      email: "a@x.io",
    });
    expect(isAmbiguousTenantResolution(result)).toBe(true);
    if (isAmbiguousTenantResolution(result)) {
      expect(result.candidateCount).toBe(2);
      expect(result.email).toBe("a@x.io");
      expect(result.source).toBe("clerk-email");
    }
  });

  it("two users pointing at the SAME active tenant dedupe to a single resolution", async () => {
    findMany.mockResolvedValueOnce([
      { email: "a@x.io", tenants: tenantRow({ id: "t-same" }) },
      { email: "a@x.io", tenants: tenantRow({ id: "t-same" }) },
    ]);
    const result = await resolveTenant({
      kind: "clerk",
      clerkOrgId: null,
      email: "a@x.io",
    });
    expect(isAmbiguousTenantResolution(result)).toBe(false);
    expect(result).toMatchObject({ tenantId: "t-same" });
  });

  it("falls back to email when the clerk-org lookup misses", async () => {
    findFirst.mockResolvedValueOnce(null); // org miss
    findMany.mockResolvedValueOnce([
      { email: "a@x.io", tenants: tenantRow({ id: "t-fallback" }) },
    ]);
    const result = await resolveTenant({
      kind: "clerk",
      clerkOrgId: "org_unknown",
      email: "a@x.io",
    });
    expect(result).toMatchObject({ tenantId: "t-fallback" });
  });

  it("neither clerkOrgId nor email resolves to null", async () => {
    const result = await resolveTenant({
      kind: "clerk",
      clerkOrgId: null,
      email: null,
    });
    expect(result).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("PRD-205 AC-1a — return-not-bind (resolver never touches the ALS)", () => {
  it("the tenant context stays unbound before AND after a resolve, for every kind", async () => {
    expect(getTenantContext()).toBeNull();
    expect(hasTenantContext()).toBe(false);

    findFirst.mockResolvedValue(tenantRow());
    await resolveTenant({ kind: "slug", slug: "acme" });
    await resolveTenant({ kind: "host", host: "acme.budstacks.io", pathname: "/" });
    setHeaders({ "x-tenant-slug": "acme" });
    await resolveTenant({ kind: "headers" });

    findFirst.mockResolvedValueOnce(tenantRow({ id: "t-org" }));
    await resolveTenant({ kind: "clerk", clerkOrgId: "org_1", email: null });

    // If the resolver had bound the ALS, the store would persist here.
    expect(getTenantContext()).toBeNull();
    expect(hasTenantContext()).toBe(false);
  });
});
