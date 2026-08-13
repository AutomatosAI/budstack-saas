/**
 * SEO Supercharge US-006 — the platform's own public origin (budstacks.io), as
 * opposed to a tenant's (`getTenantBaseUrl`, lib/tenant/tenant-utils.ts).
 *
 * Extracted from the private `appBaseUrl()` in lib/team/invite-email.ts, which
 * was the only place the precedence had been written down. The platform sitemap
 * and robots.txt need the same answer, and a second copy would be a second
 * origin the moment one of them was changed — the exact drift `storeCanonical`
 * exists to prevent on the tenant side.
 *
 * Precedence, unchanged from the invite-email original:
 *   NEXT_PUBLIC_APP_URL → https://{NEXT_PUBLIC_BASE_DOMAIN} → https://budstacks.io
 *
 * Read at CALL time, never at module load: `app/robots.ts` and `app/sitemap.ts`
 * are rendered per request (`force-dynamic`) precisely so a value that differs
 * between the Docker build and the running container is taken from the
 * container. Neither var is a Dockerfile build arg today.
 *
 * Deliberately dependency-free — the invite-email module reaches prisma and
 * react-email, and nothing that imports this should have to.
 */

/** Last resort: the production apex, matching app/layout.tsx's og:url. */
const PLATFORM_APEX_URL = "https://budstacks.io";

/** No trailing slash: every caller appends its own path. */
function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function platformBaseUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) return withoutTrailingSlash(appUrl);

  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN?.trim();
  if (baseDomain) return withoutTrailingSlash(`https://${baseDomain}`);

  return PLATFORM_APEX_URL;
}
