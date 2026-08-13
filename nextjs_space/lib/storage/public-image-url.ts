import {
  isKeyInTenantScope,
  normaliseTenantScopedKey,
} from "@/lib/storage/s3-tenant-guard";

/**
 * Email Phase 2 US-005 — durable public image URLs.
 *
 * An uploaded image used to be reachable only through a presigned S3 URL that
 * dies after an hour, so blog covers (and, from US-011 on, every image inside a
 * campaign) broke the moment the signature expired. The durable replacement is
 * `/api/public/images/<s3 key>`, streamed straight from S3 by the route of the
 * same name with an immutable cache header.
 *
 * The generated URL is deliberately ORIGIN-RELATIVE. A storefront runs on its
 * own subdomain or custom domain under `img-src 'self'` (lib/security/csp.ts),
 * so an absolute apex URL would be blocked by CSP on exactly the pages that
 * need to render it. Anything that needs an absolute URL — email HTML,
 * OpenGraph tags — must prefix the origin it is rendering for.
 *
 * This module is pure: no AWS, no DB, no request. The route supplies the bucket
 * folder prefix so the parsing stays testable.
 */

export const PUBLIC_IMAGE_ROUTE_PREFIX = "/api/public/images/";

/**
 * Extension → the Content-Type we serve. This map IS the allow-list.
 *
 * SVG is absent on purpose: it is XML and can carry inline script, which is the
 * same reason lib/storage/upload-validation.ts refuses to accept it. Serving
 * one from our own origin would be stored XSS on every storefront.
 */
const PUBLIC_IMAGE_TYPES_BY_EXTENSION: Readonly<Record<string, string>> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

const SERVABLE_CONTENT_TYPES: ReadonlySet<string> = new Set(
  Object.values(PUBLIC_IMAGE_TYPES_BY_EXTENSION),
);

/** Only keys under `tenants/{tenantId}/uploads/` are publicly servable. */
const TENANT_UPLOAD_KEY = /^tenants\/([^/]+)\/uploads\/(.+)$/;

/** The Content-Type for a key's extension, or null if it is not a served image. */
export function publicImageContentType(key: string): string | null {
  const ext = key.match(/\.[A-Za-z0-9]+$/)?.[0]?.toLowerCase();
  return (ext ? PUBLIC_IMAGE_TYPES_BY_EXTENSION[ext] : undefined) ?? null;
}

/** True when a stored S3 Content-Type is one we are willing to hand back. */
export function isServablePublicImageType(contentType: string): boolean {
  return SERVABLE_CONTENT_TYPES.has(
    contentType.split(";")[0].trim().toLowerCase(),
  );
}

/**
 * Durable, origin-relative URL for an uploaded image key. Each segment is
 * percent-encoded so the route decodes it back to the exact key — filenames
 * containing `%`, `#` or `?` survive the round trip.
 */
export function publicImagePath(key: string): string {
  return (
    PUBLIC_IMAGE_ROUTE_PREFIX +
    key.split("/").map(encodeURIComponent).join("/")
  );
}

export interface PublicImageRequest {
  /** Exact S3 key to fetch — cleaned, but with the bucket prefix preserved. */
  readonly s3Key: string;
  /** The same key with the bucket folder prefix stripped. */
  readonly relativeKey: string;
  /** Owning tenant, read out of the key itself. */
  readonly tenantId: string;
  /** Content-Type to serve, derived from the extension — never from S3. */
  readonly contentType: string;
}

/**
 * Resolve an untrusted request path into the object we are allowed to serve,
 * or null if it is anything else. Null covers every rejection — traversal,
 * bad encoding, a non-upload prefix, a non-image extension — because the route
 * answers all of them with the same 404.
 *
 * `rawKeyPath` must still be percent-ENCODED: normaliseTenantScopedKey decodes
 * exactly once, which is what catches `..%2F` style escapes.
 */
export function parsePublicImageRequest(
  rawKeyPath: string,
  folderPrefix?: string,
): PublicImageRequest | null {
  // Cleaned twice from the same input: once keeping the bucket prefix (what S3
  // is asked for) and once without it (what the tenant-scope rules apply to).
  const s3Key = normaliseTenantScopedKey(rawKeyPath);
  const relativeKey = normaliseTenantScopedKey(rawKeyPath, folderPrefix);
  if (s3Key === null || relativeKey === null) return null;

  const match = relativeKey.match(TENANT_UPLOAD_KEY);
  if (!match) return null;
  const tenantId = match[1];

  // Defence in depth: the shape is already proved above, but the guard is what
  // decides cross-tenant S3 access everywhere else (lib/storage/s3.ts), so it
  // decides here too — one place to change if those rules ever tighten. It gets
  // the RAW path, which is its contract: it decodes once itself, and handing it
  // the decoded key would decode twice and reject any filename holding a `%`.
  if (!isKeyInTenantScope(rawKeyPath, tenantId, { folderPrefix })) return null;

  const contentType = publicImageContentType(relativeKey);
  if (!contentType) return null;

  return { s3Key, relativeKey, tenantId, contentType };
}
