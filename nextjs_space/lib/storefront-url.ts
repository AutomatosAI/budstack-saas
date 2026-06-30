import { parseHostToTenantHint } from "@/lib/parse-host";

/**
 * Build a customer-facing storefront URL that resolves on whichever host the
 * customer is actually on.
 *
 * Tenant hosts — `{slug}.budstacks.io` and custom domains — serve the store at
 * ROOT: middleware rewrites `/checkout` -> `/store/<slug>/checkout` internally
 * (see middleware.ts). So the PUBLIC path must NOT carry a `/store/<slug>`
 * prefix — that legacy path 404s on a tenant host. Only the platform apex serves
 * the store under `/store/<slug>`. Getting this wrong sends PayCloud's
 * post-payment redirect (return_url) to a 404.
 *
 * @param origin full origin, e.g. "https://healingbuds.budstacks.io"
 * @param host   the Host header, e.g. "healingbuds.budstacks.io"
 * @param slug   tenant slug
 * @param path   root-relative storefront path beginning with "/", e.g. "/payment/return/abc"
 */
export function storefrontUrl(
  origin: string,
  host: string,
  slug: string,
  path: string,
): string {
  // A tenant host (subdomain or custom domain) → store served at root.
  // The apex (no tenant hint) → store served under /store/<slug>.
  const onTenantHost = parseHostToTenantHint(host) !== null;
  const prefix = onTenantHost ? "" : `/store/${slug}`;
  return `${origin}${prefix}${path}`;
}
