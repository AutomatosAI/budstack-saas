import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * SEO Supercharge US-021 — renaming a post through PATCH
 * /api/tenant-admin/posts/[id].
 *
 * THE CLAIM UNDER TEST: a Pro rename leaves the old URL redirecting, a Basic
 * rename does not (and says so rather than pretending), and neither one fails
 * the edit. The plan is read from the `tenants.plan` column through the real
 * `getTenantPlan` — not stubbed — so the fail-closed path is exercised too.
 *
 * Module-boundary mocks only (getCurrentUser, tenant resolution, prisma). The
 * real auth wrapper, the real zod schema, the real slug rules and the real
 * rename planner all execute.
 */
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { getTenantFromRequest } = vi.hoisted(() => ({
  getTenantFromRequest: vi.fn(),
}));
const prismaMock = vi.hoisted(() => ({
  users: { findFirst: vi.fn() },
  posts: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  tenants: { findFirst: vi.fn() },
  seo_redirects: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/tenant/tenant", () => ({ getTenantFromRequest }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { PATCH as patchPost } from "@/app/api/tenant-admin/posts/[id]/route";
import { POST_SLUG_HINT } from "@/lib/seo/post-slug";

const TENANT = "tenant-a";
const POST_ID = "44444444-4444-4444-4444-444444444444";
const OLD_SLUG = "old-slug";

function patch(body: unknown) {
  return new NextRequest(
    `http://admin.budstacks.io/api/tenant-admin/posts/${POST_ID}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    },
  );
}

async function rename(body: unknown) {
  const response = await patchPost(patch(body), { params: { id: POST_ID } });
  return { response, body: await response.json() };
}

/** The tenant's stored plan for this case. */
function onPlan(plan: string | null) {
  prismaMock.tenants.findFirst.mockResolvedValue({ plan });
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue({
    id: "admin_1",
    email: "admin@store.dev",
    name: "Admin",
    image: "",
    role: "TENANT_ADMIN",
    tenantId: TENANT,
    clerkOrgId: null,
  });
  getTenantFromRequest.mockResolvedValue({ id: TENANT });
  prismaMock.users.findFirst.mockResolvedValue({ id: "u_1", tenantId: TENANT });
  prismaMock.posts.findUnique.mockResolvedValue({
    id: POST_ID,
    title: "Old Title",
    slug: OLD_SLUG,
    tenantId: TENANT,
    seo: null,
  });
  // No slug collision unless a case says otherwise.
  prismaMock.posts.findFirst.mockResolvedValue(null);
  prismaMock.posts.update.mockImplementation(async ({ data }: any) => ({
    id: POST_ID,
    slug: data.slug ?? OLD_SLUG,
  }));
  prismaMock.seo_redirects.findMany.mockResolvedValue([]);
  prismaMock.seo_redirects.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.seo_redirects.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.seo_redirects.update.mockResolvedValue({});
  prismaMock.seo_redirects.create.mockResolvedValue({});
  onPlan("pro");
});

describe("PATCH posts/[id] — the slug is editable", () => {
  it("writes the authored slug, not one derived from the title", async () => {
    const { response } = await rename({
      title: "A Completely Different Title",
      slug: "keep-this",
    });

    expect(response.status).toBe(200);
    expect(prismaMock.posts.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: "keep-this" }),
      }),
    );
  });

  it("canonicalises what was typed rather than refusing it", async () => {
    await rename({ slug: "My New Post" });

    expect(prismaMock.posts.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: "my-new-post" }),
      }),
    );
  });

  it("400s a slug with nothing usable in it, and writes nothing", async () => {
    const { response, body } = await rename({ slug: "!!!" });

    expect(response.status).toBe(400);
    expect(body.error).toBe(POST_SLUG_HINT);
    expect(prismaMock.posts.update).not.toHaveBeenCalled();
  });

  it("leaves the slug alone when it comes back unchanged", async () => {
    await rename({ title: "Old Title", slug: OLD_SLUG, content: "body" });

    expect(prismaMock.posts.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.posts.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ slug: expect.anything() }),
      }),
    );
    expect(prismaMock.seo_redirects.create).not.toHaveBeenCalled();
  });

  it("still derives from the title when no slug is sent (unchanged callers)", async () => {
    await rename({ title: "Brand New Title" });

    expect(prismaMock.posts.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: "brand-new-title" }),
      }),
    );
  });

  it("suffixes a taken slug and redirects to where the post ACTUALLY landed", async () => {
    prismaMock.posts.findFirst
      .mockResolvedValueOnce({ id: "other-post" })
      .mockResolvedValue(null);

    const { body } = await rename({ slug: "taken" });

    expect(prismaMock.posts.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: "taken-1" }),
      }),
    );
    expect(body.slugRedirect).toMatchObject({ redirected: true });
    expect(prismaMock.seo_redirects.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromPath: "/the-wire/old-slug",
          toPath: "/the-wire/taken-1",
        }),
      }),
    );
  });
});

describe("PATCH posts/[id] — the 301 a Pro rename earns", () => {
  it("writes old → new as a 301, scoped to the post's tenant", async () => {
    const { body } = await rename({ slug: "new-slug" });

    expect(prismaMock.seo_redirects.create).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT,
        fromPath: "/the-wire/old-slug",
        toPath: "/the-wire/new-slug",
        statusCode: 301,
      },
    });
    expect(body.slugRedirect).toEqual({
      redirected: true,
      repointed: 0,
      replaced: 0,
    });
  });

  it("re-aims older rules at the new URL and clears one claiming it", async () => {
    prismaMock.seo_redirects.findMany.mockResolvedValue([
      { id: "chain", fromPath: "/the-wire/ancient", toPath: "/the-wire/old-slug" },
      { id: "shadow", fromPath: "/the-wire/new-slug", toPath: "/elsewhere" },
    ]);

    const { body } = await rename({ slug: "new-slug" });

    expect(prismaMock.seo_redirects.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT, id: { in: ["shadow"] } },
    });
    expect(prismaMock.seo_redirects.updateMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT, id: { in: ["chain"] } },
      data: { toPath: "/the-wire/new-slug" },
    });
    expect(body.slugRedirect).toEqual({
      redirected: true,
      repointed: 1,
      replaced: 1,
    });
  });

  it("retargets the rule already on the old path instead of stacking one", async () => {
    prismaMock.seo_redirects.findMany.mockResolvedValue([
      { id: "existing", fromPath: "/the-wire/old-slug", toPath: "/somewhere" },
    ]);

    await rename({ slug: "new-slug" });

    expect(prismaMock.seo_redirects.update).toHaveBeenCalledWith({
      where: { id: "existing" },
      data: { toPath: "/the-wire/new-slug" },
    });
    expect(prismaMock.seo_redirects.create).not.toHaveBeenCalled();
  });

  it("reports the failure instead of failing the edit when a write throws", async () => {
    prismaMock.seo_redirects.create.mockRejectedValue(new Error("db down"));

    const { response, body } = await rename({ slug: "new-slug" });

    expect(response.status).toBe(200);
    expect(body.slug).toBe("new-slug");
    expect(body.slugRedirect).toMatchObject({
      redirected: false,
      reason: "write_failed",
    });
  });
});

describe("PATCH posts/[id] — a Basic rename is honest about the 404", () => {
  it("renames the post but writes no redirect", async () => {
    onPlan("basic");

    const { response, body } = await rename({ slug: "new-slug" });

    expect(response.status).toBe(200);
    expect(body.slug).toBe("new-slug");
    expect(body.slugRedirect).toEqual({
      redirected: false,
      reason: "not_entitled",
      repointed: 0,
      replaced: 0,
    });
    expect(prismaMock.seo_redirects.create).not.toHaveBeenCalled();
    expect(prismaMock.seo_redirects.findMany).not.toHaveBeenCalled();
  });

  it("treats an unreadable plan as Basic — never a free upgrade", async () => {
    onPlan("something-else");

    const { body } = await rename({ slug: "new-slug" });

    expect(body.slugRedirect.reason).toBe("not_entitled");
    expect(prismaMock.seo_redirects.create).not.toHaveBeenCalled();
  });

  it("unlocks the redirect for a trial tenant", async () => {
    onPlan("trial");

    const { body } = await rename({ slug: "new-slug" });

    expect(body.slugRedirect).toMatchObject({ redirected: true });
  });
});
