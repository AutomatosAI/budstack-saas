/**
 * Absolute URLs for assets embedded in email HTML (US-010; reused by US-011).
 *
 * US-005 deliberately generates ORIGIN-RELATIVE image URLs
 * (`/api/public/images/<key>`): a storefront runs on its own subdomain under
 * `img-src 'self'` (lib/security/csp.ts), so an absolute apex URL would be
 * CSP-blocked on exactly the pages that render it. An inbox has no origin, so
 * every asset URL that leaves for an email has to be absolutised against the
 * tenant's own base URL — the same host US-003's confirm links and US-004's
 * unsubscribe links are built from.
 *
 * Both helpers fail CLOSED (return null) rather than emit a URL that cannot
 * resolve: a missing image in an email is a cosmetic defect, a broken one is a
 * visible one.
 *
 * Pure: no S3, no DB, no request.
 */

import {
  publicImageContentType,
  publicImagePath,
} from "@/lib/storage/public-image-url";

const ABSOLUTE_URL = /^https?:\/\//i;

/**
 * The query parameter that makes an S3 URL expire.
 *
 * Keyed on the SIGNATURE, not on the hostname — `lib/templates/strip-signed-urls.ts`
 * treats every `*.amazonaws.com` URL as strippable, which is right for a template
 * config (everything in one is ours) but wrong here: an author may legitimately
 * link an unsigned, permanently public S3 image, and rewriting that one to our
 * own `/api/public/images/` route would turn a working image into a 404.
 */
const SIGNED_QUERY_PARAM = /(?:^|&)X-Amz-/i;

/**
 * The S3 key behind a presigned URL, or null if the URL is not one.
 *
 * A presigned link dies after an hour (`lib/storage/s3.ts` signs with
 * `expiresIn: 3600`) — fine for an admin screen, useless in an inbox that may be
 * opened next week. Recovering the key lets the caller re-point the image at
 * US-005's durable route instead. The key keeps the bucket folder prefix, which
 * is what `app/api/public/images/[...key]` expects.
 */
function presignedS3Key(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!SIGNED_QUERY_PARAM.test(parsed.search.replace(/^\?/, ""))) return null;

  const rawKey = parsed.pathname.replace(/^\/+/, "");
  try {
    return decodeURIComponent(rawKey) || null;
  } catch {
    // Malformed percent-encoding — no key we can trust, and the caller fails
    // closed rather than embedding a link that is about to expire.
    return null;
  }
}

/**
 * Absolutise a URL that is already in link form — either absolute already, or
 * origin-relative (`/api/public/images/...`, `/products/x`).
 *
 * Scheme-relative (`//host/path`) resolves against the *page's* scheme, which
 * an email client does not have, and `lib/security/email-sanitize.ts` strips it
 * anyway (`allowProtocolRelative: false`). Anything else — a bare relative
 * path, `data:`, `cid:` — is not something this pipeline produces, so it is
 * dropped rather than guessed at.
 */
export function absoluteEmailUrl(
  url: string | null | undefined,
  baseUrl: string,
): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (ABSOLUTE_URL.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return null;
  if (trimmed.startsWith("/")) return `${baseUrl}${trimmed}`;
  return null;
}

/** US-005's durable route for an S3 key, or null when it is not a served image. */
function durableImageUrl(key: string, baseUrl: string): string | null {
  if (!publicImageContentType(key)) return null;
  return `${baseUrl}${publicImagePath(key)}`;
}

/**
 * Absolutise a stored image reference, which comes in four shapes across the
 * codebase and has to work for all of them:
 *
 *  - an S3 KEY (`development/tenants/{id}/uploads/1712-logo.png`) — what
 *    `uploadFile` returns and what `tenant_branding.logoUrl` actually holds;
 *  - an origin-relative durable path from US-005's `publicUrl`;
 *  - a PRESIGNED S3 URL, which is what every record written before US-005 holds
 *    (`posts.coverImage` among them) — re-pointed at the durable route by its
 *    key, because the signature it carries expires an hour after it was minted;
 *  - an absolute URL (a template default hosted elsewhere).
 *
 * A key whose extension is not on US-005's served-image allow-list (SVG, a PDF)
 * has no durable route, so it resolves to null instead of a guaranteed 404.
 */
export function absoluteEmailImageUrl(
  stored: string | null | undefined,
  baseUrl: string,
): string | null {
  const trimmed = stored?.trim();
  if (!trimmed) return null;

  if (ABSOLUTE_URL.test(trimmed)) {
    // A presigned link is served by its key instead; any other absolute URL is
    // already fetchable from an inbox and is left exactly as the author gave it.
    const key = presignedS3Key(trimmed);
    return key === null
      ? absoluteEmailUrl(trimmed, baseUrl)
      : durableImageUrl(key, baseUrl);
  }
  if (trimmed.startsWith("/")) return absoluteEmailUrl(trimmed, baseUrl);
  return durableImageUrl(trimmed, baseUrl);
}
