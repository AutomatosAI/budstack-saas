import { NextResponse } from "next/server";

import { withSuperAdmin } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import {
  PLATFORM_SEO_AUDIT_CACHE_KEY,
  runPlatformSeoAudit,
  type PlatformAuditPost,
  type PlatformAuditRoute,
} from "@/lib/platform/seo-audit";
import {
  platformRouteFallbacks,
  platformSeoRoutes,
} from "@/lib/platform/seo-routes";
import {
  PLATFORM_SEO_SETTING_SELECT,
  type PlatformSeoSettingRow,
} from "@/lib/platform/seo-settings";
import { cachedSeoAudit } from "@/lib/seo/audit-cache";
import type { SeoAuditResult } from "@/lib/seo/audit-types";

/**
 * Platform US-020 — budstacks.io's own SEO audit.
 *
 * SUPER-ADMIN ONLY, via `withSuperAdmin`, like every other write and read under
 * `app/api/platform/` except `leads`. That one is deliberately unauthenticated
 * because a prospect filling in the homepage CTA has no account; it is not the
 * model for anything else in this directory, and least of all for a route that
 * enumerates which of our marketing pages are unauthored.
 *
 * THE QUERIES ARE THE ONLY I/O IN THIS FEATURE, exactly as on the tenant side:
 * everything downstream (`runPlatformSeoAudit`) is pure, so what this route
 * decides is which rows the judgement is made over.
 *
 * NO TENANT APPEARS IN EITHER PREDICATE. `platform_seo_settings` and
 * `platform_posts` are both deliberately absent from `tenantScopedModels`
 * (lib/db.ts), an OPT-IN allowlist; joining either would weld a tenantId filter
 * onto these reads and audit an empty site. `withSuperAdmin` binds a NULL tenant
 * context around the handler, so these are deliberate non-tenant queries rather
 * than the implicit-unbound case that wrapper exists to refuse.
 */

const ROUTE = "/api/platform/seo/audit";

/** The post columns metadata is built from. The article body is not one. */
const AUDIT_POST_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  coverImage: true,
  authorName: true,
  publishedAt: true,
  seo: true,
} as const;

async function auditPlatform(): Promise<SeoAuditResult> {
  // Row types are annotated rather than inferred: the `prisma` export in
  // lib/db.ts is any-widened by its build-time mock Proxy, so an inferred row
  // would collapse to `any` and take the audit's types with it (TS7006).
  const [settings, posts]: [PlatformSeoSettingRow[], PlatformAuditPost[]] =
    await Promise.all([
      prisma.platform_seo_settings.findMany({
        select: PLATFORM_SEO_SETTING_SELECT,
      }),
      // Published only. A draft has no public URL, so auditing its metadata
      // would be advice about a page that 404s — the same call the tenant audit
      // makes about unpublished posts.
      prisma.platform_posts.findMany({
        where: { published: true },
        orderBy: { title: "asc" },
        select: AUDIT_POST_SELECT,
      }),
    ]);

  const byPath = new Map<string, PlatformSeoSettingRow>(
    settings.map((row: PlatformSeoSettingRow) => [row.routePath, row]),
  );
  const fallbacks = platformRouteFallbacks();

  const routes: PlatformAuditRoute[] = platformSeoRoutes().map((route) => ({
    path: route.path,
    name: route.name,
    fallback: fallbacks.get(route.path),
    setting: byPath.get(route.path) ?? null,
  }));

  return runPlatformSeoAudit({ routes, posts });
}

/**
 * GET — the audit, from the shared 15-minute cache unless `refresh=1`.
 *
 * The tenant audit's cache module is reused rather than copied: it already
 * de-duplicates concurrent runs, evicts by age and refuses to remember a failed
 * run, and there is nothing platform-specific about any of that.
 */
export const GET = withSuperAdmin(async (req) => {
  const refresh = new URL(req.url).searchParams.get("refresh") === "1";

  try {
    const snapshot = await cachedSeoAudit(
      PLATFORM_SEO_AUDIT_CACHE_KEY,
      auditPlatform,
      { refresh },
    );

    return NextResponse.json(snapshot);
  } catch (error) {
    return apiError(error, {
      route: `GET ${ROUTE}`,
      safeMessage: "Could not run the SEO audit",
    });
  }
});
