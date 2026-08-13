import type { MetadataRoute } from "next";

import { platformBaseUrl } from "@/lib/seo/platform-url";

/**
 * SEO US-006 — the PLATFORM robots.txt (budstacks.io). There was none: neither
 * app/robots.ts nor public/robots.txt existed, so the apex answered /robots.txt
 * with a Clerk sign-in redirect and pointed crawlers at no sitemap at all.
 * Stores have had their own since before this run
 * (app/store/[slug]/robots.txt/route.ts) and keep it — middleware rewrites a
 * tenant host's /robots.txt to that handler (middleware.ts:148, :202) and
 * returns before the auth check, so this file is only ever served on the apex.
 * `/robots.txt` is in the middleware's `isPublicRoute` allowlist for the same
 * reason `/sitemap.xml` is (see app/sitemap.ts).
 */

/** Per-request, so the origin comes from the container's env rather than
 *  whatever was set when the Docker image was built — neither
 *  NEXT_PUBLIC_APP_URL nor NEXT_PUBLIC_BASE_DOMAIN is a build arg (Dockerfile). */
export const dynamic = "force-dynamic";

/**
 * Paths no crawler should spend budget on. The first four mirror the tenant
 * robots.txt; the rest are apex-only surfaces:
 *  - `/store/` is the INTERNAL rewrite target. On the apex it also serves
 *    directly (path-based routing, middleware.ts:215), so every storefront page
 *    is reachable at a second URL that duplicates the tenant host's content.
 *  - `/onboarding` and `/accept-invite` are public by design (a signed-out
 *    invitee has to reach them) but are one-shot flows keyed on a token.
 */
const DISALLOWED_PATHS: readonly string[] = [
  "/api/",
  "/tenant-admin/",
  "/super-admin/",
  "/auth/",
  "/store/",
  "/onboarding",
  "/accept-invite",
];

export default function robots(): MetadataRoute.Robots {
  const baseUrl = platformBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...DISALLOWED_PATHS],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
