import { NextResponse } from "next/server";
import { withTenantAuthParams } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { withdrawSubmission } from "@/lib/marketplace/marketplace-submission-service";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { apiError } from "@/lib/api-error";
import { parseUuid } from "@/lib/validation/parse-uuid";

export const POST = withTenantAuthParams(
  async (_request, { user, tenantId }, params) => {
  try {
    const id = parseUuid(params.id);

    // Find the active submission for this template
    const submission = await prisma.marketplace_submissions.findFirst({
      where: {
        tenantTemplateId: id,
        tenantId,
        status: { in: ["pending", "changes_requested"] },
      },
    });

    if (!submission) {
      return apiError(new Error("No active submission found for this template"), { route: "POST /api/tenant-admin/templates/[id]/withdraw-submission", status: 404, safeMessage: "No active submission found for this template" });
    }

    await withdrawSubmission(submission.id, tenantId);

    await createAuditLog({
      action: AUDIT_ACTIONS.TEMPLATE.UPDATED,
      entityType: "MarketplaceSubmission",
      entityId: submission.id,
      userId: user.id,
      userEmail: user.email || undefined,
      tenantId,
      metadata: {
        action: "withdrawn",
        templateName: submission.templateName,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Withdraw Submission] Error:", error);
    return apiError(error, {
      route: "tenant-admin.templates.withdraw-submission",
      status: 500,
      safeMessage: "Failed to withdraw submission",
    });
  }
});
