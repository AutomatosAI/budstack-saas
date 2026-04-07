import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import { uploadFile, getJsonFromS3 } from "@/lib/s3";
import { validateUpload } from "@/lib/upload-validation";
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

    // Handle file uploads with server-side validation
    const logo = formData.get("logo") as File;
    if (logo && logo.size > 0) {
      const validation = validateUpload(logo);
      if (!validation.valid) {
        return NextResponse.json({ error: `Logo: ${validation.error}` }, { status: 400 });
      }
      const buffer = Buffer.from(await logo.arrayBuffer());
      const fileName = `logo-${Date.now()}-${logo.name}`;
      settings.logoPath = await uploadFile(buffer, fileName, logo.type || undefined);
    }

    const heroImage = formData.get("heroImage") as File;
    if (heroImage && heroImage.size > 0) {
      const validation = validateUpload(heroImage);
      if (!validation.valid) {
        return NextResponse.json({ error: `Hero image: ${validation.error}` }, { status: 400 });
      }
      const buffer = Buffer.from(await heroImage.arrayBuffer());
      const fileName = `hero-${Date.now()}-${heroImage.name}`;
      settings.heroImagePath = await uploadFile(buffer, fileName, heroImage.type || undefined);
    }

    const favicon = formData.get("favicon") as File;
    if (favicon && favicon.size > 0) {
      const validation = validateUpload(favicon);
      if (!validation.valid) {
        return NextResponse.json({ error: `Favicon: ${validation.error}` }, { status: 400 });
      }
      const buffer = Buffer.from(await favicon.arrayBuffer());
      const fileName = `favicon-${Date.now()}-${favicon.name}`;
      settings.faviconPath = await uploadFile(buffer, fileName, favicon.type || undefined);
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
        hero: settings.heroFontSize,
        section: settings.sectionFontSize,
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
      const hasSectionColorOverrides = incomingSettings.sectionColorOverrides && Object.keys(incomingSettings.sectionColorOverrides).length > 0;
      const hasNavFooterConfig = !!incomingSettings.navigationStyle || !!incomingSettings.navigationConfig
        || !!incomingSettings.footerStyle || !!incomingSettings.footerConfig;

      console.log("[branding] Layout debug:", {
        hasLayoutSections,
        layoutSectionsCount: Array.isArray(incomingSettings.layoutSections) ? incomingSettings.layoutSections.length : "not-array",
        hasSectionConfigs,
        sectionConfigKeys: incomingSettings.sectionConfigs ? Object.keys(incomingSettings.sectionConfigs).length : 0,
        hasSectionColorOverrides,
        hasNavFooterConfig,
        s3Path: currentTemplate?.s3Path || "MISSING",
      });

      if (hasLayoutSections || hasSectionConfigs || hasSectionColorOverrides || hasNavFooterConfig) {
        // Read existing layout from S3 so we preserve navigation, footer, settings keys
        let baseLayout: any = {};
        const existingS3Path = currentTemplate?.s3Path
          || (currentTemplate?.templates?.slug ? `templates/${currentTemplate.templates.slug}` : null);
        if (existingS3Path) {
          try {
            baseLayout = await getJsonFromS3(`${existingS3Path}/layout.json`) || {};
          } catch {
            baseLayout = {};
          }
        }

        // Use incoming sections if provided, otherwise keep existing sections from S3
        const sourceSections = hasLayoutSections
          ? incomingSettings.layoutSections
          : (baseLayout.sections || []);

        // Merge sections with config overrides + color overrides, stripping signed S3 URLs back to relative paths
        const sectionColorOverrides = incomingSettings.sectionColorOverrides || {};
        const updatedSections = sourceSections.map((s: any) => {
          const mergedConfig = { ...s.config };

          // Apply sectionConfig overrides if present
          if (hasSectionConfigs && incomingSettings.sectionConfigs[s.id]) {
            Object.assign(mergedConfig, incomingSettings.sectionConfigs[s.id]);
          }

          // Strip signed S3 URLs back to raw S3 keys so layout.json stays portable.
          // page.tsx signs keys on load; we must reverse that before writing back.
          const stripSignedUrl = (val: string): string => {
            if (!val || typeof val !== 'string' || !val.startsWith('http')) return val;
            const urlWithoutQuery = val.split('?')[0];
            const s3Match = urlWithoutQuery.match(/\.amazonaws\.com\/(.+)$/);
            if (!s3Match) return val;
            const fullKey = decodeURIComponent(s3Match[1]);
            const prefixes = [
              currentTemplate?.s3Path,
              currentTemplate?.templates?.slug ? `templates/${currentTemplate.templates.slug}` : null,
            ].filter(Boolean) as string[];
            for (const prefix of prefixes) {
              const idx = fullKey.indexOf(prefix);
              if (idx !== -1) {
                const relativePath = fullKey.slice(idx + prefix.length + 1);
                if (relativePath && !relativePath.includes('//')) return relativePath;
              }
            }
            return fullKey;
          };

          // Strip top-level asset URLs
          for (const key of ['imageUrl', 'imageUrl2', 'imageUrl3', 'videoUrl', 'watermarkUrl', 'rightImageUrl'] as const) {
            if (mergedConfig[key]) mergedConfig[key] = stripSignedUrl(mergedConfig[key]);
          }

          // Strip signed URLs inside nested arrays (e.g. categories[].imageUrl, logos[].src)
          for (const key of Object.keys(mergedConfig)) {
            if (Array.isArray(mergedConfig[key])) {
              mergedConfig[key] = mergedConfig[key].map((item: any) => {
                // Handle flat string arrays (e.g. SocialProof avatars[])
                if (typeof item === 'string' && item.includes('.amazonaws.com/')) {
                  return stripSignedUrl(item);
                }
                if (!item || typeof item !== 'object') return item;
                const cleaned = { ...item };
                for (const itemKey of Object.keys(cleaned)) {
                  if (typeof cleaned[itemKey] === 'string' && cleaned[itemKey].includes('.amazonaws.com/')) {
                    cleaned[itemKey] = stripSignedUrl(cleaned[itemKey]);
                  }
                }
                return cleaned;
              });
            }
          }

          // Merge per-section color overrides
          const colorOvr = sectionColorOverrides[s.id];
          const hasColorOverrides = colorOvr && Object.keys(colorOvr).some(k => colorOvr[k]?.trim());

          return {
            ...s,
            config: mergedConfig,
            ...(hasColorOverrides ? { colorOverrides: colorOvr } : { colorOverrides: undefined }),
          };
        });

        const finalLayout = {
          ...baseLayout,
          navigation: incomingSettings.navigationStyle || baseLayout.navigation || "NavDark",
          navigationConfig: incomingSettings.navigationConfig || baseLayout.navigationConfig || undefined,
          footer: incomingSettings.footerStyle || baseLayout.footer || "FooterSimple",
          footerConfig: incomingSettings.footerConfig || baseLayout.footerConfig || undefined,
          sections: updatedSections,
        };

        // Auto-generate s3Path if missing so layout sections can be saved
        let s3Path = currentTemplate?.s3Path;
        if (!s3Path) {
          const folderPrefix = process.env.AWS_FOLDER_PREFIX || "";
          const timestamp = Date.now().toString();
          s3Path = `${folderPrefix}tenants/${tenantId}/templates/${timestamp}`;
          await prisma.tenant_templates.update({
            where: { id: activeTemplateId },
            data: { s3Path },
          });
          console.log(`[branding] Auto-created s3Path: ${s3Path}`);
        }

        try {
          const { createS3Client, getBucketConfig } = await import("@/lib/aws-config");
          const { PutObjectCommand } = await import("@aws-sdk/client-s3");
          const s3Client = await createS3Client();
          const { bucketName } = await getBucketConfig();

          console.log("[branding] Writing layout.json with", updatedSections.length, "sections to S3");
          const layoutKey = `${s3Path}/layout.json`;
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

