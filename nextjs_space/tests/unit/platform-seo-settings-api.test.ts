import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * US-014 — the platform SEO write API and the route list behind it.
 *
 * `/api/platform/seo` decides what a search engine reads for budstacks.io
 * itself, so the claims worth pinning are the ones that keep that honest:
 *
 *  1. SUPER-ADMIN ONLY. The sibling route `platform/leads` is deliberately
 *     unauthenticated, and this family is not that — a tenant admin gets
 *     nowhere near the front page's title.
 *  2. The routePath is validated against the code-defined list, so a misspelt
 *     path cannot be filed as a row no page will ever read.
 *  3. "" is stored as NULL. US-015 falls back per COLUMN, and a stored empty
 *     string would override a real title with nothing at all.
 *  4. `noindex` defaults false on an absent key — a settings save must never be
 *     the reason a marketing page drops out of the index.
 *  5. The `.strict()` schema refuses a key with no column behind it, which is
 *     what stops the editor growing a write-only control.
 *  6. The list covers every public marketing route the PRD enumerates, guides
 *     included, and every seeded route from the US-013 migration.
 *
 * Module-boundary mocks only (getCurrentUser, prisma). The real auth wrapper,
 * the real same-origin guard and the real Zod schema all execute.
 */
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const prismaMock = vi.hoisted(() => ({
  platform_seo_settings: { findMany: vi.fn(), upsert: vi.fn() },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { PUT as putPlatformSeo } from "@/app/api/platform/seo/route";
import {
  PLATFORM_SEO_STATIC_ROUTES,
  isPlatformSeoRoutePath,
  platformSeoRoutes,
} from "@/lib/platform/seo-routes";
import { GUIDES } from "@/lib/documents/registry";

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
function request(body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`https://${HOST}/api/platform/seo`, {
    method: "PUT",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "sec-fetch-site": "same-origin", host: HOST, ...headers },
  });
}

/** What the upsert was called with, for the one call it should have made. */
function upsertArgs(): {
  where: { routePath: string };
  create: Record<string, unknown>;
  update: Record<string, unknown>;
} {
  expect(prismaMock.platform_seo_settings.upsert).toHaveBeenCalledTimes(1);
  return prismaMock.platform_seo_settings.upsert.mock.calls[0][0];
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue(superAdmin());
  prismaMock.platform_seo_settings.upsert.mockImplementation(
    async ({
      where,
      update,
    }: {
      where: { routePath: string };
      update: Record<string, unknown>;
    }) => ({ id: "row_1", routePath: where.routePath, ...update }),
  );
});

describe("platform SEO settings are super-admin only (US-014)", () => {
  it.each([
    ["a tenant admin", superAdmin({ role: "TENANT_ADMIN", tenantId: "t_1" })],
    ["a patient", superAdmin({ role: "PATIENT", tenantId: "t_1" })],
    ["nobody signed in", null],
  ])("refuses %s and writes nothing", async (_label, user) => {
    getCurrentUser.mockResolvedValue(user);

    const res = await putPlatformSeo(request({ routePath: "/", title: "x" }));

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(prismaMock.platform_seo_settings.upsert).not.toHaveBeenCalled();
  });

  it("refuses a cross-origin write from a real super-admin session", async () => {
    const res = await putPlatformSeo(
      request({ routePath: "/", title: "x" }, { "sec-fetch-site": "cross-site" }),
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(prismaMock.platform_seo_settings.upsert).not.toHaveBeenCalled();
  });
});

describe("platform SEO settings validation (US-014)", () => {
  it("refuses a path budstacks.io does not publish", async () => {
    const res = await putPlatformSeo(
      request({ routePath: "/tenant-admin", title: "Sneaky" }),
    );

    expect(res.status).toBe(400);
    expect(prismaMock.platform_seo_settings.upsert).not.toHaveBeenCalled();
  });

  it("refuses a key with no column behind it", async () => {
    // `.strict()` is what stops the editor growing a control the table cannot
    // store and no page can read.
    const res = await putPlatformSeo(
      request({ routePath: "/", canonicalOverride: "https://example.com" }),
    );

    expect(res.status).toBe(400);
    expect(prismaMock.platform_seo_settings.upsert).not.toHaveBeenCalled();
  });

  it.each(["//evil.example.com/card.png", "card.png", "javascript:alert(1)"])(
    "refuses %s as a social image — platformAbsoluteUrl would drop it",
    async (ogImage) => {
      const res = await putPlatformSeo(request({ routePath: "/", ogImage }));

      expect(res.status).toBe(400);
      expect(prismaMock.platform_seo_settings.upsert).not.toHaveBeenCalled();
    },
  );

  it.each(["/budstack-hero-ecosystem.jpg", "https://cdn.example.com/card.png"])(
    "accepts %s — a rooted path or an absolute URL",
    async (ogImage) => {
      const res = await putPlatformSeo(request({ routePath: "/", ogImage }));

      expect(res.status).toBe(200);
      expect(upsertArgs().update.ogImage).toBe(ogImage);
    },
  );
});

describe("platform SEO settings write behaviour (US-014)", () => {
  it("upserts by routePath, so a rowless guide saves like any other route", async () => {
    const guide = platformSeoRoutes().find((route) =>
      route.path.startsWith("/documents/"),
    );
    expect(guide).toBeDefined();

    const res = await putPlatformSeo(
      request({ routePath: guide!.path, title: "Part one" }),
    );

    expect(res.status).toBe(200);
    const args = upsertArgs();
    expect(args.where).toEqual({ routePath: guide!.path });
    expect(args.create).toMatchObject({ routePath: guide!.path, title: "Part one" });
  });

  it("stores an emptied field as NULL, never as an empty string", async () => {
    const res = await putPlatformSeo(
      request({ routePath: "/", title: "", description: "   ", ogImage: "" }),
    );

    expect(res.status).toBe(200);
    expect(upsertArgs().update).toMatchObject({
      title: null,
      description: null,
      ogImage: null,
    });
  });

  it("trims what it stores", async () => {
    await putPlatformSeo(request({ routePath: "/", title: "  BudStacks  " }));

    expect(upsertArgs().update.title).toBe("BudStacks");
  });

  it("defaults noindex to false when the key is absent", async () => {
    await putPlatformSeo(request({ routePath: "/", title: "BudStacks" }));

    const args = upsertArgs();
    expect(args.update.noindex).toBe(false);
    expect(args.create.noindex).toBe(false);
  });

  it("writes noindex when it is asked to", async () => {
    await putPlatformSeo(request({ routePath: "/faq", noindex: true }));

    expect(upsertArgs().update.noindex).toBe(true);
  });

  it("answers with the stored row, so the list shows what the next reader sees", async () => {
    const res = await putPlatformSeo(request({ routePath: "/", title: "  Hi  " }));
    const body = await res.json();

    expect(body.setting).toMatchObject({ routePath: "/", title: "Hi" });
  });

  it("never names a tenantId — platform_seo_settings belongs to no store", async () => {
    await putPlatformSeo(request({ routePath: "/", title: "BudStacks" }));

    const args = upsertArgs();
    expect(JSON.stringify(args)).not.toContain("tenantId");
  });
});

describe("the platform SEO route list (US-014)", () => {
  /** Every public marketing route the PRD enumerates for this story. */
  const REQUIRED_PATHS = [
    "/",
    "/marketplace",
    "/learn",
    "/blog",
    "/contact",
    "/documents",
    "/faq",
    "/regulatory",
    "/terms",
    "/privacy",
    "/cookies",
    "/dpa",
    "/aup",
    "/legal/changelog",
    "/legal/subprocessors",
  ] as const;

  it.each(REQUIRED_PATHS)("covers %s", (path) => {
    expect(isPlatformSeoRoutePath(path)).toBe(true);
  });

  it("covers every PUBLISHED guide, and no coming-soon one", () => {
    const paths = platformSeoRoutes().map((route) => route.path);

    for (const guide of GUIDES) {
      expect(paths.includes(`/documents/${guide.slug}`)).toBe(
        guide.status === "published",
      );
    }
    expect(GUIDES.some((guide) => guide.status === "published")).toBe(true);
  });

  it("lists no path twice — a route with two rows has no defined title", () => {
    const paths = platformSeoRoutes().map((route) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("keys every route the way the column is documented", () => {
    for (const route of platformSeoRoutes()) {
      expect(route.path.startsWith("/")).toBe(true);
      expect(route.path).not.toMatch(/\?|#/);
      if (route.path !== "/") expect(route.path.endsWith("/")).toBe(false);
      expect(route.name.length).toBeGreaterThan(0);
    }
  });

  it("matches the fifteen routes the US-013 migration seeded", () => {
    expect(PLATFORM_SEO_STATIC_ROUTES.map((route) => route.path).sort()).toEqual(
      [...REQUIRED_PATHS].sort(),
    );
  });

  it("offers nothing behind the auth wall", () => {
    // Everything on this list must be in middleware.ts's isPublicRoute
    // allowlist; authoring a title for a login redirect helps nobody.
    for (const route of platformSeoRoutes()) {
      expect(route.path).not.toMatch(/^\/(tenant-admin|super-admin|api|auth)\b/);
    }
  });
});
