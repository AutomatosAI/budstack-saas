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
