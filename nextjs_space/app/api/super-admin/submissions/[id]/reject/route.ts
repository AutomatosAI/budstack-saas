import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-helper";
import { rejectSubmission } from "@/lib/marketplace-review-service";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { apiError } from "@/lib/api-error";
import { parseUuid } from "@/lib/validation/parse-uuid";
import { parseJsonBody } from "@/lib/validation/body";

const feedbackSchema = z
  .object({
    feedback: z.string().min(1).max(10000),
  })
  .strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = parseUuid((await params).id);
    const { feedback } = await parseJsonBody(request, feedbackSchema);

    if (!feedback.trim()) {
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
}
