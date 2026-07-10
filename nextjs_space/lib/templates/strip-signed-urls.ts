/**
 * Recursively strips AWS-signed S3 URLs out of any JSON-shaped template or
 * branding config, rewriting them back to a relative object key so the
 * config never persists a signature that expires (lib/storage/s3.ts signs
 * with `expiresIn: 3600` — PRD-220 Part C). Walks objects, arrays, and
 * strings at any depth, so a caller never has to enumerate which key of a
 * given config shape might carry an asset URL.
 */

const SIGNED_QUERY_PARAM = /(?:^|[?&])X-Amz-/i;

function isSignedS3Url(value: string): boolean {
  if (!value.startsWith("http")) return false;
  if (value.includes(".amazonaws.com/")) return true;
  const queryIndex = value.indexOf("?");
  return queryIndex !== -1 && SIGNED_QUERY_PARAM.test(value.slice(queryIndex));
}

function relativizeKey(fullKey: string, prefixes: readonly string[]): string {
  for (const prefix of prefixes) {
    const idx = fullKey.indexOf(prefix);
    if (idx !== -1) {
      const relativePath = fullKey.slice(idx + prefix.length + 1);
      if (relativePath && !relativePath.includes("//")) return relativePath;
    }
  }
  return fullKey;
}

function stripSignedUrl(value: string, prefixes: readonly string[]): string {
  if (!isSignedS3Url(value)) return value;

  // Never keep the query string — that's where the signature/expiry lives.
  const urlWithoutQuery = value.split("?")[0];
  const amazonawsMatch = urlWithoutQuery.match(/\.amazonaws\.com\/(.+)$/);
  const fullKey = amazonawsMatch
    ? decodeURIComponent(amazonawsMatch[1])
    : decodeURIComponent(urlWithoutQuery.replace(/^https?:\/\/[^/]+\//, ""));

  return relativizeKey(fullKey, prefixes);
}

/**
 * Walk `value` (object, array, or string, at any depth) and rewrite any
 * signed S3 URL found back to its relative key. Non-string, non-container
 * values (numbers, booleans, null, undefined) pass through untouched.
 *
 * `prefixes` are tried in order against the decoded S3 key — first match
 * wins. If none match, the full decoded key is kept (still safe: it's a
 * relative-looking S3 key, never a query string with a signature).
 */
export function stripSignedUrls<T>(value: T, prefixes: readonly string[] = []): T {
  if (typeof value === "string") {
    return stripSignedUrl(value, prefixes) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripSignedUrls(item, prefixes)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      result[key] = stripSignedUrls(v, prefixes);
    }
    return result as T;
  }
  return value;
}
