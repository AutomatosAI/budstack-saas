import { NextResponse } from "next/server";
import { withTenantAuthParams } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { updateFromGitHub } from "@/lib/tenant-template-upload-service";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { apiError } from "@/lib/api-error";

export const POST = withTenantAuthParams(
  async (_request, { user, tenantId }, params) => {
  try {
    const { id } = params;

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
});
