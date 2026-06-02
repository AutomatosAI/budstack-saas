import { NextResponse } from "next/server";
import { withSuperAdmin } from "@/lib/api-auth";
import { deleteS3Directory } from "@/lib/storage/s3";
import { apiError, apiValidationError } from "@/lib/api-error";
import { requireSameOrigin } from "@/lib/security/require-same-origin";
import { requireConfirmation } from "@/lib/security/require-confirmation";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/super-admin/templates/cleanup-s3?prefix=templates/{slug}/
 * Body: { "confirm": "{slug}" }
 *
 * Cleans orphaned S3 template files when the DB record is already gone. Same-origin only;
 * requires an exact single-segment templates/{slug}/ prefix (no bare prefix / no traversal)
 * and a typed confirmation matching the slug. Writes a structured audit line.
 */
export const DELETE = withSuperAdmin(async (req, { user }) => {
  try {
    const originError = requireSameOrigin(req);
    if (originError) return originError;

    // Require an exact templates/<slug> prefix: a single non-empty slug segment of safe chars,
    // no '..' traversal, and never a bare `templates/` (which would wipe every template) (AC-1a).
    const prefix = req.nextUrl.searchParams.get("prefix");
    const slug = prefix?.match(/^templates\/([a-zA-Z0-9._-]+)\/?$/)?.[1];
    if (!slug || slug.includes("..")) {
      return apiValidationError(
        "Required: ?prefix=templates/{slug}/ with a single non-empty slug segment",
        "DELETE /api/super-admin/templates/cleanup-s3",
      );
    }

    // Typed confirmation: caller must resend { confirm: <slug> } to authorise the wipe (AC-3).
    const body = await req.json().catch(() => null);
    const confirmationError = requireConfirmation(body, slug);
    if (confirmationError) return confirmationError;

    const normalizedPrefix = `templates/${slug}/`;
    const deleted = await deleteS3Directory(normalizedPrefix);

    // Structured destructive-action audit line (server-side) (AC-8).
    console.error(
      "[S3 Cleanup][AUDIT]",
      JSON.stringify({
        action: "S3_TEMPLATE_CLEANUP",
        actor: user.email ?? user.id,
        targetPrefix: normalizedPrefix,
        filesDeleted: deleted,
        timestamp: new Date().toISOString(),
      }),
    );

    return NextResponse.json({
      success: true,
      prefix: normalizedPrefix,
      filesDeleted: deleted,
    });
  } catch (error: any) {
    console.error("[S3 Cleanup] Error:", error);
    return apiError(error, {
      route: "super-admin.templates.cleanup-s3",
      status: 500,
      safeMessage: "Cleanup failed",
    });
  }
});
