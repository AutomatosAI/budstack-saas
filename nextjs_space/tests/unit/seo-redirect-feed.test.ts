import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * SEO Supercharge US-020 — the public feed middleware refreshes from.
 *
 * THE CONTRACT: a Basic tenant's rules go DORMANT, not missing. They stay in the
 * table, they stay listed in the manager, and this feed hands middleware an
 * empty array so nothing fires. The same empty array answers an unknown host, so
 * the endpoint cannot be walked to learn which stores are on which plan.
 */
const { resolveTenant } = vi.hoisted(() => ({ resolveTenant: vi.fn() }));
const { withinPublicRateLimit } = vi.hoisted(() => ({
  withinPublicRateLimit: vi.fn(),
}));
const prismaMock = vi.hoisted(() => ({
  seo_redirects: { findMany: vi.fn() },
  platform_seo_redirects: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/tenant/tenant-resolver", () => ({ resolveTenant }));
vi.mock("@/lib/security/abandonable-rate-limit", () => ({
  withinPublicRateLimit,
}));

import { GET as redirectFeed } from "@/app/api/public/seo/redirects/route";

const TENANT_ID = "tenant-a";
const ROWS = [{ fromPath: "/old", toPath: "/new", statusCode: 301 }];
const PLATFORM_ROWS = [
  { fromPath: "/blog/old-post", toPath: "/blog/new-post", statusCode: 301 },
];

function request(query: Record<string, string>) {
  const url = new URL("http://localhost/api/public/seo/redirects");
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

function tenantOnPlan(plan: string) {
  resolveTenant.mockResolvedValue({
    tenantId: TENANT_ID,
    tenant: { id: TENANT_ID, plan },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  withinPublicRateLimit.mockResolvedValue(true);
  prismaMock.seo_redirects.findMany.mockResolvedValue(ROWS);
  prismaMock.platform_seo_redirects.findMany.mockResolvedValue(PLATFORM_ROWS);
  tenantOnPlan("pro");
});

describe("GET /api/public/seo/redirects", () => {
  it("returns the table for a Pro tenant, scoped by tenantId", async () => {
    const response = await redirectFeed(request({ host: "acme.budstacks.io" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ redirects: ROWS });
    expect(prismaMock.seo_redirects.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_ID } }),
    );
  });

  it("resolves the tenant from the supplied host, never a tenant id", async () => {
    await redirectFeed(request({ host: "shop.example", path: "/old" }));

    expect(resolveTenant).toHaveBeenCalledWith({
      kind: "host",
      host: "shop.example",
      pathname: "/old",
    });
  });

  it("goes dormant for a Basic tenant without querying the table", async () => {
    tenantOnPlan("basic");

    const response = await redirectFeed(request({ host: "acme.budstacks.io" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ redirects: [] });
    expect(prismaMock.seo_redirects.findMany).not.toHaveBeenCalled();
  });

  it("answers an unknown host identically, so plans cannot be enumerated", async () => {
    resolveTenant.mockResolvedValue(null);

    const response = await redirectFeed(request({ host: "nobody.example" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ redirects: [] });
  });

  it("answers a missing host with no redirects rather than an error", async () => {
    const response = await redirectFeed(request({}));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ redirects: [] });
    expect(resolveTenant).not.toHaveBeenCalled();
  });

  it("is never cached by anything but middleware's own table", async () => {
    const response = await redirectFeed(request({ host: "acme.budstacks.io" }));

    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("429s over the cap, which the lookup reads as no redirects", async () => {
    withinPublicRateLimit.mockResolvedValue(false);

    const response = await redirectFeed(request({ host: "acme.budstacks.io" }));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(prismaMock.seo_redirects.findMany).not.toHaveBeenCalled();
  });

  it("unlocks for trial and custom, matching every other seo.pro surface", async () => {
    for (const plan of ["trial", "custom"]) {
      vi.clearAllMocks();
      withinPublicRateLimit.mockResolvedValue(true);
      prismaMock.seo_redirects.findMany.mockResolvedValue(ROWS);
      tenantOnPlan(plan);

      const response = await redirectFeed(request({ host: "acme.budstacks.io" }));
      expect((await response.json()).redirects, plan).toEqual(ROWS);
    }
  });
});

/**
 * Platform US-019 — the same feed, the other table. budstacks.io's redirects
 * belong to no tenant and are gated by no plan, so the two branches share
 * nothing but the rate limit and the response shape.
 */
describe("GET /api/public/seo/redirects?scope=platform", () => {
  const platformRequest = () =>
    request({ host: "budstacks.io", path: "/blog/old-post", scope: "platform" });

  it("answers from platform_seo_redirects", async () => {
    const response = await redirectFeed(platformRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ redirects: PLATFORM_ROWS });
  });

  it("resolves no tenant and reads no tenant table", async () => {
    // Both would be answering a question the apex does not ask. resolveTenant
    // on the apex host returns nothing useful anyway; calling it would just be
    // a query per refresh.
    await redirectFeed(platformRequest());

    expect(resolveTenant).not.toHaveBeenCalled();
    expect(prismaMock.seo_redirects.findMany).not.toHaveBeenCalled();
  });

  it("is not plan-gated — the platform is not a customer of itself", async () => {
    tenantOnPlan("basic");

    const response = await redirectFeed(platformRequest());

    expect((await response.json()).redirects).toEqual(PLATFORM_ROWS);
  });

  it("scopes by nothing, and orders by insertion for the cache", async () => {
    await redirectFeed(platformRequest());

    const read = prismaMock.platform_seo_redirects.findMany.mock.calls[0][0];
    expect(read).not.toHaveProperty("where");
    expect(read.orderBy).toEqual({ createdAt: "asc" });
  });

  it("ignores an unrecognised scope and answers as a tenant would", async () => {
    // Fail-closed parsing: the whole query is refused rather than silently
    // treated as the platform.
    const response = await redirectFeed(
      request({ host: "acme.budstacks.io", scope: "everything" }),
    );

    expect(await response.json()).toEqual({ redirects: [] });
    expect(prismaMock.platform_seo_redirects.findMany).not.toHaveBeenCalled();
  });

  it("is rate-limited on the same bucket", async () => {
    withinPublicRateLimit.mockResolvedValue(false);

    const response = await redirectFeed(platformRequest());

    expect(response.status).toBe(429);
    expect(prismaMock.platform_seo_redirects.findMany).not.toHaveBeenCalled();
  });
});
