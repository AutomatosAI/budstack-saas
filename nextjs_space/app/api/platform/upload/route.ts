import { NextResponse } from "next/server";

import { withSuperAdmin } from "@/lib/api-auth";
import { apiError, apiValidationError } from "@/lib/api-error";
import { requireSameOrigin } from "@/lib/security/require-same-origin";
import {
  PLATFORM_UPLOAD_PREFIX,
  publicImageContentType,
  publicImagePath,
} from "@/lib/storage/public-image-url";
import { getFileUrl, uploadFile } from "@/lib/storage/s3";
import {
  sanitizeUploadFileName,
  validateUploadBuffer,
} from "@/lib/storage/upload-validation";

/**
 * Cover images for the budstacks.io blog (US-005).
 *
 * SUPER-ADMIN ONLY, same as the `/api/platform/posts` family it feeds. The
 * third route under `app/api/platform/`, `leads`, is deliberately
 * unauthenticated — a prospect has no account — and is NOT the model here.
 *
 * WHY NOT `/api/tenant-admin/upload`. That route is `withTenantAuth`, which
 * reads `tenantId` off the authenticated user and 403s when there isn't one. A
 * super-admin writing a platform post has no tenant, so it either refuses
 * outright or — under impersonation — files the platform's blog cover inside
 * some tenant's folder, where a tenant delete would eventually take it with it.
 *
 * WHERE THE BYTES GO. `platform/uploads/` — the platform's own prefix, not a
 * borrowed tenant id. A fake tenant would have satisfied the existing S3 scope
 * guard by accident and put a lie in every key. `PLATFORM_UPLOAD_PREFIX` is
 * imported from the module that decides what the public image route will serve,
 * so the stored URL below cannot drift out of that allow-list.
 */

const ROUTE = "POST /api/platform/upload";

export const POST = withSuperAdmin(async (req) => {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return apiValidationError("No file provided", ROUTE);
    }

    // Buffered so the magic-byte check reads the real content rather than
    // trusting the Content-Type the client claimed.
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = sanitizeUploadFileName(file.name);

    // Same validator, same options and therefore the same limits as the tenant
    // route: 10 MB, an extension allow-list with no SVG in it, and a magic-byte
    // check that has to agree with the claimed type.
    const validation = await validateUploadBuffer(buffer, file.type, fileName, {
      allowDocuments: true,
    });
    if (!validation.valid) {
      return apiValidationError(validation.error, ROUTE);
    }

    const key = await uploadFile(
      buffer,
      fileName,
      file.type,
      PLATFORM_UPLOAD_PREFIX,
    );

    // The response shape is the tenant route's, field for field, so the form
    // code is interchangeable: it stores `publicUrl || url`.
    //
    // `url` is a presigned link that dies in about an hour — fine as the
    // immediate preview, useless as a stored blog cover. `publicUrl` is the
    // durable one, and it is null for anything the public image route would
    // not serve (a PDF), which is exactly when the caller must not store it.
    const url = await getFileUrl(key);
    const publicUrl = publicImageContentType(key) ? publicImagePath(key) : null;

    return NextResponse.json({ success: true, key, url, publicUrl });
  } catch (error) {
    return apiError(error, { route: ROUTE, safeMessage: "Upload failed" });
  }
});
