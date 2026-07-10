import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { apiError, apiValidationError } from "@/lib/api-error";
import { withTenantAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { uploadFile, getJsonFromS3 } from "@/lib/storage/s3";
import { validateUploadBuffer } from "@/lib/storage/upload-validation";
import { TenantSettings } from "@/lib/types";
import { parseTenantSettings } from "@/lib/tenant/tenant-settings";
import { deepMerge } from "@/lib/utils";
import { stripSignedUrls } from "@/lib/templates/strip-signed-urls";
import { hexToHsl } from "@/lib/color-utils";
import { logger } from "@/lib/logger";

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
      return apiError(new Error("Tenant not found"), { route: "PUT /api/tenant-admin/branding", status: 404, safeMessage: "Tenant not found" });
    }

    const formData = await req.formData();

    // Extract business name and settings JSON
    const businessName = formData.get("businessName") as string;
    const settingsJSON = formData.get("settings") as string;

    if (!settingsJSON) {
      return apiValidationError("Settings data is required", "PUT /api/tenant-admin/branding");
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
    // PRD-208: parse-on-read instead of casting the stored blob. Returns a typed
    // object (or {} on a malformed blob) without throwing into this handler.
    const currentSettings = parseTenantSettings(tenant.settings, {
      tenantId,
    });
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
        return apiValidationError(`Logo: ${validation.error}`, "PUT /api/tenant-admin/branding");
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
        return apiValidationError(`Hero image: ${validation.error}`, "PUT /api/tenant-admin/branding");
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
        return apiValidationError(`Favicon: ${validation.error}`, "PUT /api/tenant-admin/branding");
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
        return apiError(new Error("Template not found or does not belong to this tenant"), { route: "PUT /api/tenant-admin/branding", status: 403, safeMessage: "Template not found or does not belong to this tenant" });
      }
      saveTargetId = explicitTemplateId;
    }

    const activeTemplateId = saveTargetId;

    logger.info(`[branding] Save target`, {
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

      // S3 key prefixes tried (in order) when relativizing a signed URL
      // back to its object key — the tenant's own template path, then the
      // base marketplace template path it was cloned from. Reused by every
      // stripSignedUrls() call below (PRD-220 Part C).
      const assetKeyPrefixes: string[] = [
        currentTemplate?.s3Path?.replace(/\/+$/, ''),
        currentTemplate?.templates?.slug ? `templates/${currentTemplate.templates.slug}` : null,
      ].filter((p): p is string => Boolean(p));

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
        ...(settings.buttonHoverEffect ? { buttonHoverEffect: settings.buttonHoverEffect } : {}),
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
      // branding-form passes these implicitly within the "settings" blob.
      // PRD-208: these structural keys ARE in tenantSettingsSchema but typed as
      // `unknown` (their shape varies). Narrow to a local layout-transform view
      // instead of `as any`, so dynamic indexing below stays typed.
      const incomingSettings = settings as TenantSettings & {
        layoutSections?: unknown[];
        sectionConfigs?: Record<string, Record<string, unknown>>;
        sectionColorOverrides?: Record<string, Record<string, string>>;
        navigationStyle?: unknown;
        navigationConfig?: unknown;
        footerStyle?: unknown;
        footerConfig?: unknown;
      };
      const hasLayoutSections = Array.isArray(incomingSettings.layoutSections) && incomingSettings.layoutSections.length > 0;
      const hasSectionConfigs = incomingSettings.sectionConfigs && Object.keys(incomingSettings.sectionConfigs).length > 0;
      const hasSectionColorOverrides = incomingSettings.sectionColorOverrides && Object.keys(incomingSettings.sectionColorOverrides).length > 0;
      const hasNavFooterConfig = !!incomingSettings.navigationStyle || !!incomingSettings.navigationConfig
        || !!incomingSettings.footerStyle || !!incomingSettings.footerConfig;

      logger.info("[branding] Layout debug", {
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

        // Merge sections with sectionConfig overrides + color overrides.
        // Signed S3 URLs are stripped structurally below (stripSignedUrls),
        // not here — see PRD-220 Part C.
        const sectionColorOverrides: Record<string, Record<string, string>> =
          incomingSettings.sectionColorOverrides || {};
        const updatedSections = sourceSections.map((s: any) => {
          const mergedConfig = { ...s.config };

          // Apply sectionConfig overrides if present
          if (hasSectionConfigs && incomingSettings.sectionConfigs?.[s.id]) {
            Object.assign(mergedConfig, incomingSettings.sectionConfigs[s.id]);
          }

          // Merge per-section color overrides
          const colorOvr = sectionColorOverrides[s.id];
          const hasColorOverrides = colorOvr && Object.keys(colorOvr).some((k: string) => colorOvr[k]?.trim());

          return {
            ...s,
            config: mergedConfig,
            ...(hasColorOverrides ? { colorOverrides: colorOvr } : { colorOverrides: undefined }),
          };
        });

        // AC-C1: recursive walk rejects/strips signed URLs anywhere in the
        // assembled layout (sections, navigationConfig, footerConfig) —
        // replaces the old per-shape SECTION_ASSET_KEYS + array loops, which
        // missed nested objects and top-level nav/footer config entirely.
        const finalLayout = stripSignedUrls(
          {
            ...baseLayout,
            navigation: incomingSettings.navigationStyle || baseLayout.navigation || "NavDark",
            navigationConfig: incomingSettings.navigationConfig || baseLayout.navigationConfig || undefined,
            footer: incomingSettings.footerStyle || baseLayout.footer || "FooterSimple",
            footerConfig: incomingSettings.footerConfig || baseLayout.footerConfig || undefined,
            sections: updatedSections,
          },
          assetKeyPrefixes,
        );

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
          logger.info(`[branding] Auto-created s3Path: ${s3Path}`);

          // Copy ALL files from base template so tenant is fully self-contained
          if (baseSlug !== 'default') {
            const { copyS3Directory } = await import("@/lib/storage/s3");
            const sourcePrefix = `templates/${baseSlug}/`;
            const destPrefix = `${s3Path}/`;
            const filesCopied = await copyS3Directory(sourcePrefix, destPrefix);
            logger.info(`[branding] Copied ${filesCopied} files from ${sourcePrefix} to ${destPrefix}`);
          }
        }

        try {
          const { createS3Client, getBucketConfig } = await import("@/lib/storage/aws-config");
          const { PutObjectCommand } = await import("@aws-sdk/client-s3");
          const s3Client = await createS3Client();
          const { bucketName } = await getBucketConfig();

          logger.info("[branding] Writing layout.json to S3", { sectionCount: updatedSections.length });
          const layoutKey = `${s3Path}/layout.json`;
          await s3Client.send(
            new PutObjectCommand({
              Bucket: bucketName,
              Key: layoutKey,
              Body: Buffer.from(JSON.stringify(finalLayout, null, 2)),
              ContentType: "application/json",
            })
          );
          logger.info(`[branding] Successfully rewrote layout.json to ${layoutKey}`);
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

      logger.info("[branding] Saving designSystem", { designSystemKeys: Object.keys(newDesignSystem), colorKeys: Object.keys(newDesignSystem.colors || {}) });
      logger.info("[branding] Saving pageContent", { pageContentKeys: Object.keys(updateData.pageContent || {}) });

      // Update TenantTemplate — AC-C1: structurally strip any signed URL
      // (designSystem/pageContent/customCss are all walked, not just the
      // fields a per-shape list happened to anticipate).
      await prisma.tenant_templates.update({
        where: { id: activeTemplateId },
        data: stripSignedUrls(updateData, assetKeyPrefixes),
      });

      // ALSO update Tenant settings for fallback/consistency
      await prisma.tenants.update({
        where: { id: tenant.id },
        data: {
          businessName,
          settings: stripSignedUrls(settings, assetKeyPrefixes) as Prisma.InputJsonValue,
        },
      });
    } else {
      // Legacy behavior: Update only Tenant settings. No template context
      // yet, so no prefix to relativize against — stripSignedUrls still
      // strips the signature and falls back to the decoded full key.
      await prisma.tenants.update({
        where: { id: tenant.id },
        data: {
          businessName,
          settings: stripSignedUrls(settings, []) as Prisma.InputJsonValue,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Branding updated successfully",
    });
  } catch (error) {
    console.error("Error updating branding:", error);
    return apiError(error, { route: "PUT /api/tenant-admin/branding", safeMessage: "Failed to update branding" });
  }
});

// Keep POST for backwards compatibility
export const POST = withTenantAuth(async (req) => {
  return PUT(req);
});

