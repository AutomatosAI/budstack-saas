import { NextResponse } from "next/server";
import { withTenantAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { uploadFile, getJsonFromS3 } from "@/lib/s3";
import { validateUploadBuffer } from "@/lib/upload-validation";
import { TenantSettings } from "@/lib/types";
import { deepMerge } from "@/lib/utils";
import { SECTION_ASSET_KEYS } from "@/lib/types/template-layout";
import { hexToHsl } from "@/lib/color-utils";

/** Normalize a brand color input to raw HSL channels (`H S% L%`).
 *  Accepts hex (#rgb / #rrggbb), `hsl(...)` wrappers, or raw channels.
 *  TenantThemeProvider expects raw channels so that `hsl(var(--primary))`
 *  resolves correctly in shadcn components on store sub-pages. */
function toHslChannels(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("#")) return hexToHsl(trimmed);
  if (trimmed.startsWith("hsl(") && trimmed.endsWith(")")) {
    return trimmed.slice(4, -1).trim();
  }
  return trimmed;
}

export const PUT = withTenantAuth(async (req, { tenantId }) => {
  try {
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

    // SECURITY (C4): Strip server-managed keys from incoming settings to
    // close mass-assignment. A tenant admin must NEVER be able to overwrite
    // clerkOrgId via this endpoint — that field controls the Clerk org used
    // by /api/super-admin/tenants/[id] DELETE and other privileged paths.
    const SERVER_MANAGED_SETTINGS_KEYS = ["clerkOrgId"] as const;
    const incomingSettings = JSON.parse(settingsJSON) as Record<string, unknown>;
    for (const key of SERVER_MANAGED_SETTINGS_KEYS) {
      delete incomingSettings[key];
    }
    const currentSettings = (tenant.settings as Record<string, unknown>) || {};
    const preservedServerKeys = Object.fromEntries(
      SERVER_MANAGED_SETTINGS_KEYS.filter(
        (k) => currentSettings[k] !== undefined,
      ).map((k) => [k, currentSettings[k]]),
    );
    const settings: TenantSettings = {
      ...incomingSettings,
      ...preservedServerKeys,
    } as TenantSettings;

    // SECURITY (C10/H_u): Sanitize filenames + magic-byte buffer
    // verification on every upload. Without these a tenant admin could
    // claim an image MIME but ship an HTML/JS payload that a browser
    // would render when the signed URL is followed.
    const safeName = (raw: string) =>
      raw
        .replace(/\.\.\//g, "")
        .replace(/\.\.\\/g, "")
        .replace(/[/\\]/g, "_")
        .slice(0, 200);

    const tenantUploadPrefix = `tenants/${tenantId}/`;

    // Handle file uploads with server-side validation
    const logo = formData.get("logo") as File;
    if (logo && logo.size > 0) {
      const buffer = Buffer.from(await logo.arrayBuffer());
      const cleanName = safeName(logo.name);
      const validation = await validateUploadBuffer(
        buffer,
        logo.type,
        cleanName,
      );
      if (!validation.valid) {
        return NextResponse.json({ error: `Logo: ${validation.error}` }, { status: 400 });
      }
      const fileName = `logo-${Date.now()}-${cleanName}`;
      settings.logoPath = await uploadFile(
        buffer,
        fileName,
        logo.type || undefined,
        tenantUploadPrefix,
      );
    }

    const heroImage = formData.get("heroImage") as File;
    if (heroImage && heroImage.size > 0) {
      const buffer = Buffer.from(await heroImage.arrayBuffer());
      const cleanName = safeName(heroImage.name);
      const validation = await validateUploadBuffer(
        buffer,
        heroImage.type,
        cleanName,
      );
      if (!validation.valid) {
        return NextResponse.json({ error: `Hero image: ${validation.error}` }, { status: 400 });
      }
      const fileName = `hero-${Date.now()}-${cleanName}`;
      settings.heroImagePath = await uploadFile(
        buffer,
        fileName,
        heroImage.type || undefined,
        tenantUploadPrefix,
      );
    }

    const favicon = formData.get("favicon") as File;
    if (favicon && favicon.size > 0) {
      const buffer = Buffer.from(await favicon.arrayBuffer());
      const cleanName = safeName(favicon.name);
      const validation = await validateUploadBuffer(
        buffer,
        favicon.type,
        cleanName,
      );
      if (!validation.valid) {
        return NextResponse.json({ error: `Favicon: ${validation.error}` }, { status: 400 });
      }
      const fileName = `favicon-${Date.now()}-${cleanName}`;
      settings.faviconPath = await uploadFile(
        buffer,
        fileName,
        favicon.type || undefined,
        tenantUploadPrefix,
      );
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

    console.log(`[branding] Save target:`, {
      tenantId: tenant.id,
      tenantName: (tenant as any).businessName,
      activeTenantTemplateId: tenant.activeTenantTemplateId,
      explicitTemplateId,
      resolvedSaveTargetId: activeTemplateId,
      match: tenant.activeTenantTemplateId === activeTemplateId,
    });

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
      // Normalize to raw HSL channels so shadcn vars (--primary etc.)
      // work with hsl(var(--primary)) across every store sub-page.
      const colorOverrides = defined({
        primary: toHslChannels(settings.primaryColor),
        secondary: toHslChannels(settings.secondaryColor),
        accent: toHslChannels(settings.accentColor),
        background: toHslChannels(settings.backgroundColor),
        text: toHslChannels(settings.textColor),
        heading: toHslChannels(settings.headingColor),
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
        // Read existing layout from S3 — tenant's own path, no fallback
        const existingS3Path = currentTemplate?.s3Path?.replace(/\/+$/, '') || null;
        let baseLayout: any = {};
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
          for (const key of SECTION_ASSET_KEYS) {
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

        // Auto-generate s3Path if missing so layout sections can be saved.
        // Also copy ALL files from base template so the tenant is self-contained.
        let s3Path = currentTemplate?.s3Path?.replace(/\/+$/, '') || null;
        if (!s3Path) {
          const baseSlug = currentTemplate?.templates?.slug || 'default';
          s3Path = `tenants/${tenantId}/templates/${baseSlug}`;
          await prisma.tenant_templates.update({
            where: { id: activeTemplateId },
            data: { s3Path },
          });
          console.log(`[branding] Auto-created s3Path: ${s3Path}`);

          // Copy ALL files from base template so tenant is fully self-contained
          if (baseSlug !== 'default') {
            const { copyS3Directory } = await import("@/lib/s3");
            const sourcePrefix = `templates/${baseSlug}/`;
            const destPrefix = `${s3Path}/`;
            const filesCopied = await copyS3Directory(sourcePrefix, destPrefix);
            console.log(`[branding] Copied ${filesCopied} files from ${sourcePrefix} to ${destPrefix}`);
          }
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
      { error: "Failed to update branding" },
      { status: 500 },
    );
  }
});

// Keep POST for backwards compatibility
export const POST = withTenantAuth(async (req) => {
  return PUT(req);
});

