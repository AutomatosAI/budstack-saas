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

/**
 * Absolute canonical URL for a platform-relative path — `storeCanonical`'s
 * counterpart for budstacks.io (Platform US-009).
 *
 * Percent-encodes for the same reason `storeCanonical` does: the path is
 * assembled from an author-typed slug, and a canonical a crawler cannot resolve
 * is worse than none. `new URL` is what does the encoding, so its failure is
 * caught rather than thrown into `generateMetadata`, which has no error
 * boundary above it.
 *
 * A trailing slash is stripped so `/blog` and `/blog/` cannot be declared as
 * two canonicals for one page; an empty path yields the bare origin.
 *
 * @example platformCanonical("/blog/a-post") // https://budstacks.io/blog/a-post
 * @example platformCanonical("")             // https://budstacks.io
 */
export function platformCanonical(path: string): string {
  const base = platformBaseUrl();

  // Collapsed to exactly ONE leading slash. `//example.com/x` is a
  // protocol-relative URL to `new URL`, not a path — left as-is it resolves to
  // a different origin entirely, and this function would then declare one of
  // budstacks.io's pages canonical at somebody else's address.
  const relative = path.trim().replace(/^\/*/, "/");
  if (relative === "/") return base;

  try {
    const url = new URL(relative, base);
    return url.origin + url.pathname.replace(/\/+$/, "");
  } catch {
    return base;
  }
}

/**
 * Absolute URL for a stored asset reference — an og:image, principally.
 *
 * THE PLATFORM ROOT LAYOUT DECLARES NO `metadataBase` (app/layout.tsx), unlike
 * every store layout (`storeMetadataBase`, lib/seo/store-metadata.ts:155). Next
 * absolutises a relative `openGraph.images` entry against that base, and with
 * none set it falls back to localhost — so a relative og:image on a platform
 * page ships a tag pointing at a host no crawler can reach. Absolutising here
 * is what makes the tag true, and it is done to the ASSET rather than by
 * declaring a metadataBase because the canonical above already resolves itself.
 *
 * Separate from {@link platformCanonical} because the inputs differ: a canonical
 * is always one of OUR paths, whereas a cover image may legitimately be an
 * absolute URL on somebody else's CDN, which must be handed back untouched
 * rather than mangled into `/https://…`.
 *
 * Returns null for anything that cannot be resolved, so the caller falls back
 * to the platform default rather than emitting a broken tag.
 *
 * @example platformAbsoluteUrl("/x.png")           // https://budstacks.io/x.png
 * @example platformAbsoluteUrl("https://cdn/x.png") // unchanged
 */
export function platformAbsoluteUrl(
  ref: string | null | undefined,
): string | null {
  const trimmed = ref?.trim();
  if (!trimmed) return null;

  // Already absolute and on whatever host the author chose.
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  // Protocol-relative resolves against the page's scheme, which a crawler
  // fetching metadata out of band may not have — dropped, not guessed at. Any
  // other non-rooted value is not a path this origin can serve.
  if (trimmed.startsWith("//") || !trimmed.startsWith("/")) return null;

  try {
    return new URL(trimmed, platformBaseUrl()).toString();
  } catch {
    return null;
  }
}
