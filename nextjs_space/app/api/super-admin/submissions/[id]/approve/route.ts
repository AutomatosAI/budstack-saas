import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { approveSubmission } from "@/lib/marketplace-review-service";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { apiError } from "@/lib/api-error";
import { parseUuid } from "@/lib/validation/parse-uuid";

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
}
