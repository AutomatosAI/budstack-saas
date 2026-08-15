import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * US-004 — the platform posts write API.
 *
 * These routes are the first under `app/api/platform/` to require a session.
 * The only other one, `platform/leads`, is deliberately unauthenticated, so the
 * first claim worth pinning is that this family is NOT that: a tenant admin
 * gets nowhere near a write. After that, the rules that decide whether the
 * public blog stays coherent:
 *
 *  1. only a SUPER_ADMIN, same-origin, can create/edit/delete;
 *  2. the slug REGEX is enforced server-side — the tenant routes leave it to
 *     the client form, which is known debt and not the example to copy;
 *  3. a taken slug answers 409 with the slug in the message, whether the
 *     pre-check catches it or the unique index does;
 *  4. `publishedAt` is stamped on the transition into published and never
 *     rewritten, so the public date does not jump when a typo is fixed;
 *  5. a PUBLISHED post's slug cannot move until the automatic 301 exists
 *     (US-019) — a live URL must not start 404ing;
 *  6. `content` is sanitised on the way in.
 *
 * Module-boundary mocks only (getCurrentUser, prisma). The real auth wrapper,
 * the real same-origin guard, the real Zod schemas and the real sanitiser all
 * execute.
 */
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const prismaMock = vi.hoisted(() => ({
  platform_posts: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { GET as listPosts, POST as createPost } from "@/app/api/platform/posts/route";
import {
  GET as readPost,
  PATCH as editPost,
  DELETE as deletePost,
} from "@/app/api/platform/posts/[id]/route";
import { POST_SLUG_HINT } from "@/lib/seo/post-slug";

const POST_ID = "22222222-2222-2222-2222-222222222222";
const params = { params: { id: POST_ID } };
const HOST = "budstacks.io";

function superAdmin(over: Record<string, unknown> = {}) {
  return {
    id: "su_1",
    email: "ops@budstacks.io",
    name: "Operator",
    image: "",
    role: "SUPER_ADMIN",
    tenantId: null,
    clerkOrgId: null,
    impersonation: null,
    ...over,
  };
}

/** Same-origin by default — the guard is tested explicitly, not by accident. */
function request(
  method: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  return new NextRequest(`https://${HOST}/api/platform/posts`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "sec-fetch-site": "same-origin", host: HOST, ...headers },
  });
}

/** The minimum a create needs. */
const draft = {
  title: "How storefront margins actually work",
  content: "<p>Body</p>",
  authorName: "BudStacks",
};

/** A stored row, as the routes' selects return it. */
function storedPost(over: Record<string, unknown> = {}) {
  return {
    id: POST_ID,
    slug: "how-storefront-margins-actually-work",
    published: false,
    publishedAt: null,
    seo: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue(superAdmin());
  prismaMock.platform_posts.findUnique.mockResolvedValue(null);
  prismaMock.platform_posts.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: POST_ID,
      ...data,
    }),
  );
  prismaMock.platform_posts.update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: POST_ID,
      ...data,
    }),
  );
  prismaMock.platform_posts.delete.mockResolvedValue({ id: POST_ID });
  prismaMock.platform_posts.findMany.mockResolvedValue([]);
});

describe("platform posts are super-admin only (US-004)", () => {
  it.each([
    ["a tenant admin", superAdmin({ role: "TENANT_ADMIN", tenantId: "t_1" })],
    ["a patient", superAdmin({ role: "PATIENT", tenantId: "t_1" })],
    ["nobody signed in", null],
  ])("refuses %s and writes nothing", async (_label, user) => {
    getCurrentUser.mockResolvedValue(user);

    const res = await createPost(request("POST", draft));

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(prismaMock.platform_posts.create).not.toHaveBeenCalled();
  });

  it("refuses a tenant admin on every verb in the family", async () => {
    getCurrentUser.mockResolvedValue(
      superAdmin({ role: "TENANT_ADMIN", tenantId: "t_1" }),
    );

    const responses = await Promise.all([
      listPosts(request("GET")),
      readPost(request("GET"), params),
      editPost(request("PATCH", { title: "New" }), params),
      deletePost(request("DELETE"), params),
    ]);

    for (const res of responses) {
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
    expect(prismaMock.platform_posts.update).not.toHaveBeenCalled();
    expect(prismaMock.platform_posts.delete).not.toHaveBeenCalled();
    expect(prismaMock.platform_posts.findMany).not.toHaveBeenCalled();
  });

  it("blocks a cross-origin write even with a valid super-admin session", async () => {
    const res = await createPost(
      request("POST", draft, { "sec-fetch-site": "cross-site" }),
    );

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("CROSS_ORIGIN_BLOCKED");
    expect(prismaMock.platform_posts.create).not.toHaveBeenCalled();
  });
});

describe("slug rules are enforced server-side (US-004)", () => {
  it.each([
    ["upper case", "How-Margins-Work"],
    ["spaces", "how margins work"],
    ["a slash", "blog/how-margins-work"],
    ["a full stop", "how.margins.work"],
    ["empty", ""],
  ])("rejects a slug with %s", async (_label, slug) => {
    const res = await createPost(request("POST", { ...draft, slug }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(POST_SLUG_HINT);
    expect(prismaMock.platform_posts.create).not.toHaveBeenCalled();
  });

  it("accepts the shapes already in the wild (underscores, digits, leading -)", async () => {
    for (const slug of ["a_legacy_slug", "post-2026-01", "-leading-hyphen"]) {
      prismaMock.platform_posts.create.mockClear();
      const res = await createPost(request("POST", { ...draft, slug }));

      expect(res.status, slug).toBe(201);
      expect(prismaMock.platform_posts.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ slug }),
      });
    }
  });

  it("derives the slug from the title when none is sent", async () => {
    const res = await createPost(request("POST", draft));

    expect(res.status).toBe(201);
    expect(prismaMock.platform_posts.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        slug: "how-storefront-margins-actually-work",
      }),
    });
  });

  it.each([
    // Slugifies to "" — nothing survives at all.
    ["punctuation with no spaces", "!!!"],
    // Slugifies to a bare "-", which PASSES the pattern (it must: legacy
    // authored slugs carry hyphen runs) and would publish at /blog/-.
    ["punctuation with spaces", "!!! ??? ***"],
    // A 300-char title is legal; its slug would exceed POST_SLUG_MAX_LENGTH.
    ["a title too long to slugify", "storefront ".repeat(27)],
  ])("asks for an explicit slug when the title cannot become a URL — %s", async (
    _label,
    title,
  ) => {
    const res = await createPost(request("POST", { ...draft, title }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/enter a slug explicitly/i);
    expect(prismaMock.platform_posts.create).not.toHaveBeenCalled();
  });
});

describe("a taken slug is a 409, never a Prisma error (US-004)", () => {
  it("refuses before the insert when the slug already exists", async () => {
    prismaMock.platform_posts.findUnique.mockResolvedValue({ id: "other" });

    const res = await createPost(request("POST", { ...draft, slug: "taken" }));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("taken");
    expect(prismaMock.platform_posts.create).not.toHaveBeenCalled();
  });

  it("maps the unique-index race (P2002) to the same 409", async () => {
    prismaMock.platform_posts.create.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );

    const res = await createPost(request("POST", { ...draft, slug: "racy" }));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("racy");
    expect(body.error).not.toMatch(/unique constraint/i);
  });

  it("refuses a rename onto another post's slug", async () => {
    prismaMock.platform_posts.findUnique
      .mockResolvedValueOnce(storedPost())
      .mockResolvedValueOnce({ id: "some-other-post" });

    const res = await editPost(request("PATCH", { slug: "already-mine" }), params);

    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("already-mine");
    expect(prismaMock.platform_posts.update).not.toHaveBeenCalled();
  });
});

describe("publishedAt is stamped once (US-004)", () => {
  it("stamps on create when the post goes out published", async () => {
    const before = Date.now();
    const res = await createPost(
      request("POST", { ...draft, published: true }),
    );

    expect(res.status).toBe(201);
    const { data } = prismaMock.platform_posts.create.mock.calls[0][0];
    expect(data.publishedAt).toBeInstanceOf(Date);
    expect(data.publishedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("leaves publishedAt null for a draft", async () => {
    const res = await createPost(request("POST", draft));

    expect(res.status).toBe(201);
    expect(prismaMock.platform_posts.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ published: false, publishedAt: null }),
    });
  });

  it("stamps on the transition from draft to published", async () => {
    prismaMock.platform_posts.findUnique.mockResolvedValue(storedPost());

    const res = await editPost(request("PATCH", { published: true }), params);

    expect(res.status).toBe(200);
    const { data } = prismaMock.platform_posts.update.mock.calls[0][0];
    expect(data.publishedAt).toBeInstanceOf(Date);
  });

  it("does NOT rewrite publishedAt when a live post is edited", async () => {
    const firstPublished = new Date("2026-03-01T09:00:00.000Z");
    prismaMock.platform_posts.findUnique.mockResolvedValue(
      storedPost({ published: true, publishedAt: firstPublished }),
    );

    const res = await editPost(
      request("PATCH", { content: "<p>Fixed a typo</p>", published: true }),
      params,
    );

    expect(res.status).toBe(200);
    expect(prismaMock.platform_posts.update).toHaveBeenCalledWith({
      where: { id: POST_ID },
      data: expect.objectContaining({ publishedAt: firstPublished }),
    });
  });

  it("keeps the original date when a post is unpublished", async () => {
    const firstPublished = new Date("2026-03-01T09:00:00.000Z");
    prismaMock.platform_posts.findUnique.mockResolvedValue(
      storedPost({ published: true, publishedAt: firstPublished }),
    );

    const res = await editPost(request("PATCH", { published: false }), params);

    expect(res.status).toBe(200);
    expect(prismaMock.platform_posts.update).toHaveBeenCalledWith({
      where: { id: POST_ID },
      data: expect.objectContaining({
        published: false,
        publishedAt: firstPublished,
      }),
    });
  });

  it("does not touch publishedAt on an edit that says nothing about publishing", async () => {
    prismaMock.platform_posts.findUnique.mockResolvedValue(storedPost());

    const res = await editPost(request("PATCH", { title: "New title" }), params);

    expect(res.status).toBe(200);
    const { data } = prismaMock.platform_posts.update.mock.calls[0][0];
    expect(data).not.toHaveProperty("publishedAt");
    expect(data).not.toHaveProperty("published");
  });
});

describe("a published post's URL is locked until the 301 exists (US-004)", () => {
  it("refuses to rename a live post", async () => {
    prismaMock.platform_posts.findUnique.mockResolvedValue(
      storedPost({ published: true, publishedAt: new Date() }),
    );

    const res = await editPost(request("PATCH", { slug: "new-url" }), params);

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/cannot be changed yet/i);
    expect(prismaMock.platform_posts.update).not.toHaveBeenCalled();
  });

  it("allows a rename while the post is still a draft", async () => {
    prismaMock.platform_posts.findUnique
      .mockResolvedValueOnce(storedPost())
      .mockResolvedValueOnce(null);

    const res = await editPost(request("PATCH", { slug: "new-url" }), params);

    expect(res.status).toBe(200);
    expect(prismaMock.platform_posts.update).toHaveBeenCalledWith({
      where: { id: POST_ID },
      data: expect.objectContaining({ slug: "new-url" }),
    });
  });

  it("lets a live post re-send its OWN slug — that is not a rename", async () => {
    const live = storedPost({ published: true, publishedAt: new Date() });
    prismaMock.platform_posts.findUnique.mockResolvedValue(live);

    const res = await editPost(
      request("PATCH", { slug: live.slug, title: "Retitled" }),
      params,
    );

    expect(res.status).toBe(200);
    expect(prismaMock.platform_posts.update).toHaveBeenCalledWith({
      where: { id: POST_ID },
      data: expect.objectContaining({ title: "Retitled" }),
    });
  });
});

describe("content is sanitised on write (US-004)", () => {
  const hostile =
    '<p>Real body</p><script>fetch("/steal")</script><img src=x onerror=alert(1)>';

  it("strips script and event handlers on create", async () => {
    const res = await createPost(
      request("POST", { ...draft, content: hostile }),
    );

    expect(res.status).toBe(201);
    const { data } = prismaMock.platform_posts.create.mock.calls[0][0];
    expect(data.content).toContain("<p>Real body</p>");
    expect(data.content).not.toContain("<script");
    expect(data.content).not.toContain("onerror");
  });

  it("strips them on edit too", async () => {
    prismaMock.platform_posts.findUnique.mockResolvedValue(storedPost());

    const res = await editPost(request("PATCH", { content: hostile }), params);

    expect(res.status).toBe(200);
    const { data } = prismaMock.platform_posts.update.mock.calls[0][0];
    expect(data.content).not.toContain("<script");
    expect(data.content).not.toContain("onerror");
  });
});

describe("input validation and missing rows (US-004)", () => {
  it("rejects an unrecognised field rather than silently discarding it", async () => {
    const res = await createPost(
      request("POST", { ...draft, tenantId: "t_1" }),
    );

    expect(res.status).toBe(400);
    expect(prismaMock.platform_posts.create).not.toHaveBeenCalled();
  });

  it.each([
    ["no title", { content: "<p>x</p>", authorName: "BudStacks" }],
    ["no content", { title: "T", authorName: "BudStacks" }],
    ["no author", { title: "T", content: "<p>x</p>" }],
    ["an empty title", { ...draft, title: "   " }],
  ])("rejects a create with %s", async (_label, body) => {
    const res = await createPost(request("POST", body));

    expect(res.status).toBe(400);
    expect(prismaMock.platform_posts.create).not.toHaveBeenCalled();
  });

  it("400s a malformed id before touching the database", async () => {
    const res = await readPost(request("GET"), { params: { id: "not-a-uuid" } });

    expect(res.status).toBe(400);
    expect(prismaMock.platform_posts.findUnique).not.toHaveBeenCalled();
  });

  it("404s a read of a post that does not exist", async () => {
    prismaMock.platform_posts.findUnique.mockResolvedValue(null);

    const res = await readPost(request("GET"), params);

    expect(res.status).toBe(404);
  });

  it("404s an edit of a post that does not exist", async () => {
    prismaMock.platform_posts.findUnique.mockResolvedValue(null);

    const res = await editPost(request("PATCH", { title: "New" }), params);

    expect(res.status).toBe(404);
    expect(prismaMock.platform_posts.update).not.toHaveBeenCalled();
  });

  it("404s a delete of a post that does not exist, rather than reporting success", async () => {
    prismaMock.platform_posts.delete.mockRejectedValue(
      Object.assign(new Error("Record to delete does not exist"), {
        code: "P2025",
      }),
    );

    const res = await deletePost(request("DELETE"), params);

    expect(res.status).toBe(404);
  });

  it("deletes a post that does exist", async () => {
    const res = await deletePost(request("DELETE"), params);

    expect(res.status).toBe(200);
    expect(prismaMock.platform_posts.delete).toHaveBeenCalledWith({
      where: { id: POST_ID },
    });
  });
});

describe("the list is unscoped and body-free (US-004)", () => {
  it("orders newest first, omits content, and names no tenant", async () => {
    const res = await listPosts(request("GET"));

    expect(res.status).toBe(200);
    const call = prismaMock.platform_posts.findMany.mock.calls[0][0];
    expect(call.orderBy).toEqual({ createdAt: "desc" });
    expect(call.select.content).toBeUndefined();
    expect(call.select.title).toBe(true);
    // platform_posts has no tenantId at all; a filter naming one would mean the
    // model had been added to tenantScopedModels by mistake.
    expect(JSON.stringify(call)).not.toContain("tenantId");
  });
});
