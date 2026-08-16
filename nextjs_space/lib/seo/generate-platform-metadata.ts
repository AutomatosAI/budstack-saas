/**
 * US-015 — the `generateMetadata` body every budstacks.io marketing page shares.
 *
 * `lib/seo/generate-page-metadata.ts`'s counterpart for the platform: that one
 * resolves a tenant and hands off to a pure builder, this one resolves a
 * `platform_seo_settings` row and hands off to `buildPlatformPageMetadata`.
 * Splitting the read from the build is what keeps the builder testable without
 * a database and total without a try/catch in every page.
 *
 * THE DEFECT THIS CLOSES: `platform_seo_settings` shipped in US-013 with a
 * super-admin editor on top of it (US-014) and NOTHING reading it. Every title
 * budstacks.io served was still a string in a page file, so changing one meant a
 * deploy — and the seeded og:image sat in a column no rendered tag carried.
 *
 * NO SECOND QUERY. `loadPlatformSeoSetting` is React-`cache()`d, so a page whose
 * body ever needs the same row shares this round trip rather than issuing its
 * own — the arrangement `loadPublishedPlatformPost` already has with
 * app/blog/[slug]/page.tsx.
 *
 * NO TENANT APPEARS IN THE PREDICATE. `platform_seo_settings` is deliberately
 * absent from `tenantScopedModels` (lib/db.ts), an OPT-IN allowlist; joining it
 * would weld a tenantId filter onto this read and every marketing page would
 * fall back forever.
 */

import { cache } from "react";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  PLATFORM_SEO_SETTING_SELECT,
  type PlatformSeoSettingRow,
} from "@/lib/platform/seo-settings";
import type { Metadata } from "next";

import {
  PLATFORM_ROUTE_FALLBACKS,
  buildPlatformPageMetadata,
  type PlatformRouteFallback,
} from "@/lib/seo/platform-page-metadata";

/**
 * The authored row for one route, or null when there is none.
 *
 * NULL ON FAILURE, NOT A THROW — the opposite call from the blog loaders
 * (lib/platform/published-posts.ts), and for the opposite reason. There the
 * failed query IS the page, so an empty answer would be a lie about what has
 * been published. Here the query is an OVERRIDE of metadata the page already
 * has: swallowing the error costs an authored title until the database is back,
 * where re-throwing would 500 a legal document over its `<title>`. And
 * `generateMetadata` has no `error.tsx` boundary above it, so a throw here is a
 * blank page, not a degraded one. The failure is logged, so it is visible as an
 * outage rather than as a quiet absence.
 *
 * `findUnique` is correct here, unlike on any tenant-scoped model: no `$extends`
 * layer rewrites this call, and `routePath` is `@unique` in its own right.
 */
export const loadPlatformSeoSetting = cache(
  async (routePath: string): Promise<PlatformSeoSettingRow | null> => {
    try {
      // Row type stated explicitly: the `prisma` export is any-widened (the
      // build-time client is a Proxy mock), so an inferred result widens
      // everything downstream to `any`.
      const setting: PlatformSeoSettingRow | null =
        await prisma.platform_seo_settings.findUnique({
          where: { routePath },
          select: PLATFORM_SEO_SETTING_SELECT,
        });

      return setting;
    } catch (error) {
      logger.error("[platform-seo] settings read failed", {
        routePath,
        reason: error instanceof Error ? error.message : "unknown",
      });
      return null;
    }
  },
);

/**
 * Metadata for one static marketing route — the whole body of fifteen pages'
 * `generateMetadata`.
 *
 * The fallback is looked up rather than passed in so that the path a page
 * declares is the same key the admin list edits and the write API validates; a
 * page passing its own strings could author metadata for `/terms` under a path
 * no row will ever match.
 */
export async function generatePlatformRouteMetadata(
  routePath: string,
): Promise<Metadata> {
  const setting = await loadPlatformSeoSetting(routePath);

  return buildPlatformPageMetadata({
    routePath,
    fallback: PLATFORM_ROUTE_FALLBACKS[routePath],
    setting,
  });
}

/**
 * Metadata for one `/documents/{slug}` guide.
 *
 * The fallback is the guide's OWN title and summary, passed in because it lives
 * in the guide registry rather than in a route table — each guide is its own
 * authorable route (`platformSeoRoutes()` lists every published one), so a row
 * keyed on `/documents/{slug}` overrides that guide and nothing else.
 *
 * A GUIDE DOES NOT INHERIT `/documents`'s ROW, deliberately. The seed left the
 * guides rowless, and having them fall back to the index's row would mean
 * authoring one title silently retitled eighteen pages. What they do share is
 * the platform default og:image, which `buildPlatformPageMetadata` supplies to
 * every route.
 */
export async function generatePlatformGuideMetadata(
  slug: string,
  fallback: PlatformRouteFallback,
): Promise<Metadata> {
  const routePath = `/documents/${slug}`;
  const setting = await loadPlatformSeoSetting(routePath);

  return buildPlatformPageMetadata({ routePath, fallback, setting });
}
