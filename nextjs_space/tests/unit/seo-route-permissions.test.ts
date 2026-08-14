import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// SEO Supercharge US-010 — the granular permission gate on the SEO Manager.
// `canViewSeo` governs every read, `canEditSeo` every mutation, across all four
// SEO routes (pages, products/[id], posts/[id], conditions/[id]).
//
// Before this story every one of them was `withTenantAuth`-only: ANY member of
// the tenant — the support agent, the web designer — could rewrite the title
// Google shows for the store. That is the regression these tests pin.
//
// Module-boundary mocks only (getCurrentUser, prisma, permission resolution).
// The real auth wrapper, the real permission gate and the real pure resolver all
// execute, so this asserts the shipped precedence rules rather than a hand-made
// permission set. Mirrors tests/unit/email-route-permissions.test.ts (the PRD-301
// wrapper-conversion precedent).
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { resolveUserPermissions } = vi.hoisted(() => ({
  resolveUserPermissions: vi.fn(),
}));
const prismaMock = vi.hoisted(() => ({
  tenants: { findUnique: vi.fn() },
  products: { findFirst: vi.fn(), update: vi.fn() },
  posts: { findFirst: vi.fn(), update: vi.fn() },
  conditions: { findFirst: vi.fn(), update: vi.fn() },
  // The pages PUT writes through one raw statement (lib/seo/page-seo-write.ts).
  $queryRaw: vi.fn(),
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/permissions/current-user-permissions", () => ({
  resolveUserPermissions,
}));

import {
  resolvePermissions,
  type RolePermissionRow,
} from "@/lib/permissions/resolve";
import {
  GET as getPageSeo,
  PUT as putPageSeo,
} from "@/app/api/tenant-admin/seo/pages/route";
import {
  GET as getProductSeo,
  PUT as putProductSeo,
} from "@/app/api/tenant-admin/seo/products/[id]/route";
import {
  GET as getPostSeo,
  PUT as putPostSeo,
} from "@/app/api/tenant-admin/seo/posts/[id]/route";
import {
  GET as getConditionSeo,
  PUT as putConditionSeo,
} from "@/app/api/tenant-admin/seo/conditions/[id]/route";

const TENANT_A = "tenant-a";
const ENTITY_UUID = "11111111-1111-1111-1111-111111111111";

function adminUser(over: Record<string, unknown> = {}) {
  return {
    id: "admin_1",
    email: "admin@store.dev",
    name: "Admin",
    image: "",
    role: "TENANT_ADMIN",
    tenantId: TENANT_A,
    clerkOrgId: null,
    ...over,
  };
}

/** Run the REAL pure resolver — no I/O — so the fixtures can't drift from prod. */
function resolvedAs(teamRole: string | null, storedRow?: RolePermissionRow) {
  return {
    teamRole,
    permissions: resolvePermissions({ role: "TENANT_ADMIN", teamRole }, storedRow),
  };
}

/** A manager whose matrix was customised to read-only SEO access. */
const VIEW_ONLY = () => resolvedAs("manager", { canViewSeo: true });
/** The `editor` preset grants neither SEO key (preset-roles.ts leaves both off). */
const NO_SEO_ACCESS = () => resolvedAs("editor");
/** The owner's own role — always all-true, never editable. */
const OWNER_ADMIN = () => resolvedAs("admin");
/** Pre-teams user with a null teamRole — legacy full-access admin. */
const LEGACY_ADMIN = () => resolvedAs(null);

function request(method: string, path: string, body?: unknown) {
  return new NextRequest(`http://store.dev${path}`, {
    method,
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
        }),
  });
}

const params = { params: { id: ENTITY_UUID } };

interface RouteCall {
  name: string;
  run: () => Promise<Response>;
}

const READS: RouteCall[] = [
  {
    name: "GET seo/pages",
    run: () => getPageSeo(request("GET", "/api/tenant-admin/seo/pages")),
  },
  {
    name: "GET seo/products/[id]",
    run: () =>
      getProductSeo(
        request("GET", `/api/tenant-admin/seo/products/${ENTITY_UUID}`),
        params,
      ),
  },
  {
    name: "GET seo/posts/[id]",
    run: () =>
      getPostSeo(
        request("GET", `/api/tenant-admin/seo/posts/${ENTITY_UUID}`),
        params,
      ),
  },
  {
    name: "GET seo/conditions/[id]",
    run: () =>
      getConditionSeo(
        request("GET", `/api/tenant-admin/seo/conditions/${ENTITY_UUID}`),
        params,
      ),
  },
];

const WRITES: RouteCall[] = [
  {
    name: "PUT seo/pages",
    run: () =>
      putPageSeo(
        request("PUT", "/api/tenant-admin/seo/pages", {
          pageKey: "about",
          seo: { title: "Rewritten by a viewer" },
        }),
      ),
  },
  {
    name: "PUT seo/products/[id]",
    run: () =>
      putProductSeo(
        request("PUT", `/api/tenant-admin/seo/products/${ENTITY_UUID}`, {
          title: "Rewritten by a viewer",
        }),
        params,
      ),
  },
  {
    name: "PUT seo/posts/[id]",
    run: () =>
      putPostSeo(
        request("PUT", `/api/tenant-admin/seo/posts/${ENTITY_UUID}`, {
          title: "Rewritten by a viewer",
        }),
        params,
      ),
  },
  {
    name: "PUT seo/conditions/[id]",
    run: () =>
      putConditionSeo(
        request("PUT", `/api/tenant-admin/seo/conditions/${ENTITY_UUID}`, {
          title: "Rewritten by a viewer",
        }),
        params,
      ),
  },
];

/** Nothing may reach the database on a denied mutation. */
function expectNoWrites() {
  expect(prismaMock.products.update).not.toHaveBeenCalled();
  expect(prismaMock.posts.update).not.toHaveBeenCalled();
  expect(prismaMock.conditions.update).not.toHaveBeenCalled();
  expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue(adminUser());
  resolveUserPermissions.mockResolvedValue(OWNER_ADMIN());

  prismaMock.tenants.findUnique.mockResolvedValue({ pageSeo: {} });
  prismaMock.$queryRaw.mockResolvedValue([{ pageSeo: { about: { title: "x" } } }]);
  prismaMock.products.findFirst.mockResolvedValue({
    id: ENTITY_UUID,
    name: "Blue Dream",
    slug: "blue-dream",
    seo: null,
    tenantId: TENANT_A,
  });
  prismaMock.products.update.mockResolvedValue({ id: ENTITY_UUID, name: "Blue Dream", seo: {} });
  prismaMock.posts.findFirst.mockResolvedValue({
    id: ENTITY_UUID,
    title: "A post",
    slug: "a-post",
    seo: null,
    tenantId: TENANT_A,
  });
  prismaMock.posts.update.mockResolvedValue({ id: ENTITY_UUID, title: "A post", seo: {} });
  prismaMock.conditions.findFirst.mockResolvedValue({
    id: ENTITY_UUID,
    name: "Chronic pain",
    slug: "chronic-pain",
    seo: null,
    tenantId: TENANT_A,
  });
  prismaMock.conditions.update.mockResolvedValue({
    id: ENTITY_UUID,
    name: "Chronic pain",
    seo: {},
  });
});

describe("permission fixtures resolve the way PRD-301 says they do", () => {
  it("gives the owner-admin role — and legacy null-teamRole users — both SEO keys", () => {
    for (const subject of [OWNER_ADMIN(), LEGACY_ADMIN()]) {
      expect(subject.permissions.canViewSeo).toBe(true);
      expect(subject.permissions.canEditSeo).toBe(true);
    }
  });

  it("gives no non-admin preset either SEO key by default", () => {
    // US-010 adds the keys fail-closed: PRD-301 AC-2 fixed the five preset
    // defaults before SEO had keys, so a tenant grants these explicitly in the
    // roles matrix rather than finding them switched on under a role they
    // already assigned.
    for (const preset of ["editor", "customer_support", "web_designer", "manager"]) {
      expect(resolvedAs(preset).permissions.canViewSeo).toBe(false);
      expect(resolvedAs(preset).permissions.canEditSeo).toBe(false);
    }
  });

  it("honours a stored matrix row that grants view without edit", () => {
    expect(VIEW_ONLY().permissions.canViewSeo).toBe(true);
    expect(VIEW_ONLY().permissions.canEditSeo).toBe(false);
  });
});

describe("canEditSeo gates every SEO mutation", () => {
  // The headline AC: a member holding canViewSeo only must not be able to
  // rewrite the metadata a search engine shows for the store.
  it.each(WRITES)("403s a canViewSeo-only member on $name", async ({ run }) => {
    resolveUserPermissions.mockResolvedValue(VIEW_ONLY());

    const res = await run();

    expect(res.status).toBe(403);
    expectNoWrites();
  });

  it("returns the standard error shape on denial, with no internals", async () => {
    resolveUserPermissions.mockResolvedValue(VIEW_ONLY());

    const res = await WRITES[0].run(); // PUT seo/pages
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json).toEqual({ error: expect.any(String) });
    expect(json.error).not.toMatch(/prisma|tenant-a|stack/i);
  });

  it.each(WRITES)("lets the owner-admin through on $name", async ({ run }) => {
    resolveUserPermissions.mockResolvedValue(OWNER_ADMIN());

    const res = await run();

    expect(res.status).toBe(200);
  });
});

describe("canViewSeo gates every SEO read", () => {
  it.each(READS)("403s a member without canViewSeo on $name", async ({ run }) => {
    resolveUserPermissions.mockResolvedValue(NO_SEO_ACCESS());

    const res = await run();

    expect(res.status).toBe(403);
    expect(prismaMock.tenants.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.products.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.posts.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.conditions.findFirst).not.toHaveBeenCalled();
  });

  it.each(READS)("lets a canViewSeo-only member read $name", async ({ run }) => {
    resolveUserPermissions.mockResolvedValue(VIEW_ONLY());

    expect((await run()).status).toBe(200);
  });

  it.each(READS)("lets the owner-admin read $name", async ({ run }) => {
    resolveUserPermissions.mockResolvedValue(OWNER_ADMIN());

    expect((await run()).status).toBe(200);
  });
});

describe("the gate sits behind authentication, not in front of it", () => {
  it.each([...READS, ...WRITES])(
    "401s an unauthenticated caller on $name — before resolving permissions",
    async ({ run }) => {
      getCurrentUser.mockResolvedValue(null);

      const res = await run();

      expect(res.status).toBe(401);
      expect(resolveUserPermissions).not.toHaveBeenCalled();
      expectNoWrites();
    },
  );

  it("resolves permissions against the caller's OWN tenant", async () => {
    resolveUserPermissions.mockResolvedValue(OWNER_ADMIN());

    await READS[0].run();

    expect(resolveUserPermissions).toHaveBeenCalledWith(
      expect.objectContaining({ id: "admin_1" }),
      TENANT_A,
    );
  });
});
