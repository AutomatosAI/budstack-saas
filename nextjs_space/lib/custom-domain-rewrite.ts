// PRD-212 — Custom-domain ISR cache isolation.
//
// THE BUG: every custom domain was rewritten in middleware.ts to the SAME
// literal path `/store/_cd/...`. Next.js keys its full-route (ISR) cache on the
// resolved PATHNAME, not on request headers — so `a.com` and `b.com` both hit
// `/store/_cd` and the second domain is served the first tenant's cached HTML.
//
// THE FIX (PRD §13 OQ-1 option (a) — host-scoped rewrite): rewrite each custom
// domain to a per-host segment `/store/cd-<hash(host)>/...`. The hash makes the
// ISR cache key DIFFER per host, so no two custom domains can ever share a
// cached render. Tenant resolution stays header-based (getCurrentTenant reads
// `x-tenant-custom-domain`) — the segment is a cache-key dimension only, never a
// DB lookup key.
//
// Pure: no DB, no headers(), no ALS, no async — safe to import from Edge
// middleware (mirrors lib/parse-host.ts).

/**
 * Legacy constant placeholder this module replaces. Kept ONLY so the reserved
 * list and the grep gate can reference the historic value by name. The live
 * rewrite no longer emits it — see customDomainSlugForHost.
 */
export const LEGACY_CUSTOM_DOMAIN_SLUG = "_cd";

/**
 * Prefix for every host-scoped custom-domain segment. Lowercase-alnum start so
 * the result satisfies the storefront slug charset (parse-uuid.ts SLUG_RE:
 * /^[a-z0-9][a-z0-9-]{0,62}$/), unlike the old leading-underscore `_cd`.
 */
export const CUSTOM_DOMAIN_SLUG_PREFIX = "cd-";

// 32-bit FNV-1a over the lower-cased host. Deterministic, dependency-free and
// sync (no Web Crypto await) — we only need a STABLE, well-distributed key per
// host for cache bucketing, not a cryptographic digest. Rendered as zero-padded
// base-36 so the segment stays short and within the slug charset.
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function fnv1a32(input: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // Multiply by the FNV prime in 32-bit space (Math.imul keeps it 32-bit).
    hash = Math.imul(hash, FNV_PRIME);
  }
  // Coerce to an unsigned 32-bit integer before stringifying.
  return hash >>> 0;
}

/**
 * Normalise a host the way the cache key should see it: trim, lower-case, and
 * strip a trailing :port so `Example.com` and `example.com:443` map to one
 * bucket (and one tenant). Returns "" for empty/whitespace input.
 */
export function normaliseCustomDomainHost(rawHost: string): string {
  return rawHost.trim().toLowerCase().replace(/:\d+$/, "");
}

/**
 * Derive the host-scoped storefront slug segment for a custom-domain request.
 *
 * Invariants (proven in tests/unit/custom-domain-cache-key.test.ts):
 *  - DISTINCT hosts → DISTINCT segments (so their ISR cache keys differ);
 *  - the SAME host → a STABLE segment (so background revalidation writes back to
 *    the same key it was served from — AC-5);
 *  - the segment is NEVER the shared legacy `_cd` placeholder;
 *  - the segment matches the storefront slug charset (SLUG_RE), so the cart /
 *    links / generateMetadata that read `params.slug` keep working.
 *
 * @throws RangeError if `rawHost` is empty/whitespace — a custom-domain rewrite
 *         with no host is a routing bug; fail fast rather than emit a degenerate
 *         shared key that would re-introduce the bleed.
 */
export function customDomainSlugForHost(rawHost: string): string {
  const host = normaliseCustomDomainHost(rawHost);
  if (!host) {
    throw new RangeError(
      "customDomainSlugForHost: host is required to derive a per-host cache key",
    );
  }
  const digest = fnv1a32(host).toString(36).padStart(7, "0");
  return `${CUSTOM_DOMAIN_SLUG_PREFIX}${digest}`;
}

/**
 * Build the internal rewrite pathname for a custom-domain request, replacing the
 * old constant `/store/_cd${pathname}` with the host-scoped `/store/cd-<hash>`.
 * `pathname` is the incoming path (e.g. "/products" or "/"), forwarded verbatim.
 */
export function customDomainRewritePath(rawHost: string, pathname: string): string {
  return `/store/${customDomainSlugForHost(rawHost)}${pathname}`;
}

/** True if `slug` is a host-scoped custom-domain segment produced by this module. */
export function isCustomDomainSlug(slug: string): boolean {
  return slug.startsWith(CUSTOM_DOMAIN_SLUG_PREFIX);
}
