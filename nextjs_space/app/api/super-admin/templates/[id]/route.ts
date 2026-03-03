import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { uploadFile, getFileUrl, deleteS3Directory } from "@/lib/s3";
import fs from "fs/promises";
import path from "path";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await currentUser();
    if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const template = await prisma.templates.findUnique({
      where: { id: params.id },
    });
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const updateData: Record<string, any> = {};

    // Handle preview image upload
    const previewImage = formData.get("previewImage") as File;
    if (previewImage && previewImage.size > 0) {
      const buffer = Buffer.from(await previewImage.arrayBuffer());
      const fileName = `template-preview-${template.slug}-${Date.now()}-${previewImage.name}`;
      const s3Key = await uploadFile(buffer, fileName);
      updateData.previewUrl = s3Key;
      updateData.thumbnailUrl = s3Key;
    }

    // Handle optional text fields
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    if (name) updateData.name = name;
    if (description) updateData.description = description;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    updateData.updatedAt = new Date();

    await prisma.templates.update({
      where: { id: params.id },
      data: updateData,
    });

    // Return signed URL for immediate display
    let signedPreviewUrl = null;
    if (updateData.previewUrl) {
      signedPreviewUrl = await getFileUrl(updateData.previewUrl);
    }

    return NextResponse.json({
      success: true,
      message: `Template "${template.name}" updated`,
      previewUrl: signedPreviewUrl,
    });
  } catch (error: any) {
    console.error("[Template Update] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update template" },
      { status: 500 },
    );
  }
}

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

    // Support force deletion via query param
    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";

    if ((template._count.tenants > 0 || activeTenantTemplates.length > 0) && !force) {
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
          error: `Cannot delete template: It is currently in active use by ${usageDetails.join(' and ')}. Please deactivate or reassign those tenants first, or use force=true.`,
          tenantsCount: template._count.tenants,
          activeTenantTemplatesCount: activeTenantTemplates.length,
        },
        { status: 409 },
      );
    }

    console.log(
      `[Template Delete] Deleting template: ${template.name} (${template.slug})${force ? ' (FORCE)' : ''}`,
    );

    // Clear activeTenantTemplateId on any tenants using this template's tenant_templates
    const tenantTemplateIds = template.tenant_templates.map((tt: any) => tt.id);
    if (tenantTemplateIds.length > 0) {
      await prisma.tenants.updateMany({
        where: { activeTenantTemplateId: { in: tenantTemplateIds } },
        data: { activeTenantTemplateId: null },
      });
      console.log(`[Template Delete] Cleared activeTenantTemplateId on tenants`);
    }

    // Clear direct templateId references on tenants
    if (template._count.tenants > 0) {
      await prisma.tenants.updateMany({
        where: { templateId: templateId },
        data: { templateId: null },
      });
      console.log(`[Template Delete] Cleared templateId on ${template._count.tenants} tenant(s)`);
    }

    // Delete tenant_templates that reference this base template
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

    // Delete S3 template files
    if (template.slug) {
      try {
        const s3Deleted = await deleteS3Directory(`templates/${template.slug}/`);
        console.log(`[Template Delete] S3 cleanup: ${s3Deleted} file(s) deleted from templates/${template.slug}/`);
      } catch (s3Error: any) {
        console.error("[Template Delete] S3 cleanup failed (continuing):", s3Error.message);
      }
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
