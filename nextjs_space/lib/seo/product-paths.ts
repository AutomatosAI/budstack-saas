/**
 * SEO Supercharge US-004 — the storefront URL of a product.
 *
 * THE DEFECT THIS CLOSES: the SEO Manager showed every product's public URL as
 * `{baseUrl}/products/{products.slug}` (app/tenant-admin/seo/seo-page-client.tsx
 * :201 and the editor modal's Google preview at :334) and NO SUCH ROUTE EXISTS.
 * A storefront product page is keyed by the DR GREEN STRAIN ID: the card links
 * `/products/{product.id}` (app/store/[slug]/products/product-card.tsx:59) and
 * the API resolves it as `fetchProducts(...).find(p => p.id === productId)`
 * (app/api/store/[slug]/products/route.ts:53-55). The local row keeps that id in
 * `products.drGreenStrainId` (app/api/tenant-admin/products/sync/route.ts:58);
 * `products.slug` is a name-derived key that exists for the sync upsert's
 * `(slug, tenantId)` unique constraint and is not a route. So every URL the
 * owner previewed — and any they pasted onward — was a 404.
 *
 * ONE helper for both sides, the admin preview and the page's own canonical, so
 * the two cannot disagree again.
 *
 * Deliberately dependency-free: a client component (the SEO Manager) imports it,
 * and the neighbouring `lib/storage/public-image-url` reaches pino through
 * `lib/api-error`, which must not cross into a browser bundle.
 */

import { seoText } from "@/lib/seo/store-identity";

/** The product listing, and the honest fallback for a row with no strain id. */
export const PRODUCTS_INDEX_PATH = "/products";

/**
 * Store-relative path for a product, or the listing when the row has never been
 * synced from Dr Green and therefore has no page of its own.
 *
 * The id is NOT encoded here: this is a path, and the two consumers each finish
 * it their own way — `storeCanonical` percent-encodes when it builds the URL,
 * and the admin renders the string as React-escaped text.
 */
export function productPath(drGreenStrainId: unknown): string {
  const id = seoText(drGreenStrainId);
  return id ? `${PRODUCTS_INDEX_PATH}/${id}` : PRODUCTS_INDEX_PATH;
}
