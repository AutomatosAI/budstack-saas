import { NextResponse } from "next/server";
import { withSuperAdminParams } from "@/lib/api-auth";
import { rejectSubmission } from "@/lib/marketplace-review-service";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { apiError } from "@/lib/api-error";

export const POST = withSuperAdminParams(async (request, { user }, params) => {
  try {
    const { id } = params;
    const body = await request.json();
    const { feedback } = body;

    if (!feedback || typeof feedback !== "string" || !feedback.trim()) {
      return NextResponse.json(
        { error: "Feedback is required when rejecting a submission" },
        { status: 400 },
      );
    }

    await rejectSubmission(id, user.id, feedback.trim());

    await createAuditLog({
      action: AUDIT_ACTIONS.TEMPLATE.UPDATED,
      entityType: "MarketplaceSubmission",
      entityId: id,
      userId: user.id,
      userEmail: user.email || undefined,
      metadata: { action: "rejected", feedback: feedback.trim() },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Reject Submission] Error:", error);
    return apiError(error, {
      route: "super-admin.submissions.reject",
      status: 500,
      safeMessage: "Failed to reject submission",
    });
  }
});
