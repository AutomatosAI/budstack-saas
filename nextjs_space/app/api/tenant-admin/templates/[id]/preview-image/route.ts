import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import { uploadFile, getFileUrl } from "@/lib/s3";
import { validateUploadBuffer } from "@/lib/upload-validation";
import { apiError } from "@/lib/api-error";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (
      !user ||
      !["TENANT_ADMIN", "SUPER_ADMIN"].includes(user.role || "")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: "No tenant found" },
        { status: 400 },
      );
    }

    const { id } = await params;

    // Verify the template belongs to this tenant
    const template = await prisma.tenant_templates.findFirst({
      where: { id, tenantId },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("previewImage") as File;

    if (!file || file.size === 0) {
      return NextResponse.json(
        { error: "No image file provided" },
        { status: 400 },
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
      return NextResponse.json({ error: validation.error }, { status: 400 });
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
}
