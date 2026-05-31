// PRD-205 AC-2a — the single host→tenant-hint mapping shared by middleware.ts
// and the canonical resolver (lib/tenant-resolver.ts), so the two cannot drift.
// Pure: no DB, no headers(), no ALS — safe to import from Edge middleware.

const DEFAULT_BASE_DOMAIN = "budstacks.io";

export type TenantHostHint =
  | { kind: "subdomain"; subdomain: string }
  | { kind: "customDomain"; host: string }
  | null;

/**
 * Map a request host to a tenant hint.
 *  - strips a trailing :port
 *  - localhost / 127.0.0.1   → null (path-based routing handles dev)
 *  - www.<anything>          → null (marketing apex, no tenant)
 *  - the base domain itself  → null (the platform, not a tenant)
 *  - slug.<baseDomain>       → { kind: 'subdomain', subdomain: 'slug' }
 *  - any other host          → { kind: 'customDomain', host }
 *
 * Behaviour preserved from the prior middleware.ts (:50-100) and
 * getTenantFromRequest host parsing; only deduplicated here. The dev-only
 * `.abacusai.app` preview carve-out stays in middleware (deploy-specific, not
 * part of the host→tenant mapping).
 */
export function parseHostToTenantHint(
  rawHost: string | null | undefined,
  baseDomain: string = process.env.NEXT_PUBLIC_BASE_DOMAIN || DEFAULT_BASE_DOMAIN,
): TenantHostHint {
  if (!rawHost) return null;

  const host = rawHost.replace(/:\d+$/, "");
  if (!host) return null;

  if (host.includes("localhost") || host.includes("127.0.0.1")) return null;
  if (host.startsWith("www.")) return null;
  if (host === baseDomain) return null;

  const suffix = `.${baseDomain}`;
  if (host.endsWith(suffix)) {
    const subdomain = host.slice(0, host.length - suffix.length);
    if (!subdomain) return null;
    return { kind: "subdomain", subdomain };
  }

  return { kind: "customDomain", host };
}
