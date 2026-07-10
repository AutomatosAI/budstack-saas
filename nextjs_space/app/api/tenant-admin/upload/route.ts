import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { uploadFile, getFileUrl } from "@/lib/storage/s3";
import { validateUploadBuffer } from "@/lib/storage/upload-validation";
import { getCurrentTenantId } from "@/lib/tenant/tenant";
import { apiError, apiValidationError } from "@/lib/api-error";

export const POST = withAuth(async (req, { user }) => {
  try {
    if (!["TENANT_ADMIN", "SUPER_ADMIN"].includes(user.role || "")) {
      return apiError(new Error("Unauthorized"), {
        route: "POST /api/tenant-admin/upload",
        status: 401,
        safeMessage: "Unauthorized",
      });
    }

    const tenantId = await getCurrentTenantId();
    if (!tenantId && user.role !== "SUPER_ADMIN") {
      return apiError(new Error("No tenant context"), {
        route: "POST /api/tenant-admin/upload",
        status: 403,
        safeMessage: "No tenant context",
      });
    }

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
    const uploadPrefix = tenantId ? `tenants/${tenantId}/` : '';
    const key = await uploadFile(buffer, sanitizedName, file.type, uploadPrefix);

    // The bucket is private (Object Ownership = bucket-owner-enforced, so ACLs
    // are rejected). Return a SIGNED URL so the cover-image preview + storefront
    // <img> can load it. NOTE: signed URLs expire (~1h) — a follow-up will store
    // the key and sign at render for durable public covers.
    const url = await getFileUrl(key, tenantId ? { tenantId } : undefined);

    return NextResponse.json({
      success: true,
      key,
      url,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return apiError(error, {
      route: "POST /api/tenant-admin/upload",
      safeMessage: "Upload failed",
    });
  }
});
