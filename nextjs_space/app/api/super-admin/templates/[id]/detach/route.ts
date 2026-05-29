import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { requireSameOrigin } from "@/lib/security/require-same-origin";

/**
 * POST /api/super-admin/templates/[id]/detach
 *
 * Detaches all tenant references to a template so it can be deleted.
 * - Nulls out tenants.templateId (legacy FK)
 * - Nulls out tenants.activeTenantTemplateId for any tenant_templates using this base
 * - Deletes orphaned tenant_templates records
 *
 * TEMPORARY — remove after cannabizz cleanup.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await currentUser();
    if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const originError = requireSameOrigin(req);
    if (originError) return originError;

    const templateId = params.id;

    // Find the template and all its references
    const template = await prisma.templates.findUnique({
      where: { id: templateId },
      include: {
        tenants: {
          select: { id: true, businessName: true, subdomain: true },
        },
        tenant_templates: {
          select: {
            id: true,
            templateName: true,
            tenantId: true,
            activeForTenant: {
              select: { id: true, businessName: true, subdomain: true },
            },
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const report: any = {
      template: { id: template.id, name: template.name, slug: template.slug },
      legacyTenants: template.tenants,
      tenantTemplates: template.tenant_templates,
      actions: [],
    };

    // 1. Null out legacy templateId references
    if (template.tenants.length > 0) {
      const ids = template.tenants.map((t: any) => t.id);
      await prisma.tenants.updateMany({
        where: { id: { in: ids } },
        data: { templateId: null },
      });
      report.actions.push(`Cleared templateId on ${ids.length} tenant(s): ${template.tenants.map((t: any) => t.businessName).join(", ")}`);
    }

    // 2. Null out activeTenantTemplateId for tenants using these tenant_templates
    const activeTTs = template.tenant_templates.filter((tt: any) => tt.activeForTenant !== null);
    if (activeTTs.length > 0) {
      const tenantIds = activeTTs.map((tt: any) => tt.activeForTenant!.id);
      await prisma.tenants.updateMany({
        where: { id: { in: tenantIds } },
        data: { activeTenantTemplateId: null },
      });
      report.actions.push(`Cleared activeTenantTemplateId on ${tenantIds.length} tenant(s): ${activeTTs.map((tt: any) => tt.activeForTenant!.businessName).join(", ")}`);
    }

    // 3. Delete all tenant_templates referencing this base template
    if (template.tenant_templates.length > 0) {
      await prisma.tenant_templates.deleteMany({
        where: { baseTemplateId: templateId },
      });
      report.actions.push(`Deleted ${template.tenant_templates.length} tenant_templates record(s)`);
    }

    if (report.actions.length === 0) {
      report.actions.push("No references found — template is already detached");
    }

    console.log("[Template Detach]", JSON.stringify(report, null, 2));

    // Full report (tenant names/subdomains/actions) is logged server-side only — not returned
    // to the client to avoid leaking an internal operation trace (PRD-201 AC-5).
    return NextResponse.json({
      success: true,
      message: `Template "${template.name}" detached from all tenants. You can now delete it.`,
    });
  } catch (error: any) {
    console.error("[Template Detach] Error:", error);
    return apiError(error, {
      route: "super-admin.templates.detach",
      status: 500,
      safeMessage: "Failed to detach template",
    });
  }
}
