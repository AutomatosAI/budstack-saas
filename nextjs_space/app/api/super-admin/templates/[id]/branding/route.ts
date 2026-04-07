import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getJsonFromS3, uploadFile } from "@/lib/s3";
import { createS3Client, getBucketConfig } from "@/lib/aws-config";
import { PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * Super Admin Marketplace Template Branding API
 *
 * Saves branding changes directly to the base template in S3
 * (templates/{slug}/layout.json + defaults.json), making them
 * the marketplace default for all new tenants who clone this template.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();

    if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const template = await prisma.templates.findUnique({
      where: { id: params.id },
    });

    if (!template || !template.slug) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const s3Prefix = `templates/${template.slug}`;
    const formData = await req.formData();
    const settingsJSON = formData.get("settings") as string;
    const businessName = formData.get("businessName") as string;

    if (!settingsJSON) {
      return NextResponse.json({ error: "Settings data required" }, { status: 400 });
    }

    const settings: any = JSON.parse(settingsJSON);
    const s3Client = await createS3Client();
    const { bucketName } = await getBucketConfig();

    // Handle file uploads
    const uploadAsset = async (fieldName: string, prefix: string): Promise<string | null> => {
      const file = formData.get(fieldName) as File;
      if (!file || file.size === 0) return null;
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = `${prefix}-${Date.now()}-${file.name}`;
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
    const fontSizeOverrides = defined({ base: settings.fontSize });
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

    let updatedLayout = existingLayout;

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

        // Strip signed S3 URLs back to raw S3 keys
        const stripSignedUrl = (val: string): string => {
          if (!val || typeof val !== 'string' || !val.startsWith('http')) return val;
          const s3Match = val.split('?')[0].match(/\.amazonaws\.com\/(.+)$/);
          if (!s3Match) return val;
          const fullKey = decodeURIComponent(s3Match[1]);
          const idx = fullKey.indexOf(s3Prefix);
          if (idx !== -1) {
            const relative = fullKey.slice(idx + s3Prefix.length + 1);
            if (relative && !relative.includes('//')) return relative;
          }
          return fullKey;
        };

        // Top-level asset keys
        for (const key of ['imageUrl', 'videoUrl', 'watermarkUrl', 'rightImageUrl'] as const) {
          if (mergedConfig[key]) mergedConfig[key] = stripSignedUrl(mergedConfig[key]);
        }

        // Nested arrays (e.g. categories[].imageUrl, logos[].src)
        for (const key of Object.keys(mergedConfig)) {
          if (Array.isArray(mergedConfig[key])) {
            mergedConfig[key] = mergedConfig[key].map((item: any) => {
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

        const colorOvr = sectionColorOverrides[s.id];
        const hasColorOvr = colorOvr && Object.keys(colorOvr).some((k: string) => colorOvr[k]?.trim());

        return {
          ...s,
          config: mergedConfig,
          ...(hasColorOvr ? { colorOverrides: colorOvr } : { colorOverrides: undefined }),
        };
      });

      updatedLayout = {
        ...existingLayout,
        navigation: existingLayout.navigation || "NavDark",
        footer: existingLayout.footer || "FooterBrand",
        sections: updatedSections,
      };
    }

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

    await writeJson(`${s3Prefix}/layout.json`, updatedLayout);
    await writeJson(`${s3Prefix}/defaults.json`, updatedDefaults);

    console.log(`[super-admin] Saved marketplace template "${template.name}" (${template.slug}) to S3`);

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
    console.error("[super-admin] Marketplace template branding error:", error);
    return NextResponse.json(
      { error: "Failed to update template", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
