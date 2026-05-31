import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import { updateFromGitHub } from "@/lib/tenant-template-upload-service";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { apiError } from "@/lib/api-error";
import { parseUuid } from "@/lib/validation/parse-uuid";

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

    const id = parseUuid((await params).id);

    // Verify the template belongs to this tenant
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
        { error: "Only custom templates can be updated from GitHub" },
        { status: 400 },
      );
    }

    const updated = await updateFromGitHub(id);

    await createAuditLog({
      action: AUDIT_ACTIONS.TEMPLATE.UPDATED,
      entityType: "TenantTemplate",
      entityId: id,
      userId: user.id,
      userEmail: user.email || undefined,
      tenantId,
      metadata: {
        action: "update-from-github",
        templateName: template.templateName,
        githubUrl: template.githubUrl,
      },
    });

    return NextResponse.json({
      success: true,
      templateId: updated.id,
      message: "Template updated from GitHub",
    });
  } catch (error: any) {
    console.error("[Update from GitHub] Error:", error);
    return apiError(error, {
      route: "tenant-admin.templates.update-from-github",
      status: 500,
      safeMessage: "Failed to update template",
    });
  }
}
