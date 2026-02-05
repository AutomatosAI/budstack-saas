import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import fs from "fs/promises";
import path from "path";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await currentUser();

    if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = user.emailAddresses[0]?.emailAddress;

    const templateId = params.id;

    // Find template and check for active usage
    const template = await prisma.templates.findUnique({
      where: { id: templateId },
      include: {
        _count: {
          select: {
            tenants: true,
            tenant_templates: true,
          },
        },
        tenant_templates: {
          select: {
            id: true,
            templateName: true,
            activeForTenant: {
              select: {
                id: true,
                businessName: true,
              },
            },
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    // Check if template is in active use
    const activeTenantTemplates = template.tenant_templates.filter(
      (tt: any) => tt.activeForTenant !== null,
    );

    if (template._count.tenants > 0 || activeTenantTemplates.length > 0) {
      const usageDetails = [];
      if (template._count.tenants > 0) {
        usageDetails.push(`${template._count.tenants} tenant(s) directly`);
      }
      if (activeTenantTemplates.length > 0) {
        const tenantNames = activeTenantTemplates
          .map((tt: any) => tt.activeForTenant?.businessName)
          .join(", ");
        usageDetails.push(
          `${activeTenantTemplates.length} active tenant(s): ${tenantNames}`,
        );
      }

      return NextResponse.json(
        {
          error: `Cannot delete template: It is currently in active use by ${usageDetails.join(' and ')}. Please deactivate or reassign those tenants first.`,
          tenantsCount: template._count.tenants,
          activeTenantTemplatesCount: activeTenantTemplates.length,
        },
        { status: 409 },
      );
    }

    console.log(
      `[Template Delete] Deleting template: ${template.name} (${template.slug})`,
    );

    // Delete tenant_templates that reference this base template first
    if (template._count.tenant_templates > 0) {
      console.log(
        `[Template Delete] Deleting ${template._count.tenant_templates} tenant_templates that reference this base template`,
      );
      await prisma.tenant_templates.deleteMany({
        where: { baseTemplateId: templateId },
      });
    }

    // Delete template directory
    const templateDir = path.join(
      process.cwd(),
      "templates",
      template.slug || template.name,
    );
    try {
      const dirExists = await fs
        .access(templateDir)
        .then(() => true)
        .catch(() => false);
      if (dirExists) {
        await fs.rm(templateDir, { recursive: true, force: true });
        console.log(`[Template Delete] Directory removed: ${templateDir}`);
      }
    } catch (fsError: any) {
      console.error("[Template Delete] Error removing directory:", fsError);
      // Continue with database deletion even if file system cleanup fails
    }

    // Delete database record
    await prisma.templates.delete({
      where: { id: templateId },
    });

    console.log("[Template Delete] Database record deleted");

    // Create audit log
    const clientInfo = getClientInfo(req.headers);
    await createAuditLog({
      action: AUDIT_ACTIONS.TEMPLATE.DELETED,
      entityType: "template",
      entityId: templateId,
      userId: user.id,
      userEmail: email!,
      metadata: {
        templateName: template.name,
        templateSlug: template.slug || "",
      },
      ...clientInfo,
    });

    return NextResponse.json({
      success: true,
      message: `Template "${template.name}" deleted successfully`,
    });
  } catch (error: any) {
    console.error("[Template Delete] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete template" },
      { status: 500 },
    );
  }
}
