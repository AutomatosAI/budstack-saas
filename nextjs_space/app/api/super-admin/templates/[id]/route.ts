import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { uploadFile, getFileUrl, deleteS3Directory } from "@/lib/s3";
import { validateUploadBuffer } from "@/lib/upload-validation";
import fs from "fs/promises";
import path from "path";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";
import { apiError } from "@/lib/api-error";
import { parseUuid } from "@/lib/validation/parse-uuid";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await currentUser();
    if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = parseUuid(params.id);

    const template = await prisma.templates.findUnique({
      where: { id },
    });
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const updateData: Record<string, any> = {};

    // Handle preview image upload — SECURITY (C10): magic-byte verification
    const previewImage = formData.get("previewImage") as File;
    if (previewImage && previewImage.size > 0) {
      const buffer = Buffer.from(await previewImage.arrayBuffer());
      const sanitizedName = previewImage.name
        .replace(/\.\.\//g, "")
        .replace(/\.\.\\/g, "")
        .replace(/[/\\]/g, "_")
        .slice(0, 200);
      const validation = await validateUploadBuffer(
        buffer,
        previewImage.type,
        sanitizedName,
        { maxSize: 5 * 1024 * 1024 },
      );
      if (!validation.valid) {
        return NextResponse.json(
          { error: `Preview image: ${validation.error}` },
          { status: 400 },
        );
      }
      const fileName = `template-preview-${template.slug}-${Date.now()}-${sanitizedName}`;
      const s3Key = await uploadFile(
        buffer,
        fileName,
        previewImage.type || undefined,
      );
      updateData.previewUrl = s3Key;
      updateData.thumbnailUrl = s3Key;
    }

    // Handle optional text fields — length-cap before persisting
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    if (name) updateData.name = name.slice(0, 200);
    if (description) updateData.description = description.slice(0, 5000);

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    updateData.updatedAt = new Date();

    await prisma.templates.update({
      where: { id },
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
    return apiError(error, {
      route: "super-admin.templates.update",
      status: 500,
      safeMessage: "Failed to update template",
    });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await currentUser();
    if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = parseUuid(params.id);

    const template = await prisma.templates.findUnique({
      where: { id },
    });
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const body = await req.json();

    if (typeof body.isActive === "boolean") {
      await prisma.templates.update({
        where: { id },
        data: { isActive: body.isActive, updatedAt: new Date() },
      });

      const email = user.emailAddresses[0]?.emailAddress;
      await createAuditLog({
        action: body.isActive ? AUDIT_ACTIONS.TEMPLATE.UPDATED : AUDIT_ACTIONS.TEMPLATE.UPDATED,
        entityType: "template",
        entityId: id,
        userId: user.id,
        userEmail: email!,
        metadata: {
          templateName: template.name,
          action: body.isActive ? "activated" : "deactivated",
        },
      });

      return NextResponse.json({
        success: true,
        message: `Template "${template.name}" ${body.isActive ? "activated" : "deactivated"}`,
        isActive: body.isActive,
      });
    }

    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  } catch (error: any) {
    console.error("[Template PATCH] Error:", error);
    return apiError(error, {
      route: "super-admin.templates.patch",
      status: 500,
      safeMessage: "Failed to update template",
    });
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

    const templateId = parseUuid(params.id);

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

    // Two flags for two distinct decisions:
    //   force=true                        → proceed even if tenants reference this base
    //   cascadeTenantTemplates=true       → ALSO delete the tenants' cloned tenant_templates rows
    //                                        (this is destructive — it removes the operator's
    //                                         work, which once cloned is theirs).
    // Without cascadeTenantTemplates the route refuses to delete a base template that has
    // tenant clones, because the FK constraint would block the delete and we MUST NOT
    // silently wipe operator data. Caller must clean up clones first or pass the flag.
    // Incident 2026-04-29: prior version cascaded by default and wiped LekkerWeed clone.
    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";
    const cascadeTenantTemplates = searchParams.get("cascadeTenantTemplates") === "true";

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
      `[Template Delete] Deleting template: ${template.name} (${template.slug})${force ? ' (FORCE)' : ''}${cascadeTenantTemplates ? ' (CASCADE-TENANT-TEMPLATES)' : ''}`,
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

    // Tenant clones are owned by the tenant once cloned. Deleting the base template
    // does NOT remove the tenant's data unless the caller EXPLICITLY opts in via
    // cascadeTenantTemplates=true. Without that flag, refuse the delete with 409 so
    // the caller has to acknowledge the destruction.
    //
    // TODO: schema migration to make tenant_templates.baseTemplateId nullable with
    // onDelete: SetNull, then this branch can null the FK and let the base be
    // deleted while preserving the clone.
    if (template._count.tenant_templates > 0 && !cascadeTenantTemplates) {
      const cloneSummary = template.tenant_templates.map((tt: any) => ({
        tenantTemplateId: tt.id,
        templateName: tt.templateName,
        tenantId: tt.activeForTenant?.id,
        businessName: tt.activeForTenant?.businessName,
      }));
      return NextResponse.json(
        {
          error:
            `REFUSED: deleting this base template would leave ${template._count.tenant_templates} tenant clone(s) with a dangling baseTemplateId FK, ` +
            `or — if you pass cascadeTenantTemplates=true — wipe those clones (which are owned by the tenant). ` +
            `Either delete the clones manually first, or pass ?force=true&cascadeTenantTemplates=true to opt into the destructive cascade.`,
          tenantClones: cloneSummary,
        },
        { status: 409 },
      );
    }

    if (template._count.tenant_templates > 0 && cascadeTenantTemplates) {
      console.log(
        `[Template Delete] CASCADE: deleting ${template._count.tenant_templates} tenant_templates that reference this base template (caller passed cascadeTenantTemplates=true)`,
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
    return apiError(error, {
      route: "super-admin.templates.delete",
      status: 500,
      safeMessage: "Failed to delete template",
    });
  }
}
