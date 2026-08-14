import type { MetadataRoute } from "next";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { platformBaseUrl } from "@/lib/seo/platform-url";

/**
 * SEO US-006 — the PLATFORM sitemap (budstacks.io). There was none: neither
 * app/sitemap.ts nor public/sitemap.xml existed, so the marketing site and the
 * Learning Center were discoverable only by whatever a crawler happened to
 * follow.
 *
 * WHY THIS NEVER SERVES A STORE. Tenant hosts never reach `/sitemap.xml`:
 * middleware rewrites a subdomain request to `/store/{subdomain}/sitemap.xml`
 * and a custom-domain request to `/store/cd-{hash}/sitemap.xml`
 * (middleware.ts:148 and :202), both of which resolve to the tenant route
 * handler and return before the auth check. So this is route precedence, not a
 * host check — there is no host for this file to test that middleware has not
 * already routed elsewhere.
 *
 * `/sitemap.xml` itself had to be added to the middleware's `isPublicRoute`
 * allowlist: the apex carries no tenant hint, so a signed-out crawler fell
 * through to the auth check and got a 307 to /auth/login (verified live before
 * and after — US-006 journal).
 *
 * ONLY ROUTES A CRAWLER CAN ACTUALLY FETCH. Every path below is in that same
 * allowlist (middleware.ts:8-46); anything else on the apex answers a signed-out
 * request with a Clerk sign-in redirect, and listing it would be advertising a
 * login wall.
 */

/** Per-request: at build time DATABASE_URL is a dummy and the mock prisma
 *  client in lib/db.ts returns [] for every query, which would bake a Learning
 *  Center section that is permanently empty into the static output. */
export const dynamic = "force-dynamic";

interface MarketingPath {
  readonly path: string;
  readonly priority: number;
  readonly changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}

const MARKETING_PATHS: readonly MarketingPath[] = [
  { path: "", priority: 1.0, changeFrequency: "weekly" },
  { path: "/marketplace", priority: 0.9, changeFrequency: "weekly" },
  { path: "/learn", priority: 0.8, changeFrequency: "weekly" },
  { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
  { path: "/contact", priority: 0.6, changeFrequency: "monthly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/cookies", priority: 0.3, changeFrequency: "yearly" },
];

interface LearningResourceRow {
  readonly slug: string;
  readonly updatedAt: Date;
}

/**
 * Published Learning Center articles, or [] when the database is unreachable.
 *
 * `learning_resources` is not tenant-scoped in lib/db.ts, so this needs no
 * context binding. Total by construction: a sitemap that 500s teaches a crawler
 * the whole site is broken, where one missing section costs only freshness.
 */
async function loadPublishedLearningResources(): Promise<LearningResourceRow[]> {
  try {
    return await prisma.learning_resources.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
    });
  } catch (error) {
    logger.warn("[seo] platform sitemap: learning resources unavailable", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = platformBaseUrl();
  const resources = await loadPublishedLearningResources();

  return [
    ...MARKETING_PATHS.map((entry) => ({
      url: `${baseUrl}${entry.path}`,
      changeFrequency: entry.changeFrequency,
      priority: entry.priority,
    })),
    ...resources.map((resource) => ({
      url: `${baseUrl}/learn/${encodeURIComponent(resource.slug)}`,
      lastModified: resource.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
