import { NextResponse } from "next/server";
import { apiError, apiValidationError } from "@/lib/api-error";
import { withTenantAuth } from "@/lib/api-auth";
import { uploadFile, getFileUrl } from "@/lib/storage/s3";
import { validateUploadBuffer } from "@/lib/storage/upload-validation";

export const POST = withTenantAuth(async (req, { tenantId }) => {
  try {
    // Fail-closed: without a tenant scope a falsy tenantId would write to the
    // bucket root and sign an unscoped URL. Reject rather than fall back.
    if (!tenantId) {
      return apiError(new Error("Tenant context required"), {
        route: "POST /api/tenant-admin/branding/upload",
        status: 403,
        safeMessage: "Tenant context required",
      });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return apiValidationError("No file provided", "POST /api/tenant-admin/branding/upload");
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // SECURITY (C10): Strip path-traversal sequences from the user-supplied
    // filename before passing it through to S3.
    const sanitizedName = file.name
      .replace(/\.\.\//g, "")
      .replace(/\.\.\\/g, "")
      .replace(/[/\\]/g, "_")
      .slice(0, 200);

    const allowVideos = req.nextUrl.searchParams.get("type") === "video";

    // SECURITY (C10): Magic-byte verification — closes the
    // "image/png claimed but actual content is HTML/JS" attack.
    const validation = await validateUploadBuffer(
      buffer,
      file.type,
      sanitizedName,
      { allowVideos },
    );
    if (!validation.valid) {
      return apiValidationError(validation.error, "POST /api/tenant-admin/branding/upload");
    }

    const tenantUploadPrefix = `tenants/${tenantId}/`;
    const fileName = `${Date.now()}-${sanitizedName}`;
    const cloudStoragePath = await uploadFile(
      buffer,
      fileName,
      file.type || undefined,
      tenantUploadPrefix,
    );

    // Tenant uploads are scope-asserted at sign time.
    const signedUrl = await getFileUrl(cloudStoragePath, { tenantId });

    return NextResponse.json({ url: signedUrl, key: cloudStoragePath });
  } catch (error) {
    console.error("Upload error:", error);
    return apiError(error, { route: "POST /api/tenant-admin/branding/upload", safeMessage: "Internal server error" });
  }
});
