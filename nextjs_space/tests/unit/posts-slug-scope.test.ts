import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// PRD-203 follow-up (PR #115 review) — the PATCH slug-collision check keyed off
// the ACTING admin's tenantId. For a SUPER_ADMIN editing another tenant's post,
// that scoped the uniqueness probe to the wrong tenant, so a colliding slug in
// the post's REAL tenant went undetected (and a cross-tenant slug could even be
// flagged spuriously). Fix: scope the probe to existingPost.tenantId.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { getTenantFromRequest } = vi.hoisted(() => ({
  getTenantFromRequest: vi.fn(),
}));
const prismaMock = vi.hoisted(() => ({
  users: { findFirst: vi.fn() },
  posts: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/tenant/tenant", () => ({ getTenantFromRequest }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { PATCH as patchPost } from "@/app/api/tenant-admin/posts/[id]/route";

const ADMIN_OWN_TENANT = "tenant-a";
const POST_TENANT = "tenant-b";
const POST_UUID = "33333333-3333-3333-3333-333333333333";

beforeEach(() => {
  vi.clearAllMocks();
  // A SUPER_ADMIN whose own tenant (A) differs from the post's tenant (B).
  getCurrentUser.mockResolvedValue({
    id: "super_1",
    email: "super@platform.dev",
    name: "Super",
    image: "",
    role: "SUPER_ADMIN",
    tenantId: ADMIN_OWN_TENANT,
    clerkOrgId: null,
  });
  getTenantFromRequest.mockResolvedValue({ id: ADMIN_OWN_TENANT });
});

describe("PATCH posts/[id] — slug collision scoped to the post's tenant (finding #7)", () => {
  it("probes uniqueness in existingPost.tenantId, not the acting admin's tenant", async () => {
    prismaMock.users.findFirst.mockResolvedValue({
      id: "u_super",
      tenantId: ADMIN_OWN_TENANT,
    });
    prismaMock.posts.findUnique.mockResolvedValue({
      id: POST_UUID,
      title: "Old Title",
      tenantId: POST_TENANT,
    });
    prismaMock.posts.findFirst.mockResolvedValue(null); // no collision → loop exits
    prismaMock.posts.update.mockResolvedValue({ id: POST_UUID });

    const req = new NextRequest(
      `http://platform.dev/api/tenant-admin/posts/${POST_UUID}`,
      { method: "PATCH", body: JSON.stringify({ title: "Brand New Title" }) },
    );
    await patchPost(req, { params: { id: POST_UUID } });

    expect(prismaMock.posts.findFirst).toHaveBeenCalledWith({
      where: {
        slug: "brand-new-title",
        tenantId: POST_TENANT,
        NOT: { id: POST_UUID },
      },
    });
  });
});
