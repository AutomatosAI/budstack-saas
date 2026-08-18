import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Platform US-020 — the SEO audit we sell to tenants, pointed at budstacks.io.
 *
 * What is worth pinning here is everything that decides whether the panel tells
 * the truth about our own site:
 *
 *  1. IT JUDGES WHAT THE PAGE SERVES. A route with no settings row but a title
 *     in its own page file is not "missing a title"; one that falls all the way
 *     through to the platform default IS, because that is a sentence fifteen
 *     other pages also serve. Both answers come from the resolver
 *     `generateMetadata` itself calls, so the audit cannot drift from the tags.
 *  2. THE CANONICAL CHECK IS NOT A TAUTOLOGY. It parses the declared URL and
 *     asks whether it names this page — which catches the real failure mode,
 *     `platformCanonical` collapsing to the bare origin for a path `new URL`
 *     cannot parse, and would not be caught by comparing the resolver with
 *     itself.
 *  3. THE RESULT REPORTS ONLY CHECKS THAT RAN. `canonical-missing` is in the
 *     vocabulary but not in `SEO_AUDIT_CHECKS`, so a store's audit never claims
 *     to have passed it, and the platform's never claims to have passed a
 *     deleted-product-leak check that has no meaning off a storefront.
 *  4. EVERY FINDING HAS A FIX. A route finding carries the route PATH as its
 *     entityId — the key the admin list is indexed by, so the panel's button
 *     opens that row's editor — and a post finding carries an href to The Wire.
 *  5. SUPER-ADMIN ONLY. The sibling `platform/leads` route is deliberately
 *     unauthenticated; a route that enumerates which of our pages are unauthored
 *     is not that.
 *
 * Module-boundary mocks only (getCurrentUser, prisma). The real auth wrapper,
 * the real cache and the real engine all execute.
 */
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const prismaMock = vi.hoisted(() => ({
  platform_seo_settings: { findMany: vi.fn() },
  platform_posts: { findMany: vi.fn() },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { NextRequest } from "next/server";

import { GET as getPlatformAudit } from "@/app/api/platform/seo/audit/route";
import { parseSeoAuditSnapshot } from "@/components/admin/seo/audit-client";
import {
  PLATFORM_SEO_AUDIT_CACHE_KEY,
  PLATFORM_SEO_AUDIT_CHECKS,
  canonicalNamesRoute,
  runPlatformSeoAudit,
  type PlatformAuditPost,
  type PlatformAuditRoute,
} from "@/lib/platform/seo-audit";
import { platformRouteFallbacks } from "@/lib/platform/seo-routes";
import { resetSeoAuditCache } from "@/lib/seo/audit-cache";
import {
  SEO_AUDIT_ALL_CHECKS,
  SEO_AUDIT_CHECKS,
  SEO_AUDIT_WEIGHTS,
  type SeoAuditCheckId,
  type SeoAuditResult,
} from "@/lib/seo/audit-types";
import {
  PLATFORM_DEFAULT_DESCRIPTION,
  PLATFORM_DEFAULT_TITLE,
} from "@/lib/seo/platform-page-metadata";
import { PLATFORM_DEFAULT_OG_IMAGE } from "@/lib/seo/platform-post-metadata";
import { platformBaseUrl } from "@/lib/seo/platform-url";

/** A route with a title, a description and a card of its own — nothing to fix. */
function route(over: Partial<PlatformAuditRoute> = {}): PlatformAuditRoute {
  return {
    path: "/terms",
    name: "Terms of Service",
    fallback: { title: "Terms of Service | BudStacks", description: "Terms." },
    setting: {
      title: null,
      description: null,
      ogImage: "/terms-card.jpg",
      noindex: false,
    },
    ...over,
  };
}

/** A published article with everything filled in. */
function post(over: Partial<PlatformAuditPost> = {}): PlatformAuditPost {
  return {
    id: "post_1",
    slug: "a-post",
    title: "A post",
    excerpt: "What the post is about.",
    coverImage: "/covers/a-post.jpg",
    authorName: "Ops",
    publishedAt: new Date("2026-08-01T00:00:00.000Z"),
    seo: null,
    ...over,
  };
}

function group(result: SeoAuditResult, check: SeoAuditCheckId) {
  const found = result.checks.find((entry) => entry.check === check);
  if (!found) throw new Error(`no ${check} group in the result`);
  return found;
}

function audit(input: {
  routes?: PlatformAuditRoute[];
  posts?: PlatformAuditPost[];
}) {
  return runPlatformSeoAudit({
    routes: input.routes ?? [],
    posts: input.posts ?? [],
  });
}

describe("platform SEO audit — what a page serves", () => {
  it("does not flag a route whose own page file ships a title and description", () => {
    const result = audit({ routes: [route()] });

    expect(group(result, "title-missing").total).toBe(0);
    expect(group(result, "description-missing").total).toBe(0);
  });

  it("flags a route that falls through to the platform default title", () => {
    // `/blog` and `/contact` are exactly this today: the blog page has never
    // exported metadata and contact is a client component, which cannot.
    const result = audit({
      routes: [route({ path: "/blog", name: "Blog", fallback: {}, setting: null })],
    });

    const titles = group(result, "title-missing");
    expect(titles.total).toBe(1);
    expect(titles.findings[0].message).toContain("Blog");
    expect(group(result, "description-missing").total).toBe(1);
  });

  it("counts an authored row as the route's own title, not the default", () => {
    const result = audit({
      routes: [
        route({
          path: "/blog",
          name: "Blog",
          fallback: {},
          setting: {
            title: "The BudStacks blog",
            description: "How operators run a storefront.",
            ogImage: "/blog-card.jpg",
            noindex: false,
          },
        }),
      ],
    });

    expect(result.totalFindings).toBe(0);
    expect(result.score).toBe(100);
    expect(result.grade).toBe("good");
  });

  it("counts an authored title as the route's own even when it repeats the default", () => {
    // The check is AUTHORSHIP, not string comparison: a super-admin who types
    // the platform's own sentence for a page has decided that is the page's
    // title, and an audit that argued with what they typed would be unfixable.
    const result = audit({
      routes: [
        route({
          fallback: {},
          setting: {
            title: PLATFORM_DEFAULT_TITLE,
            description: PLATFORM_DEFAULT_DESCRIPTION,
            ogImage: "/x.jpg",
            noindex: false,
          },
        }),
      ],
    });

    expect(group(result, "title-missing").total).toBe(0);
    expect(group(result, "description-missing").total).toBe(0);
  });
});

describe("platform SEO audit — social cards", () => {
  it("flags a route with no row at all", () => {
    // The state every guide is in: the US-013 seed left them rowless.
    const result = audit({
      routes: [route({ path: "/documents/seo", name: "Part 7 — SEO", setting: null })],
    });

    expect(group(result, "og-image-missing").total).toBe(1);
  });

  it("flags a route whose row points AT the platform hero", () => {
    // What the seed wrote for all fifteen static routes. The rendered card is
    // the site's stock image, so the page has none of its own — judging the
    // column instead would call fifteen identical grey cards fifteen images.
    const result = audit({
      routes: [route({ setting: { title: null, description: null, ogImage: PLATFORM_DEFAULT_OG_IMAGE, noindex: false } })],
    });

    expect(group(result, "og-image-missing").total).toBe(1);
  });

  it("flags a reference this origin cannot serve as the default it renders as", () => {
    const result = audit({
      routes: [
        route({
          setting: {
            title: null,
            description: null,
            // Protocol-relative: `platformAbsoluteUrl` drops it and the page
            // falls back to the hero.
            ogImage: "//evil.example/card.jpg",
            noindex: false,
          },
        }),
      ],
    });

    expect(group(result, "og-image-missing").total).toBe(1);
  });

  it("does not flag a route with a card of its own", () => {
    expect(group(audit({ routes: [route()] }), "og-image-missing").total).toBe(0);
  });

  it("flags an article with no cover image", () => {
    const result = audit({ posts: [post({ coverImage: null })] });

    const images = group(result, "og-image-missing");
    expect(images.total).toBe(1);
    expect(images.findings[0].message).toContain("A post");
  });

  it("counts an authored seo.ogImage as the article's own card", () => {
    const result = audit({
      posts: [post({ coverImage: null, seo: { ogImage: "/covers/authored.jpg" } })],
    });

    expect(group(result, "og-image-missing").total).toBe(0);
  });
});

describe("platform SEO audit — article descriptions", () => {
  it("flags an article with neither an excerpt nor an authored description", () => {
    const result = audit({ posts: [post({ excerpt: null })] });

    expect(group(result, "description-missing").total).toBe(1);
  });

  it("accepts an authored description where the excerpt is empty", () => {
    const result = audit({
      posts: [post({ excerpt: "  ", seo: { description: "What it covers." } })],
    });

    expect(group(result, "description-missing").total).toBe(0);
  });

  it("never reports a missing title for an article", () => {
    // A post's <title> is its headline, which the write schema requires — there
    // is nothing a super-admin could act on.
    const result = audit({ posts: [post({ excerpt: null, coverImage: null })] });

    expect(group(result, "title-missing").total).toBe(0);
  });
});

describe("canonicalNamesRoute", () => {
  const base = platformBaseUrl();

  it("accepts a canonical that names the page it is on", () => {
    expect(canonicalNamesRoute(`${base}/blog/a-post`, "/blog/a-post")).toBe(true);
  });

  it("treats the bare origin as the homepage", () => {
    expect(canonicalNamesRoute(base, "/")).toBe(true);
  });

  it("ignores a trailing slash on either side", () => {
    expect(canonicalNamesRoute(`${base}/blog/`, "/blog")).toBe(true);
  });

  it("matches a percent-encoded path against the slug it was built from", () => {
    expect(canonicalNamesRoute(`${base}/blog/caf%C3%A9`, "/blog/café")).toBe(true);
  });

  it("rejects a canonical that collapsed to the bare origin", () => {
    // `platformCanonical` returns the base when `new URL` cannot parse the path,
    // so without this check every such page would declare the HOMEPAGE canonical.
    expect(canonicalNamesRoute(base, "/blog/a-post")).toBe(false);
  });

  it("rejects an empty canonical and an unparseable one", () => {
    expect(canonicalNamesRoute("", "/blog")).toBe(false);
    expect(canonicalNamesRoute("not-a-url", "/blog")).toBe(false);
  });

  it("rejects a canonical naming some other page", () => {
    expect(canonicalNamesRoute(`${base}/other`, "/blog")).toBe(false);
  });
});

describe("platform SEO audit — canonicals in the result", () => {
  it("passes for every route the real list publishes", () => {
    const fallbacks = platformRouteFallbacks();
    const routes: PlatformAuditRoute[] = [...fallbacks.entries()].map(
      ([path, fallback]) => ({ path, name: path, fallback, setting: null }),
    );

    expect(group(audit({ routes }), "canonical-missing").total).toBe(0);
  });

  it("flags a route whose path cannot be resolved into a URL", () => {
    // A path `new URL` refuses leaves the page declaring the origin as its
    // canonical — asking Google to index the homepage instead of it.
    const result = audit({
      routes: [route({ path: "/%E0%A4%A", name: "Broken", setting: null })],
    });

    expect(group(result, "canonical-missing").total).toBe(1);
    expect(group(result, "canonical-missing").severity).toBe("critical");
  });
});

describe("platform SEO audit — the result's shape", () => {
  it("reports only the checks it ran", () => {
    const result = audit({ routes: [route()] });

    expect(result.checks.map((entry) => entry.check).sort()).toEqual(
      [...PLATFORM_SEO_AUDIT_CHECKS].sort(),
    );
    // Never a storefront's checks: nothing here has products or a redirect table.
    expect(result.checks.map((entry) => entry.check)).not.toContain(
      "sitemap-deleted-leak",
    );
  });

  it("keeps canonical-missing out of the store audit's check list", () => {
    // The reason it lives in SEO_AUDIT_PLATFORM_ONLY_CHECKS: a tenant result
    // must not carry a group that passed without being looked at.
    expect(SEO_AUDIT_CHECKS).not.toContain("canonical-missing");
    expect(SEO_AUDIT_ALL_CHECKS).toContain("canonical-missing");
  });

  it("sorts failing checks worst-first", () => {
    const result = audit({
      routes: [route({ path: "/blog", name: "Blog", fallback: {}, setting: null })],
    });
    const failing = result.checks.filter((entry) => entry.total > 0);

    expect(failing[0].check).toBe("title-missing");
    expect(failing[failing.length - 1].check).toBe("og-image-missing");
  });

  it("takes each finding's severity from the weights table", () => {
    const result = audit({ routes: [route({ fallback: {}, setting: null })] });

    for (const entry of result.checks) {
      for (const item of entry.findings) {
        expect(item.severity).toBe(SEO_AUDIT_WEIGHTS[item.check].severity);
      }
    }
  });

  it("counts only the dimensions the platform has", () => {
    const result = audit({ routes: [route(), route({ path: "/faq" })], posts: [post()] });

    expect(result.stats.pages).toBe(2);
    expect(result.stats.posts).toBe(1);
    // A storefront's dimensions, reported as zero rather than invented — the
    // platform panel's copy names neither.
    expect(result.stats.products).toBe(0);
    expect(result.stats.redirects).toBe(0);
  });

  it("scores a clean site at 100 and a bare one below it", () => {
    expect(audit({ routes: [route()] }).score).toBe(100);

    const bare = audit({
      routes: [route({ fallback: {}, setting: null })],
    });
    expect(bare.score).toBeLessThan(100);
    expect(bare.severityCounts.warning).toBe(2);
  });
});

describe("platform SEO audit — every finding has a fix", () => {
  it("sends a route finding to that route's own row in the admin list", () => {
    const result = audit({
      routes: [route({ path: "/blog", name: "Blog", fallback: {}, setting: null })],
    });
    const finding = group(result, "title-missing").findings[0];

    expect(finding.target.tab).toBe("pages");
    // The path IS the key the admin list is indexed by, which is what lets the
    // panel's button open that row's editor.
    expect(finding.target.entityId).toBe("/blog");
    expect(finding.target.label).toBe("Blog");
    expect(finding.target.href).toBeUndefined();
  });

  it("links a post finding to its editor in The Wire", () => {
    const result = audit({ posts: [post({ excerpt: null })] });
    const finding = group(result, "description-missing").findings[0];

    expect(finding.target.tab).toBe("posts");
    expect(finding.target.href).toBe("/super-admin/the-wire/post_1");
    expect(finding.target.entityId).toBe("post_1");
  });

  it("survives the client parser, canonical group included", () => {
    // The parser drops any check id it does not know. Before US-020 it filtered
    // against the store's list, which would have silently deleted this group.
    const snapshot = parseSeoAuditSnapshot({
      audit: audit({ routes: [route({ path: "/%E0%A4%A", setting: null })] }),
      generatedAt: "2026-08-16T00:00:00.000Z",
      cached: false,
      expiresIn: 900,
    });

    expect(snapshot).not.toBeNull();
    expect(
      snapshot?.audit.checks.some((entry) => entry.check === "canonical-missing"),
    ).toBe(true);
  });
});

describe("GET /api/platform/seo/audit", () => {
  function request(query = "") {
    return new NextRequest(`https://budstacks.io/api/platform/seo/audit${query}`);
  }

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

  beforeEach(() => {
    vi.clearAllMocks();
    resetSeoAuditCache();
    getCurrentUser.mockResolvedValue(superAdmin());
    prismaMock.platform_seo_settings.findMany.mockResolvedValue([]);
    prismaMock.platform_posts.findMany.mockResolvedValue([]);
  });

  it("refuses a signed-out caller", async () => {
    getCurrentUser.mockResolvedValue(null);

    const res = await getPlatformAudit(request());

    expect(res.status).toBe(401);
    expect(prismaMock.platform_posts.findMany).not.toHaveBeenCalled();
  });

  it("refuses a tenant admin", async () => {
    getCurrentUser.mockResolvedValue(superAdmin({ role: "ADMIN", tenantId: "t_1" }));

    const res = await getPlatformAudit(request());

    expect(res.status).toBe(401);
  });

  it("audits every published route and post for a super-admin", async () => {
    prismaMock.platform_posts.findMany.mockResolvedValue([
      { ...post({ excerpt: null, coverImage: null }) },
    ]);

    const res = await getPlatformAudit(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.audit.stats.posts).toBe(1);
    // The whole authorable route list, not a sample of it.
    expect(body.audit.stats.pages).toBe(platformRouteFallbacks().size);
    expect(body.cached).toBe(false);
  });

  it("names no tenant in either read, and only published posts", () => {
    return getPlatformAudit(request()).then(() => {
      const postArgs = prismaMock.platform_posts.findMany.mock.calls[0][0];
      expect(postArgs.where).toEqual({ published: true });
      expect(JSON.stringify(postArgs)).not.toContain("tenantId");

      const settingArgs =
        prismaMock.platform_seo_settings.findMany.mock.calls[0][0];
      expect(JSON.stringify(settingArgs)).not.toContain("tenantId");
      // The article body is the one big column and no check reads it.
      expect(postArgs.select.content).toBeUndefined();
    });
  });

  it("serves the second call from the cache and recomputes on refresh=1", async () => {
    await getPlatformAudit(request());
    const cached = await (await getPlatformAudit(request())).json();

    expect(cached.cached).toBe(true);
    expect(prismaMock.platform_posts.findMany).toHaveBeenCalledTimes(1);

    const refreshed = await (await getPlatformAudit(request("?refresh=1"))).json();

    expect(refreshed.cached).toBe(false);
    expect(prismaMock.platform_posts.findMany).toHaveBeenCalledTimes(2);
  });

  it("keys the cache on something no tenant id can collide with", () => {
    // One Map holds both audits; a collision would serve a store's findings on
    // the platform page or the reverse.
    expect(PLATFORM_SEO_AUDIT_CACHE_KEY).toBe("platform:budstacks.io");
    expect(PLATFORM_SEO_AUDIT_CACHE_KEY).not.toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("reports a failed query as an outage, and does not cache it", async () => {
    prismaMock.platform_posts.findMany.mockRejectedValueOnce(
      new Error("Can't reach database server"),
    );

    const failed = await getPlatformAudit(request());
    expect(failed.status).toBe(500);
    // The safe message, never the driver's. (`apiError` adds a `details` key
    // outside production for local debugging — that is house behaviour, and it
    // is the `error` field a client renders.)
    expect((await failed.json()).error).toBe("Could not run the SEO audit");

    // The next request retries rather than being told for fifteen minutes that
    // the audit is unavailable.
    const recovered = await getPlatformAudit(request());
    expect(recovered.status).toBe(200);
  });
});
