import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import { withdrawSubmission } from "@/lib/marketplace-submission-service";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (
      !user ||
      !["TENANT_ADMIN", "SUPER_ADMIN"].includes(user.role || "")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: "No tenant found" },
        { status: 400 },
      );
    }

    const { id } = await params;

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
    return NextResponse.json(
      { error: error.message || "Failed to withdraw submission" },
      { status: 500 },
    );
  }
}
