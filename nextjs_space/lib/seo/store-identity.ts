/**
 * SEO Supercharge — the primitives every piece of store metadata shares: how to
 * read an untrusted string, what to call the store, how long a description may
 * be, and what locale it publishes in.
 *
 * Extracted from `store-metadata.ts` (US-001) when US-002 gave individual pages
 * their own metadata: the layout-level defaults and the page-level overrides
 * must agree on the store's display name, or `og:site_name` changes as a visitor
 * clicks from /about to the homepage.
 */

/**
 * og:locale. The platform is English-only today (`<html lang="en">` in
 * app/layout.tsx) and this preserves the value stores already inherited; it
 * becomes per-tenant when the storefront gains real localisation.
 */
export const STORE_OG_LOCALE = "en_US";

/**
 * Trimmed string, or "" for anything that is not one.
 *
 * Every caller in `lib/seo/` is reading a value that arrives either from a Json
 * column or through the any-widened `prisma` export (lib/db.ts), so the runtime
 * type is genuinely unknown no matter what the signature claims.
 */
export function seoText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * What to call this store in a title, an og:site_name or a byline — "" when the
 * tenant row carries neither name, which the caller resolves to its own last
 * resort (a blank <title> is no better than the platform's).
 *
 * The subdomain is the fallback because it is the tenant's other public
 * identity: it is required, unique, and already visible in the URL bar.
 */
export function storeDisplayName(
  businessName: unknown,
  subdomain: unknown,
): string {
  return seoText(businessName) || seoText(subdomain);
}

/**
 * How long a `<meta name="description">` may be before a search result clips it
 * mid-word. 160 is the width Google has truncated around for years; the point is
 * not the exact number but that WE choose where the sentence ends rather than
 * letting the SERP cut it.
 *
 * Only DERIVED descriptions are truncated. An owner-authored one is rendered as
 * typed — the SEO Manager shows them a preview of that exact string, and the
 * write route already caps it (z.string().max(1000)).
 */
export const SEO_DESCRIPTION_MAX_LENGTH = 160;

/**
 * A description derived from body copy: whitespace collapsed to single spaces
 * (product and condition text arrives with newlines, which render as literal
 * gaps inside a meta tag) and clipped to `maxLength` INCLUDING the ellipsis, at
 * a word boundary where there is one.
 *
 * "" for anything that is not a usable string, so callers keep using `||` to
 * reach their own default.
 */
export function truncateSeoText(
  value: unknown,
  maxLength: number = SEO_DESCRIPTION_MAX_LENGTH,
): string {
  const text = seoText(value).replace(/\s+/g, " ");
  if (text.length <= maxLength) return text;

  // The ellipsis is inside the budget, so the result never EXCEEDS maxLength.
  const clipped = text.slice(0, Math.max(maxLength - 1, 0));
  const lastSpace = clipped.lastIndexOf(" ");
  // A first word longer than the budget has no space to break on — hard-cut it
  // rather than return a bare ellipsis.
  const body = lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped;

  return `${body.trimEnd()}…`;
}
