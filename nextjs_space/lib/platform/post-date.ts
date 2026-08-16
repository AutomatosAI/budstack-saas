import { format } from "date-fns";

/**
 * Platform US-009 — the byline date on budstacks.io/blog, in one place.
 *
 * The index and the article used to be guaranteed to agree because both read
 * the SAME pre-formatted `date: "Jan 10, 2026"` string off the inline arrays.
 * Once both format a `publishedAt` themselves, that guarantee is only as good
 * as the two format strings staying identical — so there is one.
 *
 * "MMM d, yyyy" reproduces the shipped wording exactly.
 *
 * Null for a post with no publish date. Drafts are never public, so this is the
 * defensive case rather than the expected one: the caller renders no date line
 * at all rather than the word "Invalid Date", which is what `format` produces
 * for a value it cannot read.
 */
export function formatPostDate(publishedAt: Date | null): string | null {
  if (!publishedAt) return null;

  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return null;

  return format(date, "MMM d, yyyy");
}
