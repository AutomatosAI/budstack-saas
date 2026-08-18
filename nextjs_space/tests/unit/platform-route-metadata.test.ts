import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * US-015 — the read that finally makes `platform_seo_settings` do something.
 *
 * The claims worth pinning are the ones about the query and its failure:
 *
 *  1. A FAILED READ IS NOT A BLANK PAGE. This loader returns null rather than
 *     re-throwing — the opposite call from lib/platform/published-posts.ts, and
 *     deliberately: there the failed query IS the page, here it is an OVERRIDE
 *     of metadata the page already has. `generateMetadata` has no `error.tsx`
 *     boundary above it, so a throw would take a legal document down over its
 *     `<title>`.
 *  2. NO TENANT IN THE PREDICATE. `platform_seo_settings` is absent from
 *     `tenantScopedModels` (lib/db.ts, an opt-in allowlist); a tenantId filter
 *     welded onto this read would make every marketing page fall back forever.
 *  3. A GUIDE READS ITS OWN ROW, `/documents/{slug}` — never the `/documents`
 *     index's, which would let one save retitle eighteen pages.
 */

const prismaMock = vi.hoisted(() => ({
  platform_seo_settings: { findUnique: vi.fn() },
}));
const loggerMock = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({ logger: loggerMock }));

import { PLATFORM_SEO_SETTING_SELECT } from "@/lib/platform/seo-settings";
import {
  generatePlatformGuideMetadata,
  generatePlatformRouteMetadata,
} from "@/lib/seo/generate-platform-metadata";
import {
  PLATFORM_DEFAULT_TITLE,
  PLATFORM_ROUTE_FALLBACKS,
} from "@/lib/seo/platform-page-metadata";

/**
 * `loadPlatformSeoSetting` is React-`cache()`d, and the memo is not reset
 * between tests — so every case reads a DIFFERENT route rather than asserting
 * against a warm entry. Each path below is used once.
 */
beforeEach(() => {
  vi.clearAllMocks();
});

describe("generatePlatformRouteMetadata — the query", () => {
  it("looks the route up by routePath and names no tenant", async () => {
    prismaMock.platform_seo_settings.findUnique.mockResolvedValue(null);

    await generatePlatformRouteMetadata("/privacy");

    expect(prismaMock.platform_seo_settings.findUnique).toHaveBeenCalledWith({
      where: { routePath: "/privacy" },
      select: PLATFORM_SEO_SETTING_SELECT,
    });

    const args = JSON.stringify(
      prismaMock.platform_seo_settings.findUnique.mock.calls[0],
    );
    expect(args).not.toContain("tenantId");
    expect(args).not.toContain("tenant_id");
  });

  it("serves the authored row", async () => {
    prismaMock.platform_seo_settings.findUnique.mockResolvedValue({
      id: "1",
      routePath: "/cookies",
      title: "How we use cookies | BudStacks",
      description: "Authored in the admin, no deploy.",
      ogImage: "/social/cookies.png",
      noindex: true,
    });

    const meta = await generatePlatformRouteMetadata("/cookies");

    expect(meta.title).toBe("How we use cookies | BudStacks");
    expect(meta.description).toBe("Authored in the admin, no deploy.");
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it("serves the shipped metadata when the route has no row", async () => {
    prismaMock.platform_seo_settings.findUnique.mockResolvedValue(null);

    const meta = await generatePlatformRouteMetadata("/dpa");

    expect(meta.title).toBe(PLATFORM_ROUTE_FALLBACKS["/dpa"].title);
    expect(meta.description).toBe(
      PLATFORM_ROUTE_FALLBACKS["/dpa"].description,
    );
  });
});

describe("generatePlatformRouteMetadata — a failed read", () => {
  it("falls back to the shipped metadata instead of throwing", async () => {
    prismaMock.platform_seo_settings.findUnique.mockRejectedValue(
      new Error("connect ECONNREFUSED postgres.railway.internal:5432"),
    );

    const meta = await generatePlatformRouteMetadata("/aup");

    expect(meta.title).toBe(PLATFORM_ROUTE_FALLBACKS["/aup"].title);
    expect(meta.description).toBe(
      PLATFORM_ROUTE_FALLBACKS["/aup"].description,
    );
  });

  it("logs the failure so an outage is visible rather than quiet", async () => {
    prismaMock.platform_seo_settings.findUnique.mockRejectedValue(
      new Error("connect ECONNREFUSED"),
    );

    await generatePlatformRouteMetadata("/regulatory");

    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.stringContaining("platform-seo"),
      expect.objectContaining({ routePath: "/regulatory" }),
    );
  });

  it("still resolves a title for a route that ships none", async () => {
    prismaMock.platform_seo_settings.findUnique.mockRejectedValue(
      new Error("down"),
    );

    // An empty table AND a dead database on the route with no metadata of its
    // own — the worst case the fallback chain has to survive.
    expect((await generatePlatformRouteMetadata("/blog")).title).toBe(
      PLATFORM_DEFAULT_TITLE,
    );
  });
});

describe("generatePlatformGuideMetadata", () => {
  it("reads the guide's own path and falls back to its title and summary", async () => {
    prismaMock.platform_seo_settings.findUnique.mockResolvedValue(null);

    const meta = await generatePlatformGuideMetadata("part-3-products", {
      title: "Products — The BudStacks Guide",
      description: "Every field on the product form, explained.",
    });

    expect(prismaMock.platform_seo_settings.findUnique).toHaveBeenCalledWith({
      where: { routePath: "/documents/part-3-products" },
      select: PLATFORM_SEO_SETTING_SELECT,
    });
    expect(meta.title).toBe("Products — The BudStacks Guide");
    expect(meta.description).toBe(
      "Every field on the product form, explained.",
    );
  });

  it("lets a guide's own row override it", async () => {
    prismaMock.platform_seo_settings.findUnique.mockResolvedValue({
      id: "2",
      routePath: "/documents/part-4-orders",
      title: "Orders, end to end",
      description: null,
      ogImage: null,
      noindex: false,
    });

    const meta = await generatePlatformGuideMetadata("part-4-orders", {
      title: "Orders — The BudStacks Guide",
      description: "What happens after checkout.",
    });

    expect(meta.title).toBe("Orders, end to end");
    // Per column: the row authored no description, so the guide's summary
    // stands rather than being blanked.
    expect(meta.description).toBe("What happens after checkout.");
  });
});
