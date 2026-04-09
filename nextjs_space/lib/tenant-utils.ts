/**
 * Client-safe tenant utility functions.
 * These functions can be safely imported in client components.
 *
 * For server-only tenant functions (getCurrentTenant, etc.), use lib/tenant.ts
 */

/**
 * Tenant data shape (minimal for URL generation)
 */
export interface TenantUrlData {
  subdomain: string;
  customDomain: string | null;
}

/**
 * Get tenant URL for display purposes
 * Uses subdomain routing in production: {subdomain}.budstacks.io
 * Uses path-based routing in development: /store/{subdomain}
 *
 * @example
 * ```tsx
 * // Development:
 * getTenantUrl({ subdomain: 'healing-buds', customDomain: null }) // -> /store/healing-buds
 *
 * // Production:
 * getTenantUrl({ subdomain: 'healing-buds', customDomain: null }) // -> https://healing-buds.budstacks.io
 *
 * // Custom Domain:
 * getTenantUrl({ subdomain: 'healing-buds', customDomain: 'example.com' }) // -> https://example.com
 * ```
 */
/**
 * Get the base path prefix for tenant navigation links.
 * In dev: /store/{slug} (path-based routing)
 * In prod: '' (subdomain routing, middleware handles it)
 */
export function getTenantBasePath(slugOrTenant: string | TenantUrlData): string {
  if (process.env.NODE_ENV === 'development') {
    const slug = typeof slugOrTenant === 'string' ? slugOrTenant : slugOrTenant.subdomain;
    return `/store/${slug}`;
  }
  return '';
}

/**
 * Prefix a relative href with the tenant base path.
 * Skips hrefs that already have /store/ prefix or are absolute URLs.
 */
export function prefixTenantHref(href: string, basePath: string): string {
  if (href.startsWith('/store/') || href.startsWith('http')) return href;
  if (href === '/' || href === '') return basePath || '/';
  if (href.startsWith('/')) return `${basePath}${href}`;
  return href;
}

/**
 * Canonical base URL for a tenant — the single source of truth for
 * generating tenant-facing URLs (SEO, emails, sitemap, robots.txt, OG tags).
 *
 * Returns `https://{customDomain}` when set, otherwise
 * `https://{subdomain}.{baseDomain}`.
 *
 * Unlike getTenantUrl(), this ALWAYS returns an absolute URL (never a
 * path-based fallback) — use it wherever you need a full public URL.
 */
export function getTenantBaseUrl(tenant: TenantUrlData): string {
  if (tenant.customDomain) {
    return `https://${tenant.customDomain}`;
  }
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'budstacks.io';
  return `https://${tenant.subdomain}.${baseDomain}`;
}

export function getTenantUrl(tenant: TenantUrlData): string {
  // If custom domain is configured, use it
  if (tenant.customDomain) {
    return `https://${tenant.customDomain}`;
  }

  // Use path-based routing for development to avoid local DNS issues
  if (process.env.NODE_ENV === 'development') {
    return `/store/${tenant.subdomain}`;
  }

  // Use subdomain-based routing for production
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || "budstacks.io";
  return `https://${tenant.subdomain}.${baseDomain}`;
}
