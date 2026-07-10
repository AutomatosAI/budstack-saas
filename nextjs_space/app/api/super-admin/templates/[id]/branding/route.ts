import { NextResponse } from "next/server";
import { withSuperAdminParams } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { getJsonFromS3, uploadFile } from "@/lib/storage/s3";
import { createS3Client, getBucketConfig } from "@/lib/storage/aws-config";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { stripSignedUrls } from "@/lib/templates/strip-signed-urls";
import { apiError, apiValidationError, ApiError } from "@/lib/api-error";
import { parseUuid } from "@/lib/validation/parse-uuid";
import { validateUploadBuffer } from "@/lib/storage/upload-validation";
import { logger } from "@/lib/logger";

/**
 * Super Admin Marketplace Template Branding API
 *
 * Saves branding changes directly to the base template in S3
 * (templates/{slug}/layout.json + defaults.json), making them
 * the marketplace default for all new tenants who clone this template.
 */
export const POST = withSuperAdminParams(async (req, _ctx, params) => {
  try {
    const id = parseUuid(params.id);
    const template = await prisma.templates.findUnique({
      where: { id },
    });

    if (!template || !template.slug) {
      return apiError(new Error("Template not found"), {
        route: "POST /api/super-admin/templates/[id]/branding",
        status: 404,
        safeMessage: "Template not found",
      });
    }

    const s3Prefix = `templates/${template.slug}`;
    const formData = await req.formData();
    const settingsJSON = formData.get("settings") as string;
    const businessName = formData.get("businessName") as string;

    if (!settingsJSON) {
      return apiValidationError(
        "Settings data required",
        "POST /api/super-admin/templates/[id]/branding",
      );
    }

    const settings: any = JSON.parse(settingsJSON);
    const s3Client = await createS3Client();
    const { bucketName } = await getBucketConfig();

    // Handle file uploads
    const uploadAsset = async (fieldName: string, prefix: string): Promise<string | null> => {
      const file = formData.get(fieldName) as File;
      if (!file || file.size === 0) return null;
      const buffer = Buffer.from(await file.arrayBuffer());
      const cleanName = file.name
        .replace(/\.\.\//g, "")
        .replace(/\.\.\\/g, "")
        .replace(/[/\\]/g, "_")
        .slice(0, 200);
      const validation = await validateUploadBuffer(buffer, file.type, cleanName);
      if (!validation.valid) {
        throw new ApiError(`${fieldName}: ${validation.error}`, 400);
      }
      const fileName = `${prefix}-${Date.now()}-${cleanName}`;
      return await uploadFile(buffer, fileName, file.type || undefined);
    };

    const newLogoPath = await uploadAsset("logo", "logo");
    const newHeroPath = await uploadAsset("heroImage", "hero");
    const newFaviconPath = await uploadAsset("favicon", "favicon");

    // ── Read existing S3 files ──────────────────────────────────
    let existingLayout: any = {};
    try {
      existingLayout = await getJsonFromS3(`${s3Prefix}/layout.json`) || {};
    } catch { existingLayout = {}; }

    let existingDefaults: any = {};
    try {
      existingDefaults = await getJsonFromS3(`${s3Prefix}/defaults.json`) || {};
    } catch { existingDefaults = {}; }

    // ── Build updated design system ─────────────────────────────
    const defined = (obj: Record<string, any>) =>
      Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''));

    const colorOverrides = defined({
      primary: settings.primaryColor,
      secondary: settings.secondaryColor,
      accent: settings.accentColor,
      background: settings.backgroundColor,
      text: settings.textColor,
      heading: settings.headingColor,
    });

    const currentDS = existingDefaults.designSystem || {};
    const newDesignSystem: any = { ...currentDS };

    if (Object.keys(colorOverrides).length > 0) {
      newDesignSystem.colors = { ...(currentDS.colors || {}), ...colorOverrides };
    }

    const typoOverrides = defined({ body: settings.fontFamily, heading: settings.headingFontFamily });
    const fontSizeOverrides = defined({ base: settings.fontSize, hero: settings.heroFontSize, section: settings.sectionFontSize });
    const fontWeightOverrides = defined({ body: settings.fontWeight, heading: settings.headingFontWeight });

    if (Object.keys(typoOverrides).length > 0 || Object.keys(fontSizeOverrides).length > 0 || Object.keys(fontWeightOverrides).length > 0) {
      newDesignSystem.typography = {
        ...(currentDS.typography || {}),
        ...(Object.keys(typoOverrides).length > 0 ? { fontFamily: { ...(currentDS.typography?.fontFamily || {}), ...typoOverrides } } : {}),
        ...(Object.keys(fontSizeOverrides).length > 0 ? { fontSize: { ...(currentDS.typography?.fontSize || {}), ...fontSizeOverrides } } : {}),
        ...(Object.keys(fontWeightOverrides).length > 0 ? { fontWeight: { ...(currentDS.typography?.fontWeight || {}), ...fontWeightOverrides } } : {}),
        ...(settings.letterSpacingPreset ? { letterSpacing: settings.letterSpacingPreset } : {}),
      };
    }

    if (settings.borderRadius || settings.buttonStyle) {
      newDesignSystem.borderRadius = { ...(currentDS.borderRadius || {}), ...defined({ container: settings.borderRadius, button: settings.buttonStyle }) };
    }
    if (settings.buttonSize) newDesignSystem.button = { ...(currentDS.button || {}), size: settings.buttonSize };
    if (settings.spacing) newDesignSystem.spacing = { ...(currentDS.spacing || {}), scale: settings.spacing };
    if (settings.shadowStyle) newDesignSystem.shadows = { ...(currentDS.shadows || {}), card: settings.shadowStyle };
    if (settings.glassEffect) newDesignSystem.glassEffect = settings.glassEffect;
    if (settings.animationType) newDesignSystem.animationType = settings.animationType;
    if (settings.dividerStyle) newDesignSystem.dividerStyle = settings.dividerStyle;
    if (settings.buttonHoverEffect) newDesignSystem.buttonHoverEffect = settings.buttonHoverEffect;

    // ── Build updated defaults.json ─────────────────────────────
    const updatedDefaults = {
      ...existingDefaults,
      designSystem: newDesignSystem,
      ...(newLogoPath ? { logoPath: newLogoPath } : {}),
      ...(newHeroPath ? { heroImagePath: newHeroPath } : {}),
      ...(newFaviconPath ? { faviconPath: newFaviconPath } : {}),
    };

    // Merge page content
    if (settings.pageContent) {
      updatedDefaults.pageContent = { ...(existingDefaults.pageContent || {}), ...settings.pageContent };
    }

    // ── Handle layout sections ──────────────────────────────────
    const hasLayoutSections = Array.isArray(settings.layoutSections) && settings.layoutSections.length > 0;
    const hasSectionConfigs = settings.sectionConfigs && Object.keys(settings.sectionConfigs).length > 0;
    const hasSectionColorOverrides = settings.sectionColorOverrides && Object.keys(settings.sectionColorOverrides).length > 0;

    let updatedLayout = { ...existingLayout };

    // Always save navigation/footer type and config from the form
    if (settings.navigationStyle) {
      updatedLayout.navigation = settings.navigationStyle;
    } else if (!updatedLayout.navigation) {
      updatedLayout.navigation = "NavDark";
    }

    if (settings.footerStyle) {
      updatedLayout.footer = settings.footerStyle;
    } else if (!updatedLayout.footer) {
      updatedLayout.footer = "FooterBrand";
    }

    // Save navigation config (links, logo placement, etc.)
    if (settings.navigationConfig) {
      updatedLayout.navigationConfig = {
        ...(updatedLayout.navigationConfig || {}),
        ...settings.navigationConfig,
      };
    }
    // Merge nav color overrides into navigationConfig
    if (settings.navColorOverrides && Object.keys(settings.navColorOverrides).length > 0) {
      updatedLayout.navigationConfig = {
        ...(updatedLayout.navigationConfig || {}),
        colorOverrides: settings.navColorOverrides,
      };
    }

    // Save footer config (tagline, sections, disclaimer, etc.)
    if (settings.footerConfig) {
      updatedLayout.footerConfig = {
        ...(updatedLayout.footerConfig || {}),
        ...settings.footerConfig,
      };
    }
    // Merge footer color overrides into footerConfig
    if (settings.footerColorOverrides && Object.keys(settings.footerColorOverrides).length > 0) {
      updatedLayout.footerConfig = {
        ...(updatedLayout.footerConfig || {}),
        colorOverrides: settings.footerColorOverrides,
      };
    }

    if (hasLayoutSections || hasSectionConfigs || hasSectionColorOverrides) {
      const sourceSections = hasLayoutSections
        ? settings.layoutSections
        : (existingLayout.sections || []);

      const sectionColorOverrides = settings.sectionColorOverrides || {};
      const updatedSections = sourceSections.map((s: any) => {
        const mergedConfig = { ...s.config };

        if (hasSectionConfigs && settings.sectionConfigs[s.id]) {
          Object.assign(mergedConfig, settings.sectionConfigs[s.id]);
        }

        // Signed S3 URLs are stripped structurally below (stripSignedUrls),
        // not per-key here — see PRD-220 Part C.
        const colorOvr = sectionColorOverrides[s.id];
        const hasColorOvr = colorOvr && Object.keys(colorOvr).some((k: string) => colorOvr[k]?.trim());

        return {
          ...s,
          config: mergedConfig,
          ...(hasColorOvr ? { colorOverrides: colorOvr } : { colorOverrides: undefined }),
        };
      });

      updatedLayout.sections = updatedSections;
    }

    // Debug: log what we're about to save
    logger.info(`[super-admin] Saving layout.json`, {
      navigation: updatedLayout.navigation,
      footer: updatedLayout.footer,
      hasNavigationConfig: !!updatedLayout.navigationConfig,
      hasFooterConfig: !!updatedLayout.footerConfig,
      sectionCount: updatedLayout.sections?.length || 0,
      sectionTypes: (updatedLayout.sections || []).map((s: any) => s.type),
      sectionVideoUrls: (updatedLayout.sections || [])
        .filter((s: any) => s.config?.videoUrl)
        .map((s: any) => ({ id: s.id, videoUrl: s.config.videoUrl?.substring(0, 60) })),
    });

    // ── Write to S3 ─────────────────────────────────────────────
    const writeJson = async (key: string, data: any) => {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: Buffer.from(JSON.stringify(data, null, 2)),
          ContentType: "application/json",
        })
      );
    };

    // AC-C1: recursive walk rejects/strips signed URLs anywhere in the
    // persisted layout/defaults (sections, navigationConfig, footerConfig,
    // pageContent) — replaces the old per-shape SECTION_ASSET_KEYS + array
    // loops, which missed nested objects and nav/footer config entirely.
    await writeJson(`${s3Prefix}/layout.json`, stripSignedUrls(updatedLayout, [s3Prefix]));
    await writeJson(`${s3Prefix}/defaults.json`, stripSignedUrls(updatedDefaults, [s3Prefix]));

    logger.info(`[super-admin] Saved marketplace template "${template.name}" (${template.slug}) to S3`);

    // Update template name if changed
    if (businessName && businessName !== template.name) {
      await prisma.templates.update({
        where: { id: template.id },
        data: { name: businessName, updatedAt: new Date() },
      });
    } else {
      await prisma.templates.update({
        where: { id: template.id },
        data: { updatedAt: new Date() },
      });
    }

    return NextResponse.json({ success: true, message: "Marketplace template updated" });
  } catch (error) {
    return apiError(error, {
      route: "POST /api/super-admin/templates/[id]/branding",
      safeMessage: "Failed to update template",
    });
  }
});
