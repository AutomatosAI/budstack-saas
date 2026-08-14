// PRD-205 AC-2a — the single host→tenant-hint mapping shared by middleware.ts
// and the canonical resolver (lib/tenant-resolver.ts), so the two cannot drift.
// Pure: no DB, no headers(), no ALS — safe to import from Edge middleware.

const DEFAULT_BASE_DOMAIN = "budstacks.io";
const WWW_PREFIX = "www.";

export type TenantHostHint =
  | { kind: "subdomain"; subdomain: string }
  | { kind: "customDomain"; host: string }
  | null;

/** Drop a trailing :port — the Host header carries one in dev and on Railway. */
function withoutPort(rawHost: string): string {
  return rawHost.replace(/:\d+$/, "");
}

/** Path-based routing handles dev; no host here maps to a tenant. */
function isLocalHost(host: string): boolean {
  return host.includes("localhost") || host.includes("127.0.0.1");
}

/**
 * SEO US-008 — the host a `www.` request must be 301'd to, or null when there
 * is nothing to redirect.
 *
 * `www.` is always the apex under another name:
 *   www.example.com        → example.com         (a tenant's custom domain)
 *   www.acme.budstacks.io  → acme.budstacks.io   (a tenant's subdomain)
 *   www.budstacks.io       → budstacks.io        (the platform apex — `www` is
 *                                                 in RESERVED_SUBDOMAINS, so it
 *                                                 can never be a tenant)
 *
 * middleware.ts applies this BEFORE tenant resolution, so a www request lands
 * on the store (or the platform apex) instead of falling through to the
 * platform's own routes — the black hole this replaced, which served every
 * tenant's www visitors the BudStacks marketing page.
 *
 * Returns null for non-www hosts, for local dev (`www.localhost:3000`) and for
 * any host with no routable remainder (`www.`, `www.local`), so callers just
 * carry on with the host they were given.
 *
 * OPS DEPENDENCY: the redirect is only reachable if the www hostname is itself
 * provisioned in Cloudflare for SaaS alongside the apex. An unprovisioned www
 * has no certificate and never reaches this app at all.
 */
export function wwwRedirectHost(rawHost: string | null | undefined): string | null {
  if (!rawHost) return null;

  const host = withoutPort(rawHost);
  if (!host.toLowerCase().startsWith(WWW_PREFIX)) return null;
  if (isLocalHost(host)) return null;

  const apexHost = host.slice(WWW_PREFIX.length);
  // A routable apex needs at least one more label — "www." and "www.local" do not.
  return apexHost.includes(".") ? apexHost : null;
}

/**
 * Map a request host to a tenant hint.
 *  - strips a trailing :port
 *  - localhost / 127.0.0.1   → null (path-based routing handles dev)
 *  - www.<x>                 → whatever <x> maps to (SEO US-008)
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

  const rawHostWithoutPort = withoutPort(rawHost);
  if (!rawHostWithoutPort) return null;

  if (isLocalHost(rawHostWithoutPort)) return null;

  // SEO US-008: `www.<x>` now classifies as `<x>` instead of the null that
  // black-holed every www request onto the platform's own routes. middleware.ts
  // 301s www away before this runs; classifying it identically keeps the other
  // callers (tenant-resolver's byHost, storefrontUrl) pointed at the same tenant
  // the redirect lands on. A www host with no routable apex stays null.
  const host = rawHostWithoutPort.toLowerCase().startsWith(WWW_PREFIX)
    ? wwwRedirectHost(rawHostWithoutPort)
    : rawHostWithoutPort;
  if (!host) return null;

  if (host === baseDomain) return null;

  const suffix = `.${baseDomain}`;
  if (host.endsWith(suffix)) {
    const subdomain = host.slice(0, host.length - suffix.length);
    if (!subdomain) return null;
    return { kind: "subdomain", subdomain };
  }

  return { kind: "customDomain", host };
}
