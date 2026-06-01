import { NextResponse } from "next/server";
import { withTenantAuth } from "@/lib/api-auth";
import { uploadFile, getFileUrl } from "@/lib/storage/s3";
import { validateUploadBuffer } from "@/lib/storage/upload-validation";

export const POST = withTenantAuth(async (req, { tenantId }) => {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
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
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const tenantUploadPrefix = tenantId ? `tenants/${tenantId}/` : "";
    const fileName = `${Date.now()}-${sanitizedName}`;
    const cloudStoragePath = await uploadFile(
      buffer,
      fileName,
      file.type || undefined,
      tenantUploadPrefix,
    );

    // Tenant uploads are scope-asserted at sign time; super-admin system
    // uploads (no tenant context) sign without a tenant scope.
    const signedUrl = tenantId
      ? await getFileUrl(cloudStoragePath, { tenantId })
      : await getFileUrl(cloudStoragePath);

    return NextResponse.json({ url: signedUrl, key: cloudStoragePath });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
});
