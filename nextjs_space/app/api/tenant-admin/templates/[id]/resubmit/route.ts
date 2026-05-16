import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import { updateFromGitHub } from "@/lib/tenant-template-upload-service";
import { resubmitToMarketplace } from "@/lib/marketplace-submission-service";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { apiError } from "@/lib/api-error";

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
      return NextResponse.json({ error: "No tenant found" }, { status: 400 });
    }

    const { id } = await params;

    // Verify template belongs to tenant and is custom
    const template = await prisma.tenant_templates.findFirst({
      where: { id, tenantId, source: "custom" },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Custom template not found" },
        { status: 404 },
      );
    }

    // Find the changes_requested submission
    const submission = await prisma.marketplace_submissions.findFirst({
      where: {
        tenantTemplateId: id,
        tenantId,
        status: "changes_requested",
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "No submission with changes requested found" },
        { status: 404 },
      );
    }

    // Step 1: Update from GitHub (if githubUrl exists)
    if (template.githubUrl) {
      await updateFromGitHub(id);
    }

    // Step 2: Re-submit to marketplace
    const updated = await resubmitToMarketplace(submission.id);

    await createAuditLog({
      action: AUDIT_ACTIONS.TEMPLATE.UPDATED,
      entityType: "MarketplaceSubmission",
      entityId: submission.id,
      userId: user.id,
      userEmail: user.email || undefined,
      tenantId,
      metadata: {
        action: "resubmitted",
        templateName: template.templateName,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Template updated and re-submitted for review",
    });
  } catch (error: any) {
    console.error("[Resubmit] Error:", error);
    return apiError(error, {
      route: "tenant-admin.templates.resubmit",
      status: 500,
      safeMessage: "Failed to re-submit template",
    });
  }
}
