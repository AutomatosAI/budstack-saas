import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { deleteS3Directory } from "@/lib/s3";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/super-admin/templates/cleanup-s3?prefix=templates/healingbuds/
 * Cleans orphaned S3 template files when DB record is already gone.
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const prefix = req.nextUrl.searchParams.get("prefix");
    if (!prefix || !prefix.startsWith("templates/")) {
      return NextResponse.json(
        { error: "Required: ?prefix=templates/{slug}/" },
        { status: 400 },
      );
    }

    const normalizedPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
    const deleted = await deleteS3Directory(normalizedPrefix);

    console.log(`[S3 Cleanup] ${deleted} file(s) deleted from ${normalizedPrefix}`);

    return NextResponse.json({
      success: true,
      prefix: normalizedPrefix,
      filesDeleted: deleted,
    });
  } catch (error: any) {
    console.error("[S3 Cleanup] Error:", error);
    return NextResponse.json(
      { error: error.message || "Cleanup failed" },
      { status: 500 },
    );
  }
}
