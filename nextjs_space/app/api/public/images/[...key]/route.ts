import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";

import { apiError } from "@/lib/api-error";
import { createS3Client, getBucketConfig } from "@/lib/storage/aws-config";
import {
  PUBLIC_IMAGE_ROUTE_PREFIX,
  isServablePublicImageType,
  parsePublicImageRequest,
} from "@/lib/storage/public-image-url";

/**
 * Email Phase 2 US-005 — durable public image delivery.
 *
 * The bucket is private (Object Ownership = bucket-owner-enforced), so an
 * uploaded image could only be shown through a presigned URL that expires after
 * an hour. This route is the durable path: it re-reads the object on every
 * request and serves it under an immutable cache header, so a blog cover or a
 * campaign image keeps resolving for as long as the object exists.
 *
 * It is public by necessity — a mail client and an anonymous storefront visitor
 * both have to fetch it with no session. What keeps that safe:
 *   - only keys under `tenants/{tenantId}/uploads/` — or, since Platform US-005,
 *     `platform/uploads/` for budstacks.io's own blog covers — are servable, the
 *     tenant ones checked with the same guard that gates every other S3 read
 *     (lib/storage/s3-tenant-guard);
 *   - the extension allow-list is images only, SVG excluded, and the served
 *     Content-Type is derived from that allow-list rather than from S3, so a
 *     mislabelled object can never come back as HTML;
 *   - every rejection is the same 404, so responses cannot be used to probe
 *     which keys exist.
 * These are public marketing assets by definition — the tenant put them in an
 * email or on a storefront page — so there is nothing here to authorise.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = `GET ${PUBLIC_IMAGE_ROUTE_PREFIX}[...key]`;

const IMAGE_RESPONSE_HEADERS = {
  "Cache-Control": "public, max-age=31536000, immutable",
  "X-Content-Type-Options": "nosniff",
} as const;

/**
 * One 404 for every rejection. Telling "not an image" apart from "denied" or
 * "no such object" would let a caller map the bucket, and an S3 error message
 * would name it outright. The real reason is logged with a correlation id.
 */
function notFound(reason: unknown): NextResponse {
  return apiError(reason, {
    route: ROUTE,
    status: 404,
    safeMessage: "Image not found",
  });
}

/**
 * The key comes from the raw pathname, NOT from the `[...key]` params: Next has
 * already percent-decoded those, and the scope guard decodes once more to catch
 * `..%2F` escapes — feeding it pre-decoded segments would be a double decode.
 */
function rawKeyPath(request: NextRequest): string {
  const { pathname } = request.nextUrl;
  return pathname.startsWith(PUBLIC_IMAGE_ROUTE_PREFIX)
    ? pathname.slice(PUBLIC_IMAGE_ROUTE_PREFIX.length)
    : "";
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { bucketName, folderPrefix } = await getBucketConfig();

    const parsed = parsePublicImageRequest(rawKeyPath(request), folderPrefix);
    if (!parsed) {
      return notFound(new Error("Key is not a servable tenant upload"));
    }

    const s3Client = await createS3Client();
    let object;
    try {
      object = await s3Client.send(
        new GetObjectCommand({ Bucket: bucketName, Key: parsed.s3Key }),
      );
    } catch (error) {
      // Missing, denied and misconfigured all look the same from outside; the
      // underlying S3 error is kept for the server log only.
      return notFound(error);
    }

    // The stored type is a second opinion — what we serve is parsed.contentType.
    if (object.ContentType && !isServablePublicImageType(object.ContentType)) {
      return notFound(new Error("Stored object is not a servable image"));
    }

    const body = object.Body?.transformToWebStream();
    if (!body) {
      return notFound(new Error("Object has no readable body"));
    }

    return new NextResponse(body, {
      status: 200,
      headers: { ...IMAGE_RESPONSE_HEADERS, "Content-Type": parsed.contentType },
    });
  } catch (error) {
    // Config/credential failures are genuine 5xx — do not disguise them as 404.
    return apiError(error, { route: ROUTE, safeMessage: "Image unavailable" });
  }
}
