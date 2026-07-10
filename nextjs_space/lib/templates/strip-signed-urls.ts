/**
 * Recursively strips AWS-signed S3 URLs out of any JSON-shaped template or
 * branding config, rewriting them back to a relative object key so the
 * config never persists a signature that expires (lib/storage/s3.ts signs
 * with `expiresIn: 3600` — PRD-220 Part C). Walks objects, arrays, and
 * strings at any depth, so a caller never has to enumerate which key of a
 * given config shape might carry an asset URL.
 */

const SIGNED_QUERY_PARAM = /(?:^|[?&])X-Amz-/i;

// A real URL parse, not a substring match — a raw `.includes(".amazonaws.com/")`
// on the whole string can be spoofed by an unrelated host whose path or query
// happens to contain that text (e.g. `https://evil.com/foo.amazonaws.com/bar`).
function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isAmazonawsHost(hostname: string): boolean {
  return hostname === "amazonaws.com" || hostname.endsWith(".amazonaws.com");
}

function isSignedS3Url(parsed: URL): boolean {
  if (isAmazonawsHost(parsed.hostname)) return true;
  return SIGNED_QUERY_PARAM.test(parsed.search);
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
  if (!value.startsWith("http")) return value;
  const parsed = parseUrl(value);
  if (!parsed || !isSignedS3Url(parsed)) return value;

  // Never keep the query string — that's where the signature/expiry lives.
  // `pathname` is already query-free by construction (real URL parse, not a
  // string split), and independent of hostname/userinfo/port games.
  const fullKey = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));

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
