import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// US-024 — customer tags: canonical tag form, tenant-scoped add/remove,
// idempotent duplicate adds (P2002), the customers-list tag filter, and the
// canEditCustomers gate on every mutation.
//
// Module-boundary mocks only (getCurrentUser, prisma, permission resolution) —
// the real auth wrappers, the real permission gate, the real zod schemas and
// the real tag store all execute, so what is asserted is the shipped route
// behaviour, not a re-implementation of it.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { resolveUserPermissions } = vi.hoisted(() => ({
  resolveUserPermissions: vi.fn(),
}));
const prismaMock = vi.hoisted(() => ({
  users: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  customer_tags: {
    create: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
  },
  consultation_questionnaires: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/permissions/current-user-permissions", () => ({
  resolveUserPermissions,
}));

import { resolvePermissions, type RolePermissionRow } from "@/lib/permissions/resolve";
import { normalizeTag, tagSchema, TAG_MAX_LENGTH } from "@/lib/customers/tag-format";
import {
  POST as addTag,
  DELETE as removeTag,
} from "@/app/api/tenant-admin/customers/[id]/tags/route";
import { GET as listCustomers } from "@/app/api/tenant-admin/customers/route";

const TENANT_A = "tenant-a";
const CUSTOMER_UUID = "22222222-2222-2222-2222-222222222222";

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

/** A manager whose matrix grants customer READS but not writes. */
const VIEW_ONLY = () => resolvedAs("manager", { canViewCustomers: true });
/** The owner's own role — always all-true. */
const OWNER_ADMIN = () => resolvedAs("admin");

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

function postTag(body: unknown, id: string = CUSTOMER_UUID) {
  return addTag(
    request("POST", `/api/tenant-admin/customers/${id}/tags`, body),
    { params: { id } },
  );
}

function deleteTag(query: string, id: string = CUSTOMER_UUID) {
  return removeTag(
    request("DELETE", `/api/tenant-admin/customers/${id}/tags${query}`),
    { params: { id } },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue(adminUser());
  resolveUserPermissions.mockResolvedValue(OWNER_ADMIN());

  prismaMock.users.findFirst.mockResolvedValue({ id: CUSTOMER_UUID });
  prismaMock.users.findMany.mockResolvedValue([]);
  prismaMock.users.count.mockResolvedValue(0);
  prismaMock.customer_tags.create.mockResolvedValue({ id: "tag-row-1" });
  prismaMock.customer_tags.deleteMany.mockResolvedValue({ count: 1 });
  prismaMock.customer_tags.findMany.mockResolvedValue([{ tag: "vip" }]);
  prismaMock.consultation_questionnaires.findMany.mockResolvedValue([]);
});

describe("tag canonical form", () => {
  it("normalises to trimmed lowercase", () => {
    expect(normalizeTag("  VIP Customer ")).toBe("vip customer");
    expect(tagSchema.parse("  ReOrder-60d  ")).toBe("reorder-60d");
  });

  it("rejects empty and whitespace-only tags", () => {
    expect(tagSchema.safeParse("").success).toBe(false);
    expect(tagSchema.safeParse("   ").success).toBe(false);
    expect(tagSchema.safeParse(null).success).toBe(false);
    expect(tagSchema.safeParse(undefined).success).toBe(false);
  });

  it(`caps the NORMALISED form at ${TAG_MAX_LENGTH} chars`, () => {
    expect(tagSchema.safeParse("x".repeat(TAG_MAX_LENGTH)).success).toBe(true);
    expect(tagSchema.safeParse("x".repeat(TAG_MAX_LENGTH + 1)).success).toBe(false);
    // 44 raw chars that trim to 40 are fine — the cap runs after normalisation.
    expect(tagSchema.safeParse(`  ${"x".repeat(TAG_MAX_LENGTH)}  `).success).toBe(true);
  });
});

describe("POST /customers/[id]/tags", () => {
  it("stores the normalised tag, scoped to the caller's tenant", async () => {
    const res = await postTag({ tag: "  VIP  " });

    expect(res.status).toBe(200);
    // Ownership check ran inside the caller's tenant, never across it.
    expect(prismaMock.users.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CUSTOMER_UUID, tenantId: TENANT_A, role: "PATIENT" },
      }),
    );
    expect(prismaMock.customer_tags.create).toHaveBeenCalledWith({
      data: { tenantId: TENANT_A, userId: CUSTOMER_UUID, tag: "vip" },
    });
    expect(await res.json()).toEqual({ tags: ["vip"] });
  });

  it("treats a duplicate add (P2002) as an idempotent success", async () => {
    prismaMock.customer_tags.create.mockRejectedValue({ code: "P2002" });

    const res = await postTag({ tag: "vip" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tags: ["vip"] });
  });

  it("does NOT swallow non-duplicate database errors", async () => {
    prismaMock.customer_tags.create.mockRejectedValue(new Error("connection reset"));

    const res = await postTag({ tag: "vip" });

    expect(res.status).toBe(500);
  });

  it("404s — without writing — when the id is not one of this tenant's customers", async () => {
    prismaMock.users.findFirst.mockResolvedValue(null);

    const res = await postTag({ tag: "vip" });

    expect(res.status).toBe(404);
    expect(prismaMock.customer_tags.create).not.toHaveBeenCalled();
  });

  it("400s a tag that is empty after trim, before any query runs", async () => {
    const res = await postTag({ tag: "   " });

    expect(res.status).toBe(400);
    expect(prismaMock.users.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.customer_tags.create).not.toHaveBeenCalled();
  });

  it("400s a malformed customer id without querying", async () => {
    const res = await postTag({ tag: "vip" }, "not-a-uuid");

    expect(res.status).toBe(400);
    expect(prismaMock.customer_tags.create).not.toHaveBeenCalled();
  });
});

describe("DELETE /customers/[id]/tags", () => {
  it("removes the normalised tag, scoped to the caller's tenant", async () => {
    const res = await deleteTag("?tag=VIP");

    expect(res.status).toBe(200);
    expect(prismaMock.customer_tags.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_A, userId: CUSTOMER_UUID, tag: "vip" },
    });
    expect(await res.json()).toEqual({ tags: ["vip"] });
  });

  it("is idempotent — removing an absent tag still answers 200", async () => {
    prismaMock.customer_tags.deleteMany.mockResolvedValue({ count: 0 });

    const res = await deleteTag("?tag=never-added");

    expect(res.status).toBe(200);
  });

  it("400s when the tag param is missing or blank", async () => {
    for (const query of ["", "?tag="]) {
      const res = await deleteTag(query);
      expect(res.status).toBe(400);
    }
    expect(prismaMock.customer_tags.deleteMany).not.toHaveBeenCalled();
  });

  it("404s when the id is not one of this tenant's customers", async () => {
    prismaMock.users.findFirst.mockResolvedValue(null);

    const res = await deleteTag("?tag=vip");

    expect(res.status).toBe(404);
    expect(prismaMock.customer_tags.deleteMany).not.toHaveBeenCalled();
  });
});

describe("canEditCustomers gates both mutations", () => {
  it("fixture sanity: view-only manager reads customers but cannot edit them", () => {
    expect(VIEW_ONLY().permissions.canViewCustomers).toBe(true);
    expect(VIEW_ONLY().permissions.canEditCustomers).toBe(false);
  });

  it.each([
    ["POST", () => postTag({ tag: "vip" })],
    ["DELETE", () => deleteTag("?tag=vip")],
  ])("403s a canViewCustomers-only member on %s, touching nothing", async (_name, run) => {
    resolveUserPermissions.mockResolvedValue(VIEW_ONLY());

    const res = await run();

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: expect.any(String) });
    expect(prismaMock.customer_tags.create).not.toHaveBeenCalled();
    expect(prismaMock.customer_tags.deleteMany).not.toHaveBeenCalled();
  });

  it.each([
    ["POST", () => postTag({ tag: "vip" })],
    ["DELETE", () => deleteTag("?tag=vip")],
  ])("401s an unauthenticated caller on %s before resolving permissions", async (_name, run) => {
    getCurrentUser.mockResolvedValue(null);

    const res = await run();

    expect(res.status).toBe(401);
    expect(resolveUserPermissions).not.toHaveBeenCalled();
  });
});

describe("GET /customers ?tag= filter", () => {
  function listWith(query: string) {
    return listCustomers(request("GET", `/api/tenant-admin/customers${query}`));
  }

  it("filters through the tag relation in canonical form, tenant re-asserted", async () => {
    const res = await listWith("?tag=VIP");

    expect(res.status).toBe(200);
    const expectedWhere = expect.objectContaining({
      tenantId: TENANT_A,
      customer_tags: { some: { tenantId: TENANT_A, tag: "vip" } },
    });
    expect(prismaMock.users.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    );
    expect(prismaMock.users.count).toHaveBeenCalledWith({ where: expectedWhere });
  });

  it("applies no tag predicate when the param is absent or blank", async () => {
    for (const query of ["", "?tag="]) {
      vi.clearAllMocks();
      getCurrentUser.mockResolvedValue(adminUser());
      resolveUserPermissions.mockResolvedValue(OWNER_ADMIN());
      prismaMock.users.findMany.mockResolvedValue([]);
      prismaMock.users.count.mockResolvedValue(0);
      prismaMock.consultation_questionnaires.findMany.mockResolvedValue([]);

      const res = await listWith(query);

      expect(res.status).toBe(200);
      const where = prismaMock.users.findMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty("customer_tags");
    }
  });

  it("400s an over-long tag param without querying", async () => {
    const res = await listWith(`?tag=${"x".repeat(TAG_MAX_LENGTH + 1)}`);

    expect(res.status).toBe(400);
    expect(prismaMock.users.findMany).not.toHaveBeenCalled();
  });
});
