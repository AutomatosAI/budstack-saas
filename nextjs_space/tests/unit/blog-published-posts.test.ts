import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * US-008 — the /blog index reads the database.
 *
 * The claims worth pinning are the ones that decide whether budstacks.io tells
 * a visitor the truth:
 *
 *  1. AN OUTAGE IS NOT AN EMPTY BLOG. A zero-row answer renders the empty
 *     state; a query that THREW is logged and re-thrown, never flattened into
 *     `[]`. Once the result is an array the two are indistinguishable, so the
 *     distinction has to be made here or not at all.
 *  2. The query is `published: true`, newest `publishedAt` first, and names NO
 *     tenant — `platform_posts` is absent from `tenantScopedModels`, so a
 *     tenant predicate would be a bug, not a safety net.
 *  3. The failure message carries no driver, host or SQL detail: Next.js prints
 *     a server component's error message on the dev error page.
 *
 * The last block reads the page as text. There is no component-test harness in
 * this repo (nothing under tests/unit renders React), and two of the story's
 * rules are visible only in the source: `force-dynamic` (without it the
 * build-time mock bakes an empty blog into the static output) and the inline
 * arrays STILL BEING PRESENT — deleting them is US-012, and only after US-010
 * and US-011 have put that content in the table.
 */
const prismaMock = vi.hoisted(() => ({
  platform_posts: { findMany: vi.fn(), findUnique: vi.fn() },
}));
const loggerMock = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({ logger: loggerMock }));

import {
  BLOG_UNAVAILABLE_MESSAGE,
  RELATED_POSTS_LIMIT,
  loadPublishedPlatformPost,
  loadPublishedPlatformPosts,
  loadRelatedPlatformPosts,
} from "@/lib/platform/published-posts";
import { PLATFORM_POST_SUMMARY_SELECT } from "@/lib/platform/posts";

const root = process.cwd(); // vitest runs from nextjs_space/
const pageSource = readFileSync(join(root, "app", "blog", "page.tsx"), "utf8");
const articleSource = readFileSync(
  join(root, "app", "blog", "[slug]", "page.tsx"),
  "utf8",
);

const loaderSource = readFileSync(
  join(root, "lib", "platform", "published-posts.ts"),
  "utf8",
);

/**
 * A distinct slug per call.
 *
 * React `cache()` memoizes per REQUEST, and vitest runs outside any request
 * scope — measured, not assumed: two calls with one slug reach the mock twice
 * here. So the dedup `generateMetadata` and the page body rely on cannot be
 * proved at runtime from here, and it is pinned on the loader's source instead
 * (below). Distinct slugs keep these tests independent of that detail either
 * way.
 */
let slugCounter = 0;
function uniqueSlug(): string {
  slugCounter += 1;
  return `post-${slugCounter}`;
}

function row(over: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    slug: "wordpress-or-budstacks-cannabis-storefront",
    title: "Should You Build Your Cannabis Storefront on WordPress?",
    excerpt: "The honest comparison.",
    coverImage: "/images/blog/post-01-franchise.svg",
    coverImageAlt: "A storefront",
    authorName: "BudStacks",
    authorRole: "Platform Team",
    published: true,
    publishedAt: new Date("2026-08-15T09:00:00Z"),
    createdAt: new Date("2026-08-14T09:00:00Z"),
    updatedAt: new Date("2026-08-15T09:00:00Z"),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadPublishedPlatformPosts — the query", () => {
  it("asks for published posts only", async () => {
    prismaMock.platform_posts.findMany.mockResolvedValue([row()]);

    await loadPublishedPlatformPosts();

    const args = prismaMock.platform_posts.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ published: true });
  });

  it("orders newest published first, with undated rows last", async () => {
    prismaMock.platform_posts.findMany.mockResolvedValue([]);

    await loadPublishedPlatformPosts();

    const args = prismaMock.platform_posts.findMany.mock.calls[0][0];
    expect(args.orderBy[0]).toEqual({
      publishedAt: { sort: "desc", nulls: "last" },
    });
    // Postgres puts NULLs FIRST under DESC; a dateless row must not lead the
    // blog with a blank date.
    expect(args.orderBy[0].publishedAt.nulls).toBe("last");
  });

  it("names no tenant — platform_posts is not tenant-scoped", async () => {
    prismaMock.platform_posts.findMany.mockResolvedValue([]);

    await loadPublishedPlatformPosts();

    const args = prismaMock.platform_posts.findMany.mock.calls[0][0];
    expect(JSON.stringify(args)).not.toContain("tenantId");
  });

  it("selects the summary projection, never the article body", async () => {
    prismaMock.platform_posts.findMany.mockResolvedValue([]);

    await loadPublishedPlatformPosts();

    const args = prismaMock.platform_posts.findMany.mock.calls[0][0];
    expect(args.select).toBe(PLATFORM_POST_SUMMARY_SELECT);
    expect(args.select).not.toHaveProperty("content");
  });

  it("returns the rows it was given", async () => {
    const rows = [row(), row({ id: "2", slug: "second" })];
    prismaMock.platform_posts.findMany.mockResolvedValue(rows);

    await expect(loadPublishedPlatformPosts()).resolves.toEqual(rows);
  });
});

describe("loadPublishedPlatformPosts — an outage is not an empty blog", () => {
  it("returns [] for a SUCCESSFUL zero-row query, and logs nothing", async () => {
    prismaMock.platform_posts.findMany.mockResolvedValue([]);

    await expect(loadPublishedPlatformPosts()).resolves.toEqual([]);
    expect(loggerMock.error).not.toHaveBeenCalled();
  });

  it("throws rather than returning [] when the query fails", async () => {
    prismaMock.platform_posts.findMany.mockRejectedValue(
      new Error("connect ECONNREFUSED 10.0.0.4:5432"),
    );

    await expect(loadPublishedPlatformPosts()).rejects.toThrow(
      BLOG_UNAVAILABLE_MESSAGE,
    );
  });

  it("logs the underlying reason server-side", async () => {
    prismaMock.platform_posts.findMany.mockRejectedValue(
      new Error("connect ECONNREFUSED 10.0.0.4:5432"),
    );

    await expect(loadPublishedPlatformPosts()).rejects.toThrow();
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.stringContaining("published platform posts query failed"),
      expect.objectContaining({
        reason: "connect ECONNREFUSED 10.0.0.4:5432",
      }),
    );
  });

  it("survives a rejection that is not an Error", async () => {
    prismaMock.platform_posts.findMany.mockRejectedValue("nope");

    await expect(loadPublishedPlatformPosts()).rejects.toThrow(
      BLOG_UNAVAILABLE_MESSAGE,
    );
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ reason: "unknown" }),
    );
  });

  it("does not put the driver's message where a reader could see it", () => {
    expect(BLOG_UNAVAILABLE_MESSAGE).not.toMatch(
      /postgres|prisma|ECONNREFUSED|5432|select/i,
    );
  });
});

describe("loadPublishedPlatformPost — one article (US-009)", () => {
  it("asks for THIS slug and only a published one", async () => {
    const slug = uniqueSlug();
    prismaMock.platform_posts.findUnique.mockResolvedValue(row({ slug }));

    await loadPublishedPlatformPost(slug);

    const args = prismaMock.platform_posts.findUnique.mock.calls[0][0];
    expect(args.where).toEqual({ slug, published: true });
  });

  // `published` is in the QUERY, not a check on the result: metadata resolves
  // before the body reaches notFound(), so a draft's title would otherwise land
  // in the 404 page's <title>.
  it("returns null for a draft rather than the draft", async () => {
    prismaMock.platform_posts.findUnique.mockResolvedValue(null);

    await expect(loadPublishedPlatformPost(uniqueSlug())).resolves.toBeNull();
  });

  it("names no tenant — platform_posts is not tenant-scoped", async () => {
    prismaMock.platform_posts.findUnique.mockResolvedValue(null);

    await loadPublishedPlatformPost(uniqueSlug());

    const args = prismaMock.platform_posts.findUnique.mock.calls[0][0];
    expect(JSON.stringify(args)).not.toContain("tenantId");
  });

  it("selects the whole row — the article body is the point", async () => {
    prismaMock.platform_posts.findUnique.mockResolvedValue(null);

    await loadPublishedPlatformPost(uniqueSlug());

    const args = prismaMock.platform_posts.findUnique.mock.calls[0][0];
    expect(args.select).toBeUndefined();
  });

  // An outage is not a 404 for the same reason it is not an empty blog: telling
  // a crawler a live article has been removed is a lie it remembers.
  it("throws rather than 404ing when the query fails", async () => {
    prismaMock.platform_posts.findUnique.mockRejectedValue(
      new Error("connect ECONNREFUSED 10.0.0.4:5432"),
    );

    await expect(loadPublishedPlatformPost(uniqueSlug())).rejects.toThrow(
      BLOG_UNAVAILABLE_MESSAGE,
    );
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.stringContaining("published platform post query failed"),
      expect.objectContaining({
        reason: "connect ECONNREFUSED 10.0.0.4:5432",
      }),
    );
  });

  // What stops every article render making two identical round trips, and what
  // stops the <title> describing a different revision from the body.
  it("is React-cache()d, so generateMetadata and the body share one query", () => {
    expect(loaderSource).toContain('import { cache } from "react"');
    expect(loaderSource).toMatch(
      /export const loadPublishedPlatformPost = cache\(/,
    );
    expect(loaderSource).toMatch(
      /export const loadRelatedPlatformPosts = cache\(/,
    );
  });
});

describe("loadRelatedPlatformPosts — the strip under an article", () => {
  it("excludes the post being read, newest first, capped", async () => {
    prismaMock.platform_posts.findMany.mockResolvedValue([]);

    await loadRelatedPlatformPosts("current-slug");

    const args = prismaMock.platform_posts.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      published: true,
      slug: { not: "current-slug" },
    });
    expect(args.orderBy[0]).toEqual({
      publishedAt: { sort: "desc", nulls: "last" },
    });
    expect(args.take).toBe(RELATED_POSTS_LIMIT);
    expect(args.select).toBe(PLATFORM_POST_SUMMARY_SELECT);
  });

  // The OPPOSITE call from the two loaders above, deliberately: the article has
  // already loaded and is what the visitor came for. Taking it down over two
  // links at the bottom turns a degraded page into no page.
  it("degrades to [] when its own query fails, and says so in the log", async () => {
    prismaMock.platform_posts.findMany.mockRejectedValue(
      new Error("connect ECONNREFUSED 10.0.0.4:5432"),
    );

    await expect(
      loadRelatedPlatformPosts("another-slug"),
    ).resolves.toEqual([]);
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.stringContaining("related platform posts query failed"),
      expect.objectContaining({ reason: expect.any(String) }),
    );
  });
});

describe("app/blog/[slug]/page.tsx", () => {
  it("renders from the database, not from the inline arrays", () => {
    expect(articleSource).toContain("loadPublishedPlatformPost");
    expect(articleSource).toContain("loadRelatedPlatformPosts");
    expect(articleSource).not.toMatch(/import\s*\{[^}]*BLOG_POSTS/);
    expect(articleSource).not.toContain("const allPosts");
    expect(articleSource).not.toMatch(/allPosts\.find\(/);
  });

  it("exports per-post metadata — the defect US-009 closes", () => {
    expect(articleSource).toContain("export async function generateMetadata");
    expect(articleSource).toContain("buildPlatformPostMetadata");
  });

  it("is force-dynamic and no longer pre-renders a static route list", () => {
    expect(articleSource).toMatch(
      /export const dynamic = ["']force-dynamic["']/,
    );
    // generateStaticParams enumerated the INLINE posts; the route list is the
    // table now, and a static list beside force-dynamic is a contradiction.
    // Matched on the EXPORT — the header comment still names it, which is how
    // the next reader learns why it went.
    expect(articleSource).not.toMatch(/export\s+.*function generateStaticParams/);
  });

  it("404s an unresolved slug", () => {
    expect(articleSource).toContain("notFound()");
  });

  it("sanitises the body through the shared lib/ policy", () => {
    expect(articleSource).toContain("sanitizePostHtml");
    // The inline sanitize-html call this replaced.
    expect(articleSource).not.toMatch(/from ["']sanitize-html["']/);
  });

  // `@tailwindcss/typography` is not installed, so a prose-* class is inert.
  // Matched inside className only: the comment above the body names the classes
  // it replaced, and pnpm check:article-typography is the guard that reads code
  // rather than text.
  it("renders the body through .bs-article, with no inert prose-* class", () => {
    expect(articleSource).toContain('className="bs-article"');
    expect(articleSource).not.toMatch(/className="[^"]*\bprose\b/);
  });

  it("links through the shared blog path helper", () => {
    expect(articleSource).toContain("blogPostPath(relatedPost.slug)");
    expect(articleSource).not.toMatch(/href=\{`\/blog\/\$\{/);
  });

  it("still carries the inline sample posts — deleting them is US-012", () => {
    // This array is the ONLY copy of the six posts' article bodies, and
    // US-011's migration is written from it.
    expect(articleSource).toContain("const samplePosts = [");
    expect(articleSource).toContain(
      "getting-started-with-medical-cannabis-franchise",
    );
    expect(articleSource).toContain("maximizing-revenue-analytics");
  });
});

describe("app/blog/page.tsx", () => {
  it("renders from the database, not from the inline arrays", () => {
    expect(pageSource).toContain("loadPublishedPlatformPosts");
    expect(pageSource).toMatch(/posts\.map\(/);
    // The two inline sources are no longer read by the index (both are still
    // referenced by NAME in the file's header comment, which is the point).
    expect(pageSource).not.toMatch(/import\s*\{[^}]*BLOG_POSTS/);
    expect(pageSource).not.toContain("...BLOG_POSTS");
    expect(pageSource).not.toMatch(/samplePosts\.map\(/);
    expect(pageSource).not.toContain("...samplePosts");
  });

  it("is force-dynamic — the build-time mock answers [] for every query", () => {
    expect(pageSource).toMatch(
      /export const dynamic = ["']force-dynamic["']/,
    );
  });

  it("still carries the inline sample posts — deleting them is US-012", () => {
    // US-010 and US-011 have to put this content in the table first, and the
    // copy in app/blog/[slug]/page.tsx is what those migrations are written
    // from — deleting either before then destroys the source.
    expect(pageSource).toContain("const samplePosts = [");
    expect(pageSource).toContain(
      "getting-started-with-medical-cannabis-franchise",
    );
    expect(pageSource).toContain("maximizing-revenue-analytics");
  });

  it("has an empty state distinct from the grid", () => {
    expect(pageSource).toContain("posts.length === 0");
    expect(pageSource).toContain("Nothing published yet");
  });

  it("links through the shared blog path helper", () => {
    expect(pageSource).toContain("blogPostPath(post.slug)");
    expect(pageSource).not.toMatch(/href=\{`\/blog\/\$\{/);
  });

  it("carries no inert prose-* class", () => {
    expect(pageSource).not.toMatch(/\bprose(-[a-z0-9-]+)?\b/);
  });
});
