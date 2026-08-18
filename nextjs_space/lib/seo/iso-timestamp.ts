/**
 * ISO-8601 timestamps for metadata and JSON-LD, in a module with no
 * dependencies at all.
 *
 * Extracted from `lib/seo/post-metadata.ts` (Platform US-009), which re-exports
 * it so every existing importer keeps its import — the same move `wire-paths.ts`
 * already made out of that file, for a version of the same reason. Formatting a
 * date is the only thing the platform blog needs from it, and `post-metadata`
 * reaches `brandedOgImage` → `pro-features` → `lib/entitlements/features`: the
 * import would drag a TENANT'S entitlement lookup into budstacks.io's own
 * article page, which has no tenant to look up.
 */

/**
 * ISO-8601 timestamp for `article:published_time` and `datePublished`, or
 * undefined when the value is not a real date.
 *
 * Accepts a string as well as a Date: a JSON round trip turns one into the
 * other, and an `Invalid Date` reaching `toISOString()` throws a RangeError —
 * the failure mode that takes render routes down elsewhere in this repo.
 *
 * The Article node and the `article:published_time` tag on the same page must
 * agree, and one parser is how they do.
 */
export function isoTimestamp(value: unknown): string | undefined {
  if (typeof value !== "string" && !(value instanceof Date)) return undefined;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
