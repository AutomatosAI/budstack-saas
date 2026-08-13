/**
 * SEO Supercharge — the two things every piece of store metadata needs to know:
 * what to call the store, and what locale it publishes in.
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
