import { NextResponse } from "next/server";
import { withTenantAuthParams } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { withdrawSubmission } from "@/lib/marketplace-submission-service";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { apiError } from "@/lib/api-error";

export const POST = withTenantAuthParams(
  async (_request, { user, tenantId }, params) => {
  try {
    const { id } = params;

    // Find the active submission for this template
    const submission = await prisma.marketplace_submissions.findFirst({
      where: {
        tenantTemplateId: id,
        tenantId,
        status: { in: ["pending", "changes_requested"] },
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "No active submission found for this template" },
        { status: 404 },
      );
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
