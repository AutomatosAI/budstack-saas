/**
 * The public URL of a budstacks.io blog post — the platform's counterpart to
 * `wire-paths.ts` (which does the same job for a tenant storefront's Wire).
 *
 * Same shape and same reason as `wire-paths.ts`, `product-paths.ts` and
 * `condition-paths.ts`: one dependency-free helper per entity URL, so the
 * admin's preview, the page's own canonical and the sitemap entry cannot drift
 * apart. Dependency-free matters here too — the platform post editor is a
 * CLIENT component, so nothing in this module may reach Prisma, pino or
 * `next/server`.
 *
 * `/blog` is already the path in `app/sitemap.ts:47` and in the marketing nav
 * and footer; this states it once so the stories that follow (the database-backed
 * index, the sitemap entries, the canonicals and the JSON-LD) all read the same
 * value rather than each repeating the literal.
 */

/** The blog's index — also its canonical path. */
export const BLOG_INDEX_PATH = "/blog";

/**
 * Site-relative path for one post.
 *
 * The slug is NOT encoded here: this is a path, and each consumer finishes it
 * its own way — a canonical percent-encodes when it builds the absolute URL,
 * and the admin renders it as React-escaped text.
 */
export function blogPostPath(slug: string): string {
  return `${BLOG_INDEX_PATH}/${slug}`;
}
