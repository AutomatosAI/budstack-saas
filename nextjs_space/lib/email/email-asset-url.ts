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

/**
 * Absolutise a stored image reference, which comes in three shapes across the
 * codebase and has to work for all of them:
 *
 *  - an S3 KEY (`development/tenants/{id}/uploads/1712-logo.png`) — what
 *    `uploadFile` returns and what `tenant_branding.logoUrl` actually holds;
 *  - an origin-relative durable path from US-005's `publicUrl`;
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
  if (ABSOLUTE_URL.test(trimmed) || trimmed.startsWith("/")) {
    return absoluteEmailUrl(trimmed, baseUrl);
  }
  if (!publicImageContentType(trimmed)) return null;
  return `${baseUrl}${publicImagePath(trimmed)}`;
}
