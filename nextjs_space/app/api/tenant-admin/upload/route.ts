import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { uploadFile } from "@/lib/storage/s3";
import { getBucketConfig } from "@/lib/storage/aws-config";
import { validateUploadBuffer } from "@/lib/storage/upload-validation";
import { getCurrentTenantId } from "@/lib/tenant/tenant";

export const POST = withAuth(async (req, { user }) => {
  try {
    if (!["TENANT_ADMIN", "SUPER_ADMIN"].includes(user.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = await getCurrentTenantId();
    if (!tenantId && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "No tenant context" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
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
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Tenant-scoped upload path — prevents cross-tenant overwrites
    const uploadPrefix = tenantId ? `tenants/${tenantId}/` : '';
    const key = await uploadFile(buffer, sanitizedName, file.type, uploadPrefix);

    const { bucketName, region } = await getBucketConfig();
    const publicUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;

    return NextResponse.json({
      success: true,
      key,
      url: publicUrl,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 },
    );
  }
});
