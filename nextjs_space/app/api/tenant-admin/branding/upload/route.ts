import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { uploadFile, getFileUrl } from "@/lib/s3";
import { validateUploadBuffer } from "@/lib/upload-validation";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (
      !user ||
      !["TENANT_ADMIN", "SUPER_ADMIN"].includes(user.role || "")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // SECURITY (H_u): Tenant context required so uploads land in
    // tenants/{id}/uploads/ and cross-tenant overwrites are impossible.
    const tenantId = user.tenantId;
    if (!tenantId && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "No tenant context" },
        { status: 403 },
      );
    }

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
}
