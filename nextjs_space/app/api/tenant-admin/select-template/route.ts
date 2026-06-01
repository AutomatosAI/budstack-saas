import { NextResponse } from "next/server";
import { withTenantAuth } from "@/lib/api-auth";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readFile } from "fs/promises";
import { join } from "path";
import { apiError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";

const selectTemplateSchema = z
  .object({
    templateId: z.string().min(1).max(200),
  })
  .strict();

export const POST = withTenantAuth(async (request, { tenantId }) => {
  try {
    const { templateId } = await parseJsonBody(request, selectTemplateSchema);

    // Verify template exists and is active
    const template = await prisma.templates.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    if (!template.isActive) {
      return NextResponse.json(
        { error: "Template is not active" },
        { status: 400 },
      );
    }

    // Load template defaults
    let templateDefaults: any = {};
    if (template.slug) {
      try {
        const defaultsPath = join(
          process.cwd(),
          "templates",
          template.slug,
          "defaults.json",
        );
        const defaultsContent = await readFile(defaultsPath, "utf-8");
        templateDefaults = JSON.parse(defaultsContent);
        console.log(`Loaded defaults for template ${template.slug}`);
      } catch (error) {
        console.warn(
          `No defaults.json found for template ${template.slug}, using empty defaults`,
        );
      }
    }

    // Preserve tenant-specific uploaded content (logo, hero image)
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { settings: true }
    });

    const currentSettings = (tenant?.settings as any) || {};

    // Helper to determine if a path is a custom upload (not a template default)
    const isCustomUpload = (path: string | null | undefined): boolean => {
      if (!path) return false;
      // Custom uploads will be in uploads/ folder or S3 paths
      // Template defaults will be in /templates/ folder
      return path.includes("uploads/") || !path.startsWith("/templates/");
    };

    // Merge template defaults with preserved content
    // Template defaults are base, but ONLY preserve tenant uploads if they are custom files
    // Do NOT preserve old template-specific images when switching templates
    const newSettings = {
      ...templateDefaults,
      // Only preserve logo/hero if it's a custom upload, not a template-specific file
      ...(isCustomUpload(currentSettings.logoPath) && {
        logoPath: currentSettings.logoPath,
      }),
      ...(isCustomUpload(currentSettings.heroImagePath) && {
        heroImagePath: currentSettings.heroImagePath,
      }),
    };

    // Update tenant's template selection AND settings
    const updatedTenant = await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        templateId,
        settings: newSettings,
      },
    });

    // Increment template usage count
    await prisma.templates.update({
      where: { id: templateId },
      data: { usageCount: { increment: 1 } },
    });

    return NextResponse.json({
      success: true,
      message:
        "Template applied successfully. All settings have been reset to template defaults.",
      tenant: updatedTenant,
      appliedDefaults: templateDefaults,
    });
  } catch (error) {
    return apiError(error, {
      route: "POST /api/tenant-admin/select-template",
      safeMessage: "Internal server error",
    });
  }
});
