import { NextResponse } from "next/server";
import { withTenantAuthParams } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { uploadFile, getFileUrl } from "@/lib/storage/s3";
import { validateUploadBuffer } from "@/lib/storage/upload-validation";
import { apiError, apiValidationError } from "@/lib/api-error";
import { parseUuid } from "@/lib/validation/parse-uuid";

export const POST = withTenantAuthParams(
  async (request, { tenantId }, params) => {
  try {
    const id = parseUuid(params.id);

    // Verify the template belongs to this tenant
    const template = await prisma.tenant_templates.findFirst({
      where: { id, tenantId },
    });

    if (!template) {
      return apiError(new Error("Template not found"), {
        route: "POST /api/tenant-admin/templates/[id]/preview-image",
        status: 404,
        safeMessage: "Template not found",
      });
    }

    const formData = await request.formData();
    const file = formData.get("previewImage") as File;

    if (!file || file.size === 0) {
      return apiValidationError(
        "No image file provided",
        "POST /api/tenant-admin/templates/[id]/preview-image",
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // SECURITY (C10): Sanitize filename + magic-byte verify content.
    const sanitizedName = file.name
      .replace(/\.\.\//g, "")
      .replace(/\.\.\\/g, "")
      .replace(/[/\\]/g, "_")
      .slice(0, 200);

    const validation = await validateUploadBuffer(
      buffer,
      file.type,
      sanitizedName,
      { maxSize: 5 * 1024 * 1024 },
    );
    if (!validation.valid) {
      return apiValidationError(
        validation.error,
        "POST /api/tenant-admin/templates/[id]/preview-image",
      );
    }

    const fileName = `tenant-template-preview-${id}-${Date.now()}-${sanitizedName}`;
    const s3Key = await uploadFile(
      buffer,
      fileName,
      file.type || undefined,
      `tenants/${tenantId}/`,
    );

    await prisma.tenant_templates.update({
      where: { id },
      data: {
        previewUrl: s3Key,
        updatedAt: new Date(),
      },
    });

    const signedUrl = await getFileUrl(s3Key, { tenantId });

    return NextResponse.json({
      success: true,
      previewUrl: signedUrl,
      message: "Preview image uploaded",
    });
  } catch (error: any) {
    console.error("[Tenant Preview Upload] Error:", error);
    return apiError(error, {
      route: "tenant-admin.templates.preview-image.upload",
      status: 500,
      safeMessage: "Failed to upload preview image",
    });
  }
});
