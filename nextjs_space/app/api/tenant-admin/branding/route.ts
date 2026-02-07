import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/s3";
import { TenantSettings } from "@/lib/types";

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (
      !user ||
      (user.role !== "TENANT_ADMIN" &&
        user.role !== "SUPER_ADMIN")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: "No tenant associated with user" }, { status: 403 });
    }

    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const formData = await req.formData();

    // Extract business name and settings JSON
    const businessName = formData.get("businessName") as string;
    const settingsJSON = formData.get("settings") as string;

    if (!settingsJSON) {
      return NextResponse.json(
        { error: "Settings data is required" },
        { status: 400 },
      );
    }

    const settings: TenantSettings = JSON.parse(settingsJSON);

    // Handle file uploads
    const logo = formData.get("logo") as File;
    if (logo && logo.size > 0) {
      const buffer = Buffer.from(await logo.arrayBuffer());
      const fileName = `logo-${Date.now()}-${logo.name}`;
      settings.logoPath = await uploadFile(buffer, fileName);
    }

    const heroImage = formData.get("heroImage") as File;
    if (heroImage && heroImage.size > 0) {
      const buffer = Buffer.from(await heroImage.arrayBuffer());
      const fileName = `hero-${Date.now()}-${heroImage.name}`;
      settings.heroImagePath = await uploadFile(buffer, fileName);
    }

    const favicon = formData.get("favicon") as File;
    if (favicon && favicon.size > 0) {
      const buffer = Buffer.from(await favicon.arrayBuffer());
      const fileName = `favicon-${Date.now()}-${favicon.name}`;
      settings.faviconPath = await uploadFile(buffer, fileName);
    }

    // Check for active template
    const activeTemplateId = tenant.activeTenantTemplateId;

    if (activeTemplateId) {
      // Fetch current template to get existing designSystem
      const currentTemplate = await prisma.tenant_templates.findUnique({
        where: { id: activeTemplateId },
      });

      const currentDS = currentTemplate?.designSystem || {};

      // Helper: only include defined, non-empty values (prevents overriding template CSS vars with empty strings)
      const defined = (obj: Record<string, any>) =>
        Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''));

      // Merge new settings into Design System structure
      const newDesignSystem = {
        ...currentDS,
        colors: {
          ...currentDS.colors,
          ...defined({
            primary: settings.primaryColor,
            secondary: settings.secondaryColor,
            accent: settings.accentColor,
            background: settings.backgroundColor,
            text: settings.textColor,
            heading: settings.headingColor,
          }),
        },
        typography: {
          ...currentDS.typography,
          fontFamily: {
            ...currentDS.typography?.fontFamily,
            ...defined({
              body: settings.fontFamily,
              heading: settings.headingFontFamily,
            }),
          },
          fontSize: {
            ...currentDS.typography?.fontSize,
            ...defined({
              base: settings.fontSize,
            }),
          },
        },
        borderRadius: {
          ...currentDS.borderRadius,
          ...defined({
            container: settings.borderRadius,
            button: settings.buttonStyle,
          }),
        },
        spacing: {
          ...currentDS.spacing,
          ...defined({
            scale: settings.spacing,
          }),
        },
        shadows: {
          ...currentDS.shadows,
          ...defined({
            card: settings.shadowStyle,
          }),
        },
      };

      // Handle file uploads for template
      const updateData: any = {
        designSystem: newDesignSystem,
        customCss: settings.customCSS,
      };

      // Handle file mapping
      if (settings.logoPath) updateData.logoUrl = settings.logoPath;
      if (settings.heroImagePath)
        updateData.heroImageUrl = settings.heroImagePath;
      if (settings.faviconPath) updateData.faviconUrl = settings.faviconPath;

      // Merge pageContent instead of replacing — preserve template defaults
      if (settings.pageContent) {
        const currentPageContent = (currentTemplate?.pageContent as any) || {};
        updateData.pageContent = deepMerge(currentPageContent, settings.pageContent);
      }

      console.log("[branding] Saving designSystem colors:", JSON.stringify(newDesignSystem.colors, null, 2));
      console.log("[branding] Saving pageContent keys:", Object.keys(updateData.pageContent || {}));

      // Update TenantTemplate
      await prisma.tenant_templates.update({
        where: { id: activeTemplateId },
        data: updateData,
      });

      // ALSO update Tenant settings for fallback/consistency
      await prisma.tenants.update({
        where: { id: tenant.id },
        data: {
          businessName,
          settings: settings as any,
        },
      });
    } else {
      // Legacy behavior: Update only Tenant settings
      await prisma.tenants.update({
        where: { id: tenant.id },
        data: {
          businessName,
          settings: settings as any,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Branding updated successfully",
    });
  } catch (error) {
    console.error("Error updating branding:", error);
    return NextResponse.json(
      {
        error: "Failed to update branding",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// Keep POST for backwards compatibility
export async function POST(req: NextRequest) {
  return PUT(req);
}

/** Deep merge objects — target values win over source, but only if non-empty */
function deepMerge(source: any, target: any): any {
  if (!source) return target;
  if (!target) return source;
  const result = { ...source };
  for (const key of Object.keys(target)) {
    const val = target[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      result[key] = deepMerge(source[key], val);
    } else if (val !== undefined && val !== null && val !== '') {
      result[key] = val;
    }
    // Skip empty/undefined values — keeps source intact
  }
  return result;
}
