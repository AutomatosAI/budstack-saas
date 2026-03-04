import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import { uploadFile, getJsonFromS3 } from "@/lib/s3";
import { TenantSettings } from "@/lib/types";
import { deepMerge } from "@/lib/utils";

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

    // Accept optional templateId override — allows saving to non-active templates (e.g. blank canvas drafts)
    const explicitTemplateId = formData.get("templateId") as string | null;
    let saveTargetId = tenant.activeTenantTemplateId;

    if (explicitTemplateId) {
      // Validate the template belongs to this tenant
      const targetTemplate = await prisma.tenant_templates.findFirst({
        where: { id: explicitTemplateId, tenantId: tenant.id },
      });
      if (!targetTemplate) {
        return NextResponse.json(
          { error: "Template not found or does not belong to this tenant" },
          { status: 403 },
        );
      }
      saveTargetId = explicitTemplateId;
    }

    const activeTemplateId = saveTargetId;

    if (activeTemplateId) {
      // Fetch current template (with base template for slug-based URL fallback)
      const currentTemplate = await prisma.tenant_templates.findUnique({
        where: { id: activeTemplateId },
        include: { templates: true },
      });

      const currentDS = currentTemplate?.designSystem || {};

      // Helper: only include defined, non-empty values (prevents overriding template CSS vars with empty strings)
      const defined = (obj: Record<string, any>) =>
        Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''));

      // Merge new settings into Design System — preserve ALL existing keys (primary-scale, gradients, custom shadows, etc.)
      const colorOverrides = defined({
        primary: settings.primaryColor,
        secondary: settings.secondaryColor,
        accent: settings.accentColor,
        background: settings.backgroundColor,
        text: settings.textColor,
        heading: settings.headingColor,
      });
      const typoOverrides = defined({
        body: settings.fontFamily,
        heading: settings.headingFontFamily,
      });
      const fontSizeOverrides = defined({
        base: settings.fontSize,
      });

      // Font weight overrides
      const fontWeightOverrides = defined({
        body: settings.fontWeight,
        heading: settings.headingFontWeight,
      });

      const newDesignSystem = deepMerge(currentDS, {
        ...(Object.keys(colorOverrides).length > 0 ? { colors: colorOverrides } : {}),
        ...(Object.keys(typoOverrides).length > 0 || Object.keys(fontSizeOverrides).length > 0 || Object.keys(fontWeightOverrides).length > 0 ? {
          typography: {
            ...(Object.keys(typoOverrides).length > 0 ? { fontFamily: typoOverrides } : {}),
            ...(Object.keys(fontSizeOverrides).length > 0 ? { fontSize: fontSizeOverrides } : {}),
            ...(Object.keys(fontWeightOverrides).length > 0 ? { fontWeight: fontWeightOverrides } : {}),
            ...(settings.letterSpacingPreset ? { letterSpacing: settings.letterSpacingPreset } : {}),
          },
        } : {}),
        ...(settings.borderRadius || settings.buttonStyle ? {
          borderRadius: defined({ container: settings.borderRadius, button: settings.buttonStyle }),
        } : {}),
        ...(settings.buttonSize ? { button: defined({ size: settings.buttonSize }) } : {}),
        ...(settings.spacing ? { spacing: defined({ scale: settings.spacing }) } : {}),
        ...(settings.shadowStyle ? { shadows: defined({ card: settings.shadowStyle }) } : {}),
        // Premium design features — store in designSystem for round-trip
        ...(settings.glassEffect ? { glassEffect: settings.glassEffect } : {}),
        ...(settings.animationType ? { animationType: settings.animationType } : {}),
        ...(settings.dividerStyle ? { dividerStyle: settings.dividerStyle } : {}),
        ...((settings as any).buttonHoverEffect ? { buttonHoverEffect: (settings as any).buttonHoverEffect } : {}),
      });

      // Handle file uploads for template
      const updateData: any = {
        designSystem: newDesignSystem,
      };

      // Only overwrite customCss if the form actually sent a value (prevents wiping S3 styles.css)
      if (settings.customCSS !== undefined && settings.customCSS !== null) {
        updateData.customCss = settings.customCSS;
      }

      // Handle layout changes (sections array & config overrides)
      // branding-form passes these implicitly within the "settings" blob
      const incomingSettings = settings as any;
      const hasLayoutSections = Array.isArray(incomingSettings.layoutSections) && incomingSettings.layoutSections.length > 0;
      const hasSectionConfigs = incomingSettings.sectionConfigs && Object.keys(incomingSettings.sectionConfigs).length > 0;

      if (hasLayoutSections || hasSectionConfigs) {
        // Read existing layout from S3 so we preserve navigation, footer, settings keys
        let baseLayout: any = {};
        if (currentTemplate?.s3Path) {
          try {
            baseLayout = await getJsonFromS3(`${currentTemplate.s3Path}/layout.json`);
          } catch {
            baseLayout = {};
          }
        }

        // Use incoming sections if provided, otherwise keep existing sections from S3
        const sourceSections = hasLayoutSections
          ? incomingSettings.layoutSections
          : (baseLayout.sections || []);

        // Merge sections with config overrides, stripping signed S3 URLs back to relative paths
        const updatedSections = sourceSections.map((s: any) => {
          const mergedConfig = { ...s.config };

          // Apply sectionConfig overrides if present
          if (hasSectionConfigs && incomingSettings.sectionConfigs[s.id]) {
            Object.assign(mergedConfig, incomingSettings.sectionConfigs[s.id]);
          }

          // Strip signed S3 URLs back to raw S3 keys so layout.json stays portable.
          // page.tsx signs keys on load; we must reverse that before writing back.
          for (const key of ['imageUrl', 'videoUrl', 'watermarkUrl'] as const) {
            const val = mergedConfig[key];
            if (val && typeof val === 'string' && val.startsWith('http')) {
              const urlWithoutQuery = val.split('?')[0];

              // Try to extract the S3 key from the URL.
              // S3 URLs look like: https://{bucket}.s3.{region}.amazonaws.com/{key}
              const s3Match = urlWithoutQuery.match(/\.amazonaws\.com\/(.+)$/);
              if (s3Match) {
                const fullKey = decodeURIComponent(s3Match[1]);

                // Try to make template-relative (for template assets)
                const prefixes = [
                  currentTemplate?.s3Path,
                  currentTemplate?.templates?.slug ? `templates/${currentTemplate.templates.slug}` : null,
                ].filter(Boolean) as string[];

                let madeRelative = false;
                for (const prefix of prefixes) {
                  const idx = fullKey.indexOf(prefix);
                  if (idx !== -1) {
                    const relativePath = fullKey.slice(idx + prefix.length + 1);
                    if (relativePath && !relativePath.includes('//')) {
                      mergedConfig[key] = relativePath;
                      madeRelative = true;
                      break;
                    }
                  }
                }

                // For uploaded files (development/uploads/...), store the raw S3 key
                if (!madeRelative) {
                  mergedConfig[key] = fullKey;
                }
              }
            }
          }

          return { ...s, config: mergedConfig };
        });

        const finalLayout = {
          ...baseLayout,
          navigation: baseLayout.navigation || "NavDark",
          footer: baseLayout.footer || "FooterSimple",
          sections: updatedSections,
        };

        if (currentTemplate?.s3Path) {
          try {
            const { createS3Client, getBucketConfig } = await import("@/lib/aws-config");
            const { PutObjectCommand } = await import("@aws-sdk/client-s3");
            const s3Client = await createS3Client();
            const { bucketName } = await getBucketConfig();

            const layoutKey = `${currentTemplate.s3Path}/layout.json`;
            await s3Client.send(
              new PutObjectCommand({
                Bucket: bucketName,
                Key: layoutKey,
                Body: Buffer.from(JSON.stringify(finalLayout, null, 2)),
                ContentType: "application/json",
              })
            );
            console.log(`[branding] Successfully rewrote layout.json to ${layoutKey}`);
          } catch (s3Error) {
            console.error("[branding] Failed to rewrite layout.json to S3:", s3Error);
          }
        }
      }

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

      console.log("[branding] Saving designSystem keys:", Object.keys(newDesignSystem), "color keys:", Object.keys(newDesignSystem.colors || {}));
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

