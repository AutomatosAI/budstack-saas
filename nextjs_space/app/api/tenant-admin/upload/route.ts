import { NextResponse } from "next/server";
import { withTenantAuth } from "@/lib/api-auth";
import { uploadFile, getFileUrl } from "@/lib/storage/s3";
import { validateUploadBuffer } from "@/lib/storage/upload-validation";
import {
  publicImageContentType,
  publicImagePath,
} from "@/lib/storage/public-image-url";
import { apiError, apiValidationError } from "@/lib/api-error";

// withTenantAuth derives tenantId from the authenticated user (user.tenantId),
// NOT from the request host. The host-based getCurrentTenantId() this route used
// to call returns null on the shared admin dashboard, which 403'd every real
// TENANT_ADMIN while silently waving SUPER_ADMINs (incl. impersonation) past —
// so uploads only "worked" under impersonation. Matching the sibling /posts
// route (also withTenantAuth) fixes it for all tenant admins; during
// impersonation user.tenantId is the impersonated tenant, so that path still
// works and now writes to the correct tenant folder instead of the bucket root.
export const POST = withTenantAuth(async (req, { tenantId }) => {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return apiValidationError(
        "No file provided",
        "POST /api/tenant-admin/upload",
      );
    }

    // Convert File to Buffer for server-side magic-byte validation
    const buffer = Buffer.from(await file.arrayBuffer());

    // Sanitize filename — strip path traversal sequences
    const sanitizedName = file.name.replace(/\.\.\//g, '').replace(/\.\.\\/g, '').replace(/[/\\]/g, '_');

    const validation = await validateUploadBuffer(
      buffer,
      file.type,
      sanitizedName,
      { allowDocuments: true },
    );
    if (!validation.valid) {
      return apiValidationError(
        validation.error ?? "Invalid file",
        "POST /api/tenant-admin/upload",
      );
    }

    // Tenant-scoped upload path — prevents cross-tenant overwrites
    const uploadPrefix = `tenants/${tenantId}/`;
    const key = await uploadFile(buffer, sanitizedName, file.type, uploadPrefix);

    // The bucket is private (Object Ownership = bucket-owner-enforced, so ACLs
    // are rejected). The signed URL is the immediate preview; it expires after
    // ~1h, so anything that has to keep resolving — a blog cover, an image in a
    // campaign — stores publicUrl instead (US-005). Non-image uploads (PDFs)
    // have no durable route and stay presigned-only.
    const url = await getFileUrl(key, { tenantId });
    const publicUrl = publicImageContentType(key) ? publicImagePath(key) : null;

    return NextResponse.json({
      success: true,
      key,
      url,
      publicUrl,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return apiError(error, {
      route: "POST /api/tenant-admin/upload",
      safeMessage: "Upload failed",
    });
  }
});
