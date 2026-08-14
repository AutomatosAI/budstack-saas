/**
 * The storefront URL of a Wire post — the pure half of `post-metadata.ts`.
 *
 * SPLIT OUT BY US-021, which needs this path in three places that cannot all
 * import the same module:
 *   - the article page's own canonical and the sitemap (server, unchanged —
 *     they still import it through `post-metadata`, which re-exports it);
 *   - the rename's redirect bookkeeping (`lib/seo/slug-redirects.ts`), which
 *     turns the old and new slugs into the paths a 301 is written between;
 *   - the post editor's live URL preview (`app/tenant-admin/the-wire/
 *     post-form.tsx`), a CLIENT component — and `post-metadata` reaches pino
 *     through `lib/storage/public-image-url` → `lib/api-error`, which must not
 *     cross into a browser bundle.
 *
 * Same shape and same reason as `product-paths.ts` and `condition-paths.ts`:
 * one helper per entity URL, dependency-free, so the admin preview and the
 * page's own canonical cannot drift apart.
 */

/** The Wire's index — also its canonical path. */
export const WIRE_INDEX_PATH = "/the-wire";

/**
 * Store-relative path for one post.
 *
 * The slug is NOT encoded here: this is a path, and each consumer finishes it
 * its own way — `storeCanonical` percent-encodes when it builds the URL, the
 * admin renders it as React-escaped text, and the redirect table normalises it.
 */
export function wirePostPath(slug: string): string {
  return `${WIRE_INDEX_PATH}/${slug}`;
}
