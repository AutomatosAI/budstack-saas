import { notFound } from "next/navigation";
import fs from "fs";
import path from "path";
import { TEMPLATE_COMPONENTS } from "@/lib/template-registry";
import { TemplateRenderer } from "@/components/template-renderer";
import { getJsonFromS3, getTextFromS3, getFileUrl } from "@/lib/s3";
import type { TemplateLayout } from "@/lib/types/template-layout";
import { Tenant } from "@/types/client";
import { TenantThemeProvider } from "@/components/tenant-theme-provider";
import PreviewToolbar from "./preview-toolbar";

export const dynamic = 'force-dynamic';

// Mock tenant for preview mode — no database needed
const mockTenant: Tenant = {
  id: "preview-000",
  businessName: "Your Business Name",
  slug: "preview",
  domain: null,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  subdomain: "preview",
  settings: {
    tagline: "Your Cannabis Tagline Here",
    pageContent: {
      home: {
        heroTitle: "Welcome to Your Store",
        heroSubtitle: "Premium Cannabis, Delivered to Your Door",
      },
      homeHeroTitle: "Welcome to Your Store",
      homeHeroSubtitle: "Premium Cannabis, Delivered to Your Door",
      homeHeroDescription:
        "Discover our curated selection of premium medical cannabis products, backed by expert guidance and delivered with care.",
      aboutMission:
        "We are dedicated to providing the highest quality medical cannabis products and personalized care for your wellness journey.",
    },
  },
};

function loadLocalDefaults(templateSlug: string): any | null {
  try {
    const defaultsPath = path.join(
      process.cwd(),
      "templates",
      templateSlug,
      "defaults.json"
    );
    if (fs.existsSync(defaultsPath)) {
      const raw = fs.readFileSync(defaultsPath, "utf-8");
      return JSON.parse(raw);
    }
  } catch {
    // defaults.json is optional
  }
  return null;
}

/** Only return the path if the file actually exists in /public */
function resolvePublicAsset(
  assetPath: string | null | undefined
): string | null {
  if (!assetPath) return null;
  if (!assetPath.startsWith("/")) return null;
  const fullPath = path.join(process.cwd(), "public", assetPath);
  return fs.existsSync(fullPath) ? assetPath : null;
}

export default async function TemplatePreviewPage({
  params,
}: {
  params: { templateSlug: string };
}) {
  const { templateSlug } = params;

  // PATH 1: Try data-driven template (layout.json in S3)
  let layout: TemplateLayout | null = null;
  let customCss: string | null = null;
  let defaults: any = null;

  try {
    layout = await getJsonFromS3<TemplateLayout>(`templates/${templateSlug}/layout.json`);
    if (layout) {
      customCss = await getTextFromS3(`templates/${templateSlug}/styles.css`);
      defaults = await getJsonFromS3(`templates/${templateSlug}/defaults.json`).catch(() => null);
    }
  } catch {
    // No layout.json in S3
  }

  if (layout) {
    console.log(`[preview] Loaded layout.json for "${templateSlug}":`, JSON.stringify({
      navigation: layout.navigation,
      footer: layout.footer,
      hasNavigationConfig: !!(layout as any).navigationConfig,
      hasFooterConfig: !!(layout as any).footerConfig,
      sectionCount: layout.sections?.length || 0,
      sectionTypes: (layout.sections || []).map(s => s.type),
      sectionVideoUrls: (layout.sections || [])
        .filter(s => s.config?.videoUrl)
        .map(s => ({ id: s.id, videoUrl: (s.config?.videoUrl as string)?.substring(0, 80) })),
      sectionImageUrls: (layout.sections || [])
        .filter(s => s.config?.imageUrl)
        .map(s => ({ id: s.id, type: s.type, imageUrl: (s.config?.imageUrl as string)?.substring(0, 80) })),
      defaultsHeroImagePath: defaults?.heroImagePath?.substring(0, 80) || null,
      defaultsLogoPath: defaults?.logoPath?.substring(0, 80) || null,
    }));
    const s3Prefix = `templates/${templateSlug}`;

    // Sign hero image from defaults
    let heroImageUrl: string | null = null;
    if (defaults?.heroImagePath) {
      const heroPath = defaults.heroImagePath;
      if (!heroPath.startsWith("http") && !heroPath.startsWith("/")) {
        try {
          // Absolute S3 keys (uploaded files) — sign directly without prefixing
          const isAbsolute = heroPath.startsWith('development/') || heroPath.startsWith('tenants/') || heroPath.startsWith('templates/');
          heroImageUrl = await getFileUrl(isAbsolute ? heroPath : `${s3Prefix}/${heroPath}`);
        } catch { /* fallback to null */ }
      } else {
        heroImageUrl = heroPath;
      }
    }

    // Sign logo from defaults
    let logoUrl: string | null = null;
    if (defaults?.logoPath) {
      const logoPath = defaults.logoPath;
      if (!logoPath.startsWith("http") && !logoPath.startsWith("/")) {
        try {
          const isAbsolute = logoPath.startsWith('development/') || logoPath.startsWith('tenants/') || logoPath.startsWith('templates/');
          logoUrl = await getFileUrl(isAbsolute ? logoPath : `${s3Prefix}/${logoPath}`);
        } catch { /* fallback to null */ }
      } else {
        logoUrl = logoPath;
      }
    }

    // Sign section-level asset URLs (top-level + nested arrays)
    if (layout.sections) {
      const topKeys = ["imageUrl", "videoUrl", "watermarkUrl", "rightImageUrl"] as const;

      function signAssetUrl(val: string, contentTypeHint?: string): Promise<string> {
        const isAbsoluteKey = val.startsWith('development/') || val.startsWith('tenants/') || val.startsWith('templates/');
        return getFileUrl(isAbsoluteKey ? val : `${s3Prefix}/${val}`, contentTypeHint);
      }

      const signingTasks: Array<{ target: any; key: string; promise: Promise<string> }> = [];

      for (const section of layout.sections) {
        // Top-level config keys
        for (const key of topKeys) {
          const val = section.config?.[key];
          if (val && typeof val === 'string' && !val.startsWith('http') && !val.startsWith('/')) {
            // For videoUrl keys without a file extension, hint the content type so the signed URL works
            const hint = key === 'videoUrl' && !/\.\w+$/.test(val) ? 'video/mp4' : undefined;
            signingTasks.push({ target: section.config, key, promise: signAssetUrl(val, hint) });
          }
        }
        // Nested arrays — sign any string value that looks like an S3 key
        if (section.config) {
          for (const arrKey of Object.keys(section.config)) {
            if (Array.isArray(section.config[arrKey])) {
              for (const item of section.config[arrKey]) {
                if (!item || typeof item !== 'object') continue;
                for (const itemKey of Object.keys(item)) {
                  const v = (item as any)[itemKey];
                  if (v && typeof v === 'string' && !v.startsWith('http') && !v.startsWith('/') && (v.includes('/') || v.match(/\.(png|jpg|jpeg|webp|svg|gif)$/i))) {
                    signingTasks.push({ target: item, key: itemKey, promise: signAssetUrl(v) });
                  }
                }
              }
            }
          }
        }
      }

      const results = await Promise.allSettled(signingTasks.map(t => t.promise));
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          signingTasks[i].target[signingTasks[i].key] = result.value;
        } else {
          console.error(`[preview] Failed to sign ${signingTasks[i].key}:`, result.reason);
        }
      });

      // Debug: log signed asset URLs
      for (const section of layout.sections) {
        if (section.config?.videoUrl) {
          console.log(`[preview] Section ${section.id} videoUrl after signing:`, section.config.videoUrl.substring(0, 120));
        }
        if (section.config?.imageUrl) {
          console.log(`[preview] Section ${section.id} imageUrl after signing:`, section.config.imageUrl.substring(0, 120));
        }
      }
    }

    console.log(`[preview] heroImageUrl from defaults:`, heroImageUrl?.substring(0, 100) || 'null');
    console.log(`[preview] logoUrl from defaults:`, logoUrl?.substring(0, 100) || 'null');

    const sectionProps = {
      tenant: { ...mockTenant, subdomain: mockTenant.slug },
      consultationUrl: "#consultation",
      productsUrl: "#products",
      contactUrl: "#contact",
      aboutUrl: "#about",
      heroImageUrl,
      logoUrl,
      designSystem: defaults?.designSystem || null,
      pageContent: defaults?.pageContent || {},
      navigation: defaults?.navigation || {},
      footer: defaults?.footer || {},
      valueProps: defaults?.valueProps || [],
    };

    return (
      <TenantThemeProvider
        tenant={mockTenant}
        tenantTemplate={
          defaults?.designSystem
            ? { designSystem: defaults.designSystem, customCss: null }
            : undefined
        }
      >
        <PreviewToolbar templateName={defaults?.template || templateSlug} />
        <TemplateRenderer
          layout={layout}
          sectionProps={sectionProps}
          customCss={customCss}
          renderChrome={true}
        />
      </TenantThemeProvider>
    );
  }

  // PATH 2: Legacy React template (bundled at build time)
  const TemplateComponent = TEMPLATE_COMPONENTS[templateSlug];
  if (!TemplateComponent) {
    notFound();
  }

  const localDefaults = loadLocalDefaults(templateSlug);

  const templateProps = {
    tenant: mockTenant,
    consultationUrl: "#consultation",
    productsUrl: "#products",
    contactUrl: "#contact",
    aboutUrl: "#about",
    heroImageUrl: resolvePublicAsset(localDefaults?.heroImagePath),
    logoUrl: resolvePublicAsset(localDefaults?.logoPath),
    designSystem: localDefaults?.designSystem || null,
    pageContent: localDefaults?.pageContent || null,
    navigation: localDefaults?.navigation || null,
    footer: localDefaults?.footer || null,
    posts: [],
  };

  return (
    <TenantThemeProvider
      tenant={mockTenant}
      tenantTemplate={
        localDefaults?.designSystem
          ? { designSystem: localDefaults.designSystem, customCss: null }
          : undefined
      }
    >
      <PreviewToolbar templateName={localDefaults?.template || templateSlug} />
      <TemplateComponent {...templateProps} />
    </TenantThemeProvider>
  );
}

export function generateMetadata({
  params,
}: {
  params: { templateSlug: string };
}) {
  return {
    title: `Preview: ${params.templateSlug} | BudStacks Templates`,
    description: `Template preview for ${params.templateSlug}`,
  };
}
