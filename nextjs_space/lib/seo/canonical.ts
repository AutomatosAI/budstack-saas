/**
 * SEO Supercharge — the canonical URL for a storefront page.
 *
 * THE DEFECT THIS CLOSES (US-007, helper built here for US-002's first callers):
 * a tenant with a custom domain serves the identical store on BOTH
 * `{subdomain}.budstacks.io` and their own domain, with a canonical tag on the
 * homepage only. Every other page is duplicate content with no signal about
 * which host owns it.
 *
 * The primary host is whatever `getTenantBaseUrl` calls primary — custom domain
 * when set, subdomain otherwise — so canonicals, sitemap URLs, robots and email
 * links cannot drift apart.
 *
 * Total: never throws, never returns a relative URL. It runs inside
 * `generateMetadata`, which has no error.tsx boundary above it, and Next feeds
 * the result to `new URL()` when it resolves `alternates.canonical`.
 */

import { getTenantBaseUrl, type TenantUrlData } from "@/lib/tenant/tenant-utils";

export interface StoreCanonicalOptions {
  /**
   * A stored per-entity canonical, for the indexing controls in US-022. An
   * absolute URL is used verbatim (that is the point of an override: pointing
   * at a page on another host); anything else is treated as a store-relative
   * path, so an override can never escape to a URL that does not parse.
   */
  readonly override?: string | null;
}

/**
 * Store-relative path in canonical form: no query, no fragment, one leading
 * slash, no trailing slash. "" for the store root, which keeps the homepage's
 * existing canonical (`https://host`, app/store/[slug]/page.tsx) unchanged —
 * `https://host` and `https://host/` are different strings to a crawler.
 */
function canonicalPath(raw: string): string {
  const withoutQuery = raw.split("#")[0].split("?")[0].trim();
  if (!withoutQuery || withoutQuery === "/") return "";

  const withLeadingSlash = withoutQuery.startsWith("/")
    ? withoutQuery
    : `/${withoutQuery}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

/**
 * `origin` of a URL string, or null when it does not parse. `customDomain`
 * reaches the DB from domain provisioning and the super-admin form, so it can
 * be a value `new URL` rejects.
 */
function origin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** The tenant's primary origin, degrading to the always-well-formed subdomain. */
function primaryOrigin(tenant: TenantUrlData): string {
  const preferred = getTenantBaseUrl(tenant);
  if (!tenant.customDomain) return origin(preferred) ?? preferred;

  const subdomainUrl = getTenantBaseUrl({
    subdomain: tenant.subdomain,
    customDomain: null,
  });
  return origin(preferred) ?? origin(subdomainUrl) ?? subdomainUrl;
}

/**
 * Absolute canonical URL for a store-relative path.
 *
 * @example storeCanonical(tenant, "/about") // https://acme.example/about
 * @example storeCanonical(tenant, "")       // https://acme.example
 */
export function storeCanonical(
  tenant: TenantUrlData,
  path: string,
  options: StoreCanonicalOptions = {},
): string {
  const override = options.override?.trim();
  if (override && /^https?:\/\//i.test(override)) {
    const overrideOrigin = origin(override);
    if (overrideOrigin) {
      return overrideOrigin + canonicalPath(new URL(override).pathname);
    }
  }

  const base = primaryOrigin(tenant);
  const relative = canonicalPath(override || path);
  if (!relative) return base;

  try {
    // Percent-encodes anything the path picked up from a live product id or an
    // owner-typed slug, so the result is always a URL Next can resolve.
    const url = new URL(relative, base);
    return url.origin + url.pathname.replace(/\/+$/, "");
  } catch {
    return base;
  }
}
