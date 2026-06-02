import { NextResponse } from "next/server";
import { withTenantAuthParams } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { updateFromGitHub } from "@/lib/tenant/tenant-template-upload-service";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { apiError, apiValidationError } from "@/lib/api-error";
import { parseUuid } from "@/lib/validation/parse-uuid";

export const POST = withTenantAuthParams(
  async (_request, { user, tenantId }, params) => {
  try {
    const id = parseUuid(params.id);

    // Verify the template belongs to this tenant
    const template = await prisma.tenant_templates.findFirst({
      where: { id, tenantId },
    });

    if (!template) {
      return apiError(new Error("Template not found"), { route: "POST /api/tenant-admin/templates/[id]/update-from-github", status: 404, safeMessage: "Template not found" });
    }

    if (template.source !== "custom") {
      return apiValidationError("Only custom templates can be updated from GitHub", "POST /api/tenant-admin/templates/[id]/update-from-github");
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
