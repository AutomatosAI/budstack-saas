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

/** A tenant's own uploads — `tenants/{tenantId}/uploads/`. */
const TENANT_UPLOAD_KEY = /^tenants\/([^/]+)\/uploads\/(.+)$/;

/**
 * The platform's own uploads (Platform US-005). budstacks.io is not a tenant,
 * so a blog cover written by `app/api/platform/upload` lives under its own
 * top-level prefix instead of borrowing a tenant id it does not have.
 *
 * Exported so the route builds its S3 prefix from the same constant that
 * decides what is servable — the two cannot drift into a stored `publicUrl`
 * that 404s.
 *
 * Note the `uploads/` segment: the platform branding keys written by
 * `app/api/super-admin/platform-settings` do not land under it and stay
 * private, reachable only through a presigned URL as they are today.
 */
export const PLATFORM_UPLOAD_PREFIX = "platform/";
const PLATFORM_UPLOAD_KEY = /^platform\/uploads\/.+$/;

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

/**
 * A stored reference that already carries an expiring S3 signature. Keyed on the
 * signature rather than the hostname, for the same reason
 * `lib/email/email-asset-url.ts` is: an unsigned S3 URL an author pasted in is a
 * perfectly durable link and must survive untouched.
 */
const SIGNED_S3_QUERY = /[?&]X-Amz-/i;

/**
 * The key shapes `parsePublicImageRequest` above will serve. Matched loosely
 * (anywhere in the key) because a stored key keeps the bucket folder prefix —
 * `development/tenants/{id}/uploads/…` — which is configuration this pure
 * module has no way to know.
 */
const SERVABLE_UPLOAD_SEGMENT =
  /(?:^|\/)(?:tenants\/[^/]+|platform)\/uploads\/.+/;

/**
 * Durable, origin-relative URL for an image reference as it is actually STORED
 * — or null when there is no URL we can promise will still resolve.
 *
 * Stored references come in four shapes across the schema (the same four
 * `absoluteEmailImageUrl` documents): a bare S3 key from `uploadFile`, an
 * origin-relative path, an absolute URL, or a presigned S3 URL left over from
 * before Email US-005. This is the resolver for the ones that end up in
 * RENDERED METADATA — `<link rel="icon">`, `og:image` — where a URL that expires
 * an hour after it was minted is worse than no URL at all: the tag looks correct
 * and breaks silently. So it fails CLOSED and lets the caller fall back to a
 * platform default.
 *
 * Origin-relative for the reason `publicImagePath` is: a storefront runs under
 * `img-src 'self'`, so an absolute apex URL is CSP-blocked on the very pages
 * that need it.
 */
export function storedPublicImagePath(
  stored: string | null | undefined,
): string | null {
  const trimmed = stored?.trim();
  if (!trimmed) return null;

  // Protocol-relative — resolves against the page's scheme, which a crawler
  // fetching metadata out of band may not have. Dropped rather than guessed at.
  if (trimmed.startsWith("//")) return null;

  // Already a path on this origin: a /public asset, or this route.
  if (trimmed.startsWith("/")) return trimmed;

  if (/^https?:\/\//i.test(trimmed)) {
    return SIGNED_S3_QUERY.test(trimmed) ? null : trimmed;
  }

  // A bare S3 key. Only a tenant or platform upload with a served extension has
  // a route — a template asset key (`tenants/{id}/templates/…/favicon.png`) or
  // an SVG would resolve to a guaranteed 404 from the route above.
  if (!SERVABLE_UPLOAD_SEGMENT.test(trimmed)) return null;
  return publicImageContentType(trimmed) ? publicImagePath(trimmed) : null;
}

export interface PublicImageRequest {
  /** Exact S3 key to fetch — cleaned, but with the bucket prefix preserved. */
  readonly s3Key: string;
  /** The same key with the bucket folder prefix stripped. */
  readonly relativeKey: string;
  /** Owning tenant, read out of the key itself — null for a platform upload. */
  readonly tenantId: string | null;
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

  const tenantId = relativeKey.match(TENANT_UPLOAD_KEY)?.[1] ?? null;

  if (tenantId) {
    // Defence in depth: the shape is already proved above, but the guard is what
    // decides cross-tenant S3 access everywhere else (lib/storage/s3.ts), so it
    // decides here too — one place to change if those rules ever tighten. It gets
    // the RAW path, which is its contract: it decodes once itself, and handing it
    // the decoded key would decode twice and reject any filename holding a `%`.
    if (!isKeyInTenantScope(rawKeyPath, tenantId, { folderPrefix })) return null;
  } else if (!PLATFORM_UPLOAD_KEY.test(relativeKey)) {
    // Neither a tenant upload nor a platform one: everything else in the bucket
    // — template assets, the platform branding keys, the bucket root — stays
    // unreachable through this route.
    return null;
  }

  const contentType = publicImageContentType(relativeKey);
  if (!contentType) return null;

  return { s3Key, relativeKey, tenantId, contentType };
}
