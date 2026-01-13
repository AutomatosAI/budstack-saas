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
 * Uses path-based routing: budstack.to/store/{slug}
 *
 * @example
 * ```tsx
 * const url = getTenantUrl({ subdomain: 'healing-buds', customDomain: null });
 * // Returns: https://budstack.to/store/healing-buds
 * ```
 */
export function getTenantUrl(tenant: TenantUrlData): string {
  // If custom domain is configured, use it
  if (tenant.customDomain) {
    return `https://${tenant.customDomain}`;
  }

  // Use path-based routing (primary method until subdomain DNS is configured)
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || "budstack.to";
  return `https://${baseDomain}/store/${tenant.subdomain}`;
}
