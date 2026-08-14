/**
 * SEO Supercharge US-021 — the one place a Wire post's slug is shaped.
 *
 * `slugifyPostTitle` is the function that was COPIED into both post write
 * routes (app/api/tenant-admin/posts/route.ts:11-19 and .../[id]/route.ts
 * :11-19, character-identical). It is moved here rather than left doubled
 * because this story adds a third caller — the editor's own validation — and a
 * slug rule that disagrees with itself is a URL the owner did not ask for.
 *
 * Pure and dependency-free: `post-form.tsx` is a client component, so nothing
 * here may reach Prisma, pino or `next/server`.
 *
 * WHY THE SERVER COERCES WHERE THE FORM REJECTS. The form validates against
 * `POST_SLUG_PATTERN` and says what is wrong, because silently rewriting what
 * someone typed into a URL box is how a slug ends up somewhere they did not
 * choose. The server runs `normalizePostSlug` — the same transformation as a
 * title-derived slug — because an API caller is not looking at the form, and a
 * refused save is worse than a canonicalised one.
 *
 * IDEMPOTENCE IS LOAD-BEARING. `normalizePostSlug` must be a no-op on any slug
 * `slugifyPostTitle` has ever produced, including the legacy shapes it emits
 * (`_` survives `\w`; a leading `-` survives a title that started with
 * punctuation). The editor posts the slug back on EVERY save, so a normaliser
 * that "tidied" those would rename the post — and, on Pro, write a 301 — for
 * someone who only fixed a typo in the body.
 */

/**
 * Long enough for any real headline-derived slug (`slugifyPostTitle` of a
 * 300-character title, the column's own limit, cannot exceed it), short enough
 * that the value stays a URL segment rather than a payload.
 */
export const POST_SLUG_MAX_LENGTH = 200;

/**
 * What the editor accepts without complaint.
 *
 * Deliberately WIDER than what `slugifyPostTitle` produces from a typical
 * title: it has to accept every slug already in the table, since the form loads
 * one and posts it straight back. Lower-case only — the storefront route match
 * and the redirect table's `fromPath` key are both lower-cased, so an
 * upper-case slug is a URL that only works by accident.
 */
export const POST_SLUG_PATTERN = /^[a-z0-9_-]+$/;

/** The rule, in the words shown under the field and in the API's 400. */
export const POST_SLUG_HINT =
  "Use lower-case letters, numbers and hyphens only — no spaces.";

/**
 * The slug a title implies. Moved verbatim from the two write routes; the
 * comments are theirs.
 */
export function slugifyPostTitle(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-"); // Replace multiple - with single -
}

/**
 * Canonicalise a slug an owner (or an API caller) supplied, or null when
 * nothing usable survives — a slug of punctuation alone would otherwise become
 * an empty segment, i.e. the Wire index wearing an article's URL.
 */
export function normalizePostSlug(raw: unknown): string | null {
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > POST_SLUG_MAX_LENGTH) return null;

  return slugifyPostTitle(trimmed) || null;
}
