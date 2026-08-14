/**
 * SEO Supercharge US-005 — the storefront URL of a condition page.
 *
 * ONE helper for both sides — the SEO Manager's preview URL and the page's own
 * canonical — so they cannot drift the way the product URLs had (US-004 found
 * the admin previewing `/products/{slug}`, a 404 for every product).
 *
 * WHAT KEYS A CONDITION URL: the route segment is named `[id]`
 * (app/store/[slug]/conditions/[id]/page.tsx) but it carries the condition
 * SLUG — the listing links `conditions/{condition.slug}`
 * (conditions-client.tsx:342) and the detail API resolves it against the
 * `(tenantId, slug)` unique (app/api/tenant/conditions/[slug]/route.ts:32-39).
 * `conditions.id` is the admin-side key only; it appears in no URL.
 *
 * The index path is read from `STORE_SEO_PAGES` rather than restated, so the
 * conditions list page (authorable since US-002) and its children stay on one
 * path even if that list is renamed.
 *
 * Deliberately dependency-free, like `product-paths.ts`: a client component (the
 * SEO Manager) imports it, and the neighbouring `lib/storage/public-image-url`
 * reaches pino through `lib/api-error`, which must not enter a browser bundle.
 */

import { seoText } from "@/lib/seo/store-identity";
import { storeSeoPage } from "@/lib/seo/store-pages";

/** The conditions listing, and the honest fallback for a row with no slug. */
export const CONDITIONS_INDEX_PATH = storeSeoPage("conditions").path;

/**
 * Store-relative path for one condition, or the listing when the row carries no
 * usable slug and therefore has no page of its own.
 *
 * The slug is NOT encoded here: this is a path, and each consumer finishes it
 * its own way — `storeCanonical` percent-encodes when it builds the URL, and the
 * admin renders the string as React-escaped text.
 */
export function conditionPath(slug: unknown): string {
  const value = seoText(slug);
  return value ? `${CONDITIONS_INDEX_PATH}/${value}` : CONDITIONS_INDEX_PATH;
}
