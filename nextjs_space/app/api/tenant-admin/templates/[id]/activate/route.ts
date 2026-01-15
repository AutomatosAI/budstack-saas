import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // 1. Authentication
    const user = await getCurrentUser();
    if (
      !user ||
      !["TENANT_ADMIN", "SUPER_ADMIN"].includes(user.role || "")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get tenant
    const tenantId = user.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: "No tenant found" }, { status: 400 });
    }

    const { id } = await params;
    const templateId = id;

    // 3. Verify template belongs to tenant
    const template = await prisma.tenant_templates.findFirst({
      where: {
        id: templateId,
        tenantId: tenantId,
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    // 4. Deactivate all other templates for this tenant
    await prisma.tenant_templates.updateMany({
      where: {
        tenantId: tenantId,
        id: { not: templateId },
      },
      data: { isActive: false },
    });

    // 5. Activate this template
    await prisma.tenant_templates.update({
      where: { id: templateId },
      data: { isActive: true },
    });

    // 6. Update tenant's activeTenantTemplateId
    await prisma.tenants.update({
      where: { id: tenantId },
      data: { activeTenantTemplateId: templateId },
    });

    // 7. Audit log
    await createAuditLog({
      action: AUDIT_ACTIONS.TEMPLATE.UPDATED,
      entityType: "TenantTemplate",
      entityId: templateId,
      userId: user.id,
      userEmail: user.email || undefined,
      tenantId: tenantId,
      metadata: {
        action: "activated",
        templateName: template.templateName,
      },
    });

    console.log(
      `✅ Activated template ${templateId} for tenant ${tenantId}`,
    );

    return NextResponse.json({
      success: true,
      message: "Template activated successfully",
    });
  } catch (error: any) {
    console.error("Template activation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to activate template" },
      { status: 500 },
    );
  }
}
