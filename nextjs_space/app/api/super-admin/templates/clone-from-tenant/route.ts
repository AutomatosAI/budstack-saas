import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { copyS3Directory } from "@/lib/s3";

/**
 * Clone a tenant's customized template to a marketplace template.
 *
 * Usage: POST /api/super-admin/templates/clone-from-tenant
 * Body: { subdomain: "onetree", targetTemplateId?: "existing-template-id" }
 *
 * If targetTemplateId is provided, overwrites that template's S3 files.
 * Otherwise creates a new marketplace template.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();

    if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { subdomain, targetTemplateId } = body;

    if (!subdomain) {
      return NextResponse.json({ error: "subdomain is required" }, { status: 400 });
    }

    // Find the tenant by subdomain
    const tenant = await prisma.tenants.findFirst({
      where: { subdomain },
    });

    if (!tenant) {
      return NextResponse.json({ error: `Tenant with subdomain "${subdomain}" not found` }, { status: 404 });
    }

    // Get active tenant template
    const tenantTemplate = tenant.activeTenantTemplateId
      ? await prisma.tenant_templates.findUnique({
          where: { id: tenant.activeTenantTemplateId },
          include: { templates: true },
        })
      : null;

    if (!tenantTemplate) {
      return NextResponse.json({ error: "Tenant has no active template" }, { status: 404 });
    }

    const sourceS3Path = tenantTemplate.s3Path;
    if (!sourceS3Path) {
      return NextResponse.json({ error: "Tenant template has no S3 path" }, { status: 400 });
    }

    let targetTemplate: any;

    if (targetTemplateId) {
      // Overwrite existing marketplace template
      targetTemplate = await prisma.templates.findUnique({ where: { id: targetTemplateId } });
      if (!targetTemplate) {
        return NextResponse.json({ error: "Target template not found" }, { status: 404 });
      }
    } else {
      // Create new marketplace template
      const timestamp = Date.now();
      const slug = `${subdomain}-${timestamp}`;
      targetTemplate = await prisma.templates.create({
        data: {
          id: `tmpl_${timestamp}`,
          name: `${tenant.businessName} Template`,
          slug,
          description: `Cloned from ${tenant.businessName} (${subdomain})`,
          isActive: true,
          isPublic: true,
          sourceType: "SYSTEM",
          category: "modern",
          version: "1.0.0",
          author: tenant.businessName || "BudStacks",
          tags: [],
          updatedAt: new Date(),
        },
      });
    }

    const destS3Path = `templates/${targetTemplate.slug}`;

    // Copy S3 files from tenant to marketplace
    const filesCopied = await copyS3Directory(sourceS3Path, destS3Path);

    console.log(`[super-admin] Cloned tenant "${subdomain}" (${sourceS3Path}) → marketplace "${targetTemplate.slug}" (${destS3Path}), ${filesCopied} files`);

    // Update the template's updatedAt
    await prisma.templates.update({
      where: { id: targetTemplate.id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      templateId: targetTemplate.id,
      slug: targetTemplate.slug,
      filesCopied,
      message: `Cloned ${filesCopied} files from "${subdomain}" to marketplace template "${targetTemplate.slug}"`,
      editUrl: `/super-admin/templates/${targetTemplate.id}/edit`,
    });
  } catch (error) {
    console.error("[super-admin] Clone from tenant error:", error);
    return NextResponse.json(
      { error: "Failed to clone", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
