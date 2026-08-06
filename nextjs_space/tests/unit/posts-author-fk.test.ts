import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// posts.authorId FKs users.id, but getCurrentUser().id is the CLERK id — they
// only coincide for rows the Clerk webhook created (keyed by the raw Clerk id).
// Tenant admins provisioned by tenant-create / team-invite / seeding have UUID
// PKs, so stamping user.id verbatim violated posts_authorId_fkey and 500'd
// every blog create (lekkerweed, 2026-08-06). The route now resolves the local
// users row (clerkUserId → id → email) and only falls back to the raw Clerk id
// when no row is visible (e.g. an impersonating super-admin, whose Clerk-keyed
// row the tenant scope hides — the case the FK already accepted).
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { getTenantFromRequest } = vi.hoisted(() => ({
  getTenantFromRequest: vi.fn(),
}));
const prismaMock = vi.hoisted(() => ({
  users: { findFirst: vi.fn() },
  posts: { findFirst: vi.fn(), create: vi.fn() },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/tenant/tenant", () => ({ getTenantFromRequest }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { POST as createPost } from "@/app/api/tenant-admin/posts/route";

const TENANT_ID = "tenant-lekkerweed";
const CLERK_ID = "user_2clerkOnlyId";
const LOCAL_UUID = "44444444-4444-4444-4444-444444444444";

const makeRequest = () =>
  new NextRequest("http://lekkerweed.dev/api/tenant-admin/posts", {
    method: "POST",
    body: JSON.stringify({ title: "Harvest Notes", content: "Body text" }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue({
    id: CLERK_ID,
    email: "admin@lekkerweed.dev",
    name: "LW Admin",
    image: "",
    role: "TENANT_ADMIN",
    tenantId: TENANT_ID,
    clerkOrgId: null,
  });
  getTenantFromRequest.mockResolvedValue({ id: TENANT_ID });
  prismaMock.posts.findFirst.mockResolvedValue(null); // slug free
  prismaMock.posts.create.mockImplementation(async ({ data }: any) => data);
});

describe("POST posts — authorId resolves the LOCAL users row, not the Clerk id", () => {
  it("stamps the UUID-keyed local row's id for a provisioned tenant admin", async () => {
    prismaMock.users.findFirst.mockResolvedValue({ id: LOCAL_UUID });

    const res = await createPost(makeRequest());

    expect(res.status).toBe(200);
    expect(prismaMock.users.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { clerkUserId: CLERK_ID },
          { id: CLERK_ID },
          { email: "admin@lekkerweed.dev" },
        ],
      },
      select: { id: true },
    });
    expect(prismaMock.posts.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        authorId: LOCAL_UUID,
        tenantId: TENANT_ID,
      }),
    });
  });

  it("falls back to the Clerk id when no local row is visible (impersonating super-admin)", async () => {
    prismaMock.users.findFirst.mockResolvedValue(null);

    const res = await createPost(makeRequest());

    expect(res.status).toBe(200);
    expect(prismaMock.posts.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ authorId: CLERK_ID }),
    });
  });

  it("maps a residual authorId FK violation (P2003) to a clear 409, not a 500", async () => {
    prismaMock.users.findFirst.mockResolvedValue(null);
    prismaMock.posts.create.mockRejectedValue(
      Object.assign(new Error("Foreign key constraint violated"), {
        code: "P2003",
      }),
    );

    const res = await createPost(makeRequest());

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/not linked/i);
  });
});
