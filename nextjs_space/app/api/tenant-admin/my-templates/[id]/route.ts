import { NextResponse } from "next/server";
import { withTenantAuthParams } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";
import { apiError } from "@/lib/api-error";
import { parseUuid } from "@/lib/validation/parse-uuid";

export const DELETE = withTenantAuthParams(async (req, { user, tenantId }, params) => {
  try {
    const tenantTemplateId = parseUuid(params.id);

    if (user.role !== "TENANT_ADMIN") {
      return NextResponse.json(
        { error: "Only tenant admins can delete templates" },
        { status: 403 },
      );
    }

    // Find the tenant template
    const tenantTemplate = await prisma.tenant_templates.findUnique({
      where: { id: tenantTemplateId },
      include: {
        activeForTenant: {
          select: { id: true, businessName: true },
        },
      },
    });

    if (!tenantTemplate) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    // Verify the template belongs to this tenant
    if (tenantTemplate.tenantId !== tenantId) {
      return NextResponse.json(
        { error: "You can only delete your own templates" },
        { status: 403 },
      );
    }

    // Check if template is currently active
    if (tenantTemplate.activeForTenant) {
      return NextResponse.json(
        {
          error: `Cannot delete this template: It is currently active for ${tenantTemplate.activeForTenant.businessName}. Please activate a different template first.`,
        },
        { status: 409 },
      );
    }

    console.log(
      `[Tenant Template Delete] Deleting template: ${tenantTemplate.templateName} for tenant: ${tenantId}`,
    );

    // Delete the tenant template
    await prisma.tenant_templates.delete({
      where: { id: tenantTemplateId },
    });

    console.log("[Tenant Template Delete] Database record deleted");

    // Create audit log
    const clientInfo = getClientInfo(req.headers);
    await createAuditLog({
      action: AUDIT_ACTIONS.TEMPLATE.DELETED,
      entityType: "tenant_template",
      entityId: tenantTemplateId,
      userId: user.id,
      userEmail: user.email!,
      tenantId: tenantId,
      metadata: {
        templateName: tenantTemplate.templateName,
        baseTemplateId: tenantTemplate.baseTemplateId,
      },
      ...clientInfo,
    });

    return NextResponse.json({
      success: true,
      message: `Template "${tenantTemplate.templateName}" deleted successfully`,
    });
  } catch (error: any) {
    console.error("[Tenant Template Delete] Error:", error);
    return apiError(error, {
      route: "tenant-admin.my-templates.delete",
      status: 500,
      safeMessage: "Failed to delete template",
    });
  }
});
