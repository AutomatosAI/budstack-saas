import { NextResponse } from "next/server";
import { withSuperAdminParams } from "@/lib/api-auth";
import { editSubmission } from "@/lib/marketplace-review-service";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { apiError } from "@/lib/api-error";

export const PUT = withSuperAdminParams(async (request, { user }, params) => {
  try {
    const { id } = params;
    const body = await request.json();
    const { layoutJson, defaultsJson, configJson, stylesCss } = body;

    if (!layoutJson && !defaultsJson && !configJson && !stylesCss) {
      return NextResponse.json(
        { error: "At least one file must be provided" },
        { status: 400 },
      );
    }

    await editSubmission(id, { layoutJson, defaultsJson, configJson, stylesCss });

    await createAuditLog({
      action: AUDIT_ACTIONS.TEMPLATE.UPDATED,
      entityType: "MarketplaceSubmission",
      entityId: id,
      userId: user.id,
      userEmail: user.email || undefined,
      metadata: {
        action: "edited",
        filesEdited: [
          layoutJson && "layout.json",
          defaultsJson && "defaults.json",
          configJson && "template.config.json",
          stylesCss && "styles.css",
        ].filter(Boolean),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Edit Submission] Error:", error);
    return apiError(error, {
      route: "super-admin.submissions.edit",
      status: 500,
      safeMessage: "Failed to edit submission",
    });
  }
});
