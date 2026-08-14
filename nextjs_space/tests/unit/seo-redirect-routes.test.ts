import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * SEO Supercharge US-020 — the two gates on the redirect routes, and the write
 * rules they enforce.
 *
 * THE CLAIM UNDER TEST is the one the story is explicit about: gating in the UI
 * is not gating. A Basic tenant's admin hitting these routes by hand must get a
 * 403 with `upgrade_required`, and a member without `canEditSeo` must get a 403
 * before the plan is ever looked up.
 *
 * Module-boundary mocks only (getCurrentUser, prisma, permission resolution).
 * The real auth wrapper, the real permission gate, the real `requireFeature` and
 * the real validation all execute. Mirrors tests/unit/seo-route-permissions.ts,
 * the US-010 precedent.
 */
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { resolveUserPermissions } = vi.hoisted(() => ({
  resolveUserPermissions: vi.fn(),
}));
const prismaMock = vi.hoisted(() => ({
  tenants: { findFirst: vi.fn() },
  seo_redirects: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/permissions/current-user-permissions", () => ({
  resolveUserPermissions,
}));

import { UPGRADE_REQUIRED_CODE } from "@/lib/entitlements/require-feature";
import { SEO_REDIRECT_MAX_PER_TENANT } from "@/lib/seo/redirects";
import {
  GET as listRedirects,
  POST as createRedirect,
} from "@/app/api/tenant-admin/seo/redirects/route";
import {
  DELETE as deleteRedirect,
  PUT as updateRedirect,
} from "@/app/api/tenant-admin/seo/redirects/[id]/route";

const TENANT_A = "tenant-a";
const ROW_ID = "11111111-1111-1111-1111-111111111111";

function adminUser() {
  return {
    id: "admin_1",
    email: "admin@store.dev",
    name: "Admin",
    image: "",
    role: "TENANT_ADMIN",
    tenantId: TENANT_A,
    clerkOrgId: null,
  };
}

function allowAll() {
  return {
    permissions: { canViewSeo: true, canEditSeo: true },
    teamRole: "OWNER",
  };
}

function post(body: unknown) {
  return new NextRequest("http://localhost/api/tenant-admin/seo/redirects", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function put(body: unknown) {
  return new NextRequest(
    `http://localhost/api/tenant-admin/seo/redirects/${ROW_ID}`,
    {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    },
  );
}

/** The tenant's plan, as `getTenantPlan` reads it. */
function onPlan(plan: string) {
  prismaMock.tenants.findFirst.mockResolvedValue({ plan });
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue(adminUser());
  resolveUserPermissions.mockResolvedValue(allowAll());
  onPlan("pro");
  prismaMock.seo_redirects.findMany.mockResolvedValue([]);
  prismaMock.seo_redirects.findFirst.mockResolvedValue({
    id: ROW_ID,
    fromPath: "/old",
  });
  prismaMock.seo_redirects.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: ROW_ID,
      createdAt: new Date("2026-08-14T00:00:00.000Z"),
      ...data,
    }),
  );
  prismaMock.seo_redirects.update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: ROW_ID,
      fromPath: "/old",
      statusCode: 301,
      createdAt: new Date("2026-08-14T00:00:00.000Z"),
      ...data,
    }),
  );
  prismaMock.seo_redirects.delete.mockResolvedValue({ id: ROW_ID });
});

describe("plan gate — a Basic tenant is refused at the API, not just in the UI", () => {
  it("403s a create with upgrade_required", async () => {
    onPlan("basic");

    const response = await createRedirect(post({ fromPath: "/a", toPath: "/b" }));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: UPGRADE_REQUIRED_CODE,
      feature: "seo.pro",
      plan: "basic",
    });
    expect(prismaMock.seo_redirects.create).not.toHaveBeenCalled();
  });

  it("403s a retarget and a delete", async () => {
    onPlan("basic");

    expect((await updateRedirect(put({ toPath: "/c" }), { params: { id: ROW_ID } })).status).toBe(403);
    expect(
      (
        await deleteRedirect(
          new NextRequest(
            `http://localhost/api/tenant-admin/seo/redirects/${ROW_ID}`,
            { method: "DELETE" },
          ),
          { params: { id: ROW_ID } },
        )
      ).status,
    ).toBe(403);
    expect(prismaMock.seo_redirects.update).not.toHaveBeenCalled();
    expect(prismaMock.seo_redirects.delete).not.toHaveBeenCalled();
  });

  it("still LISTS for a Basic tenant — a downgrade is not data loss", async () => {
    onPlan("basic");
    prismaMock.seo_redirects.findMany.mockResolvedValue([
      { id: ROW_ID, fromPath: "/old", toPath: "/new", statusCode: 301, createdAt: new Date() },
    ]);

    const response = await listRedirects(
      new NextRequest("http://localhost/api/tenant-admin/seo/redirects"),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).redirects).toHaveLength(1);
  });

  it("lets trial and pro through", async () => {
    for (const plan of ["trial", "pro", "custom"]) {
      onPlan(plan);
      const response = await createRedirect(
        post({ fromPath: `/old-${plan}`, toPath: "/new" }),
      );
      expect(response.status, plan).toBe(201);
    }
  });
});

describe("permission gate — composes with the plan gate", () => {
  it("403s an editless member before the plan is looked up", async () => {
    resolveUserPermissions.mockResolvedValue({
      permissions: { canViewSeo: true, canEditSeo: false },
      teamRole: "SUPPORT",
    });

    const response = await createRedirect(post({ fromPath: "/a", toPath: "/b" }));

    expect(response.status).toBe(403);
    expect(prismaMock.tenants.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.seo_redirects.create).not.toHaveBeenCalled();
  });

  it("403s a viewless member on the list", async () => {
    resolveUserPermissions.mockResolvedValue({
      permissions: { canViewSeo: false, canEditSeo: false },
      teamRole: "SUPPORT",
    });

    const response = await listRedirects(
      new NextRequest("http://localhost/api/tenant-admin/seo/redirects"),
    );

    expect(response.status).toBe(403);
    expect(prismaMock.seo_redirects.findMany).not.toHaveBeenCalled();
  });
});

describe("write rules", () => {
  it("stores the normalised, lower-cased fromPath and the cased toPath", async () => {
    await createRedirect(post({ fromPath: "/Old-Page/?x=1", toPath: "/New-Page/" }));

    expect(prismaMock.seo_redirects.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: TENANT_A,
          fromPath: "/old-page",
          toPath: "/New-Page",
          statusCode: 301,
        }),
      }),
    );
  });

  it("refuses a reserved path", async () => {
    for (const fromPath of [
      "/api/anything",
      "/tenant-admin",
      "/super-admin/x",
      "/sitemap.xml",
      "/robots.txt",
    ]) {
      const response = await createRedirect(post({ fromPath, toPath: "/ok" }));
      expect(response.status, fromPath).toBe(400);
      expect((await response.json()).code, fromPath).toBe("reserved_from");
    }
    expect(prismaMock.seo_redirects.create).not.toHaveBeenCalled();
  });

  it("refuses an absolute destination — that would be an open redirect", async () => {
    const response = await createRedirect(
      post({ fromPath: "/old", toPath: "https://evil.example/phish" }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("invalid_to");
  });

  it("refuses a self-redirect", async () => {
    const response = await createRedirect(
      post({ fromPath: "/loop", toPath: "/LOOP/" }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("self_redirect");
  });

  it("refuses A->B when B->A already exists", async () => {
    prismaMock.seo_redirects.findMany.mockResolvedValue([
      { id: "other", fromPath: "/b", toPath: "/a" },
    ]);

    const response = await createRedirect(post({ fromPath: "/a", toPath: "/b" }));

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("loop");
  });

  it("refuses the create that would exceed the per-tenant cap", async () => {
    prismaMock.seo_redirects.findMany.mockResolvedValue(
      Array.from({ length: SEO_REDIRECT_MAX_PER_TENANT }, (_, i) => ({
        id: `r${i}`,
        fromPath: `/p${i}`,
        toPath: "/new",
      })),
    );

    const response = await createRedirect(post({ fromPath: "/one-more", toPath: "/new" }));

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("limit_reached");
  });

  it("409s a duplicate rather than leaking the constraint name", async () => {
    prismaMock.seo_redirects.create.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );

    const response = await createRedirect(post({ fromPath: "/old", toPath: "/new" }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("duplicate_from");
    expect(JSON.stringify(body)).not.toContain("Unique constraint");
  });

  it("retargets an existing rule without tripping its own loop check", async () => {
    prismaMock.seo_redirects.findMany.mockResolvedValue([
      { id: ROW_ID, fromPath: "/old", toPath: "/new" },
    ]);

    const response = await updateRedirect(put({ toPath: "/newer" }), { params: { id: ROW_ID } });

    expect(response.status).toBe(200);
    expect(prismaMock.seo_redirects.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ROW_ID },
        data: expect.objectContaining({ toPath: "/newer" }),
      }),
    );
  });

  it("404s a retarget of another tenant's row", async () => {
    prismaMock.seo_redirects.findFirst.mockResolvedValue(null);

    const response = await updateRedirect(put({ toPath: "/x" }), { params: { id: ROW_ID } });

    expect(response.status).toBe(404);
    expect(prismaMock.seo_redirects.update).not.toHaveBeenCalled();
  });

  it("scopes the delete lookup by tenantId", async () => {
    await deleteRedirect(
      new NextRequest(
        `http://localhost/api/tenant-admin/seo/redirects/${ROW_ID}`,
        { method: "DELETE" },
      ),
      { params: { id: ROW_ID } },
    );

    expect(prismaMock.seo_redirects.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ROW_ID, tenantId: TENANT_A },
      }),
    );
  });
});
