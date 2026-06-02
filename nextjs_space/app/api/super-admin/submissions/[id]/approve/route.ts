import { NextResponse } from "next/server";
import { withSuperAdminParams } from "@/lib/api-auth";
import { approveSubmission } from "@/lib/marketplace/marketplace-review-service";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { apiError } from "@/lib/api-error";
import { parseUuid } from "@/lib/validation/parse-uuid";

export const POST = withSuperAdminParams(async (request, { user }, params) => {
  try {
    const id = parseUuid(params.id);
    const template = await approveSubmission(id, user.id);

    await createAuditLog({
      action: AUDIT_ACTIONS.TEMPLATE.UPDATED,
      entityType: "MarketplaceSubmission",
      entityId: id,
      userId: user.id,
      userEmail: user.email || undefined,
      metadata: {
        action: "approved",
        approvedTemplateId: template.id,
        templateSlug: template.slug,
      },
    });

    return NextResponse.json({
      success: true,
      templateId: template.id,
      templateSlug: template.slug,
    });
  } catch (error: any) {
    console.error("[Approve Submission] Error:", error);
    return apiError(error, {
      route: "super-admin.submissions.approve",
      status: 500,
      safeMessage: "Failed to approve submission",
    });
  }
});
