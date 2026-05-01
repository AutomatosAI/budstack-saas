import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import { uploadFile, getFileUrl } from "@/lib/s3";
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

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 },
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image must be under 5MB" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `tenant-template-preview-${id}-${Date.now()}-${file.name}`;
    const s3Key = await uploadFile(buffer, fileName);

    await prisma.tenant_templates.update({
      where: { id },
      data: {
        previewUrl: s3Key,
        updatedAt: new Date(),
      },
    });

    const signedUrl = await getFileUrl(s3Key);

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
