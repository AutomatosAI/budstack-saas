import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import { submitToMarketplace } from "@/lib/marketplace-submission-service";
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

    // Verify template belongs to tenant
    const template = await prisma.tenant_templates.findFirst({
      where: { id, tenantId },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    if (template.source !== "custom") {
      return NextResponse.json(
        { error: "Only custom templates can be submitted to the marketplace" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { description, category, tags } = body;

    const submission = await submitToMarketplace(id, {
      description,
      category,
      tags,
    });

    await createAuditLog({
      action: AUDIT_ACTIONS.TEMPLATE.UPDATED,
      entityType: "MarketplaceSubmission",
      entityId: submission.id,
      userId: user.id,
      userEmail: user.email || undefined,
      tenantId,
      metadata: {
        action: "submitted-to-marketplace",
        templateName: template.templateName,
        submissionId: submission.id,
      },
    });

    return NextResponse.json({
      success: true,
      submissionId: submission.id,
    });
  } catch (error: any) {
    console.error("[Submit to Marketplace] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit template" },
      { status: 500 },
    );
  }
}
