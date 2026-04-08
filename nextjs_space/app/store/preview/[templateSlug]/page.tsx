import { notFound } from "next/navigation";
import fs from "fs";
import path from "path";
import { TEMPLATE_COMPONENTS } from "@/lib/template-registry";
import { TemplateRenderer } from "@/components/template-renderer";
import { getJsonFromS3, getTextFromS3, getFileUrl } from "@/lib/s3";
import { SECTION_ASSET_KEYS, type TemplateLayout } from "@/lib/types/template-layout";
import { Tenant } from "@/types/client";
import { TenantThemeProvider } from "@/components/tenant-theme-provider";
import { prisma } from "@/lib/db";
import { getTemplateAssets } from "@/lib/tenant";
import { deepMerge } from "@/lib/utils";
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

/** Sign an S3 key, handling both absolute and prefix-relative paths */
async function signS3Path(val: string, s3Prefix: string, contentTypeHint?: string): Promise<string> {
  const isAbsolute = val.startsWith('development/') || val.startsWith('tenants/') || val.startsWith('templates/');
  return getFileUrl(isAbsolute ? val : `${s3Prefix}/${val}`, contentTypeHint);
}

/** Sign all asset URLs in layout sections */
async function signLayoutAssets(layout: TemplateLayout, s3Prefix: string) {
  if (!layout.sections) return;

  const signingTasks: Array<{ target: any; key: string; promise: Promise<string> }> = [];

  for (const section of layout.sections) {
    for (const key of SECTION_ASSET_KEYS) {
      const val = section.config?.[key];
      if (val && typeof val === 'string' && !val.startsWith('http') && !val.startsWith('/')) {
        const hint = key === 'videoUrl' && !/\.\w+$/.test(val) ? 'video/mp4' : undefined;
        signingTasks.push({ target: section.config, key, promise: signS3Path(val, s3Prefix, hint) });
      }
    }
    if (section.config) {
      for (const arrKey of Object.keys(section.config)) {
        if (Array.isArray(section.config[arrKey])) {
          for (let idx = 0; idx < section.config[arrKey].length; idx++) {
            const item = section.config[arrKey][idx];
            if (typeof item === 'string' && !item.startsWith('http') && !item.startsWith('/') && (item.includes('/') || item.match(/\.(png|jpg|jpeg|webp|svg|gif)$/i))) {
              signingTasks.push({ target: section.config[arrKey], key: String(idx), promise: signS3Path(item, s3Prefix) });
              continue;
            }
            if (!item || typeof item !== 'object') continue;
            for (const itemKey of Object.keys(item)) {
              const v = (item as any)[itemKey];
              if (v && typeof v === 'string' && !v.startsWith('http') && !v.startsWith('/') && (v.includes('/') || v.match(/\.(png|jpg|jpeg|webp|svg|gif)$/i))) {
                signingTasks.push({ target: item, key: itemKey, promise: signS3Path(v, s3Prefix) });
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
    }
  });
}

/** Sign a defaults asset path (hero image or logo) */
async function signDefaultAsset(assetPath: string | undefined, s3Prefix: string): Promise<string | null> {
  if (!assetPath) return null;
  if (assetPath.startsWith("http") || assetPath.startsWith("/")) return assetPath;
  try {
    return await signS3Path(assetPath, s3Prefix);
  } catch {
    return null;
  }
}

export default async function TemplatePreviewPage({
  params,
  searchParams,
}: {
  params: { templateSlug: string };
  searchParams: { embed?: string; tenantTemplateId?: string };
}) {
  const { templateSlug } = params;
  const isEmbed = searchParams.embed === "true";
  const tenantTemplateId = searchParams.tenantTemplateId;

  // ─── PATH 0: Tenant-specific preview (tenantTemplateId provided) ───
  // Loads the tenant's CUSTOMIZED template from DB + their S3 path, with fallback to base template.
  // This is what tenant admins use — same preview tool as super admin but with their edits.
  if (tenantTemplateId) {
    const tenantTemplate = await prisma.tenant_templates.findUnique({
      where: { id: tenantTemplateId },
      include: { templates: true, tenant: true },
    });

    if (!tenantTemplate) {
      notFound();
    }

    const tenantS3Path = tenantTemplate.s3Path?.replace(/\/+$/, '') || null;
    const baseSlug = tenantTemplate.templates?.slug || templateSlug;
    const baseS3Path = `templates/${baseSlug}`;

    console.log(`[preview] Tenant preview for tenantTemplateId=${tenantTemplateId}`, JSON.stringify({
      tenantS3Path,
      baseS3Path,
      businessName: tenantTemplate.tenant?.businessName,
      dbLogoUrl: tenantTemplate.logoUrl?.substring(0, 80) || 'NULL',
      dbHeroImageUrl: tenantTemplate.heroImageUrl?.substring(0, 80) || 'NULL',
      hasDesignSystem: !!tenantTemplate.designSystem,
      hasPageContent: !!tenantTemplate.pageContent,
    }));

    // Load layout, defaults, CSS — same fallback logic as the live store
    const { layout, defaults, customCss } = await getTemplateAssets(tenantS3Path, baseS3Path);

    if (!layout) {
      console.error(`[preview] No layout.json found for tenantTemplateId=${tenantTemplateId}`);
      notFound();
    }

    console.log(`[preview] Loaded assets:`, JSON.stringify({
      layoutNav: layout.navigation,
      layoutNavConfigCta: (layout as any).navigationConfig?.cta || 'NONE',
      defaultsLogoPath: defaults?.logoPath?.substring(0, 80) || 'NULL',
      defaultsNavCta: defaults?.navigation?.cta || 'NONE',
      sectionCount: layout.sections?.length || 0,
    }));

    // Merge design system: base defaults + tenant overrides
    const mergedDesignSystem = deepMerge(defaults?.designSystem || null, tenantTemplate.designSystem || null);
    const s3Prefix = tenantS3Path || baseS3Path;

    // Sign section assets
    await signLayoutAssets(layout, s3Prefix);

    // Sign hero image — tenant DB first, then defaults
    let heroImageUrl: string | null = null;
    if (tenantTemplate.heroImageUrl) {
      heroImageUrl = await signDefaultAsset(tenantTemplate.heroImageUrl, s3Prefix);
    }
    if (!heroImageUrl) {
      heroImageUrl = await signDefaultAsset(defaults?.heroImagePath, s3Prefix);
    }

    // Sign logo — tenant DB first, then defaults
    let logoUrl: string | null = null;
    if (tenantTemplate.logoUrl) {
      logoUrl = await signDefaultAsset(tenantTemplate.logoUrl, s3Prefix);
    }
    if (!logoUrl) {
      logoUrl = await signDefaultAsset(defaults?.logoPath, s3Prefix);
    }

    console.log(`[preview] Resolved assets:`, JSON.stringify({
      logoUrl: logoUrl?.substring(0, 80) || 'NULL',
      logoSource: tenantTemplate.logoUrl ? 'DB' : (defaults?.logoPath ? 'defaults.json' : 'NONE'),
      heroImageUrl: heroImageUrl?.substring(0, 80) || 'NULL',
    }));

    const tenantData = tenantTemplate.tenant;
    const previewTenant: Tenant = tenantData
      ? {
          id: tenantData.id,
          businessName: tenantData.businessName,
          slug: tenantData.subdomain,
          domain: tenantData.customDomain,
          isActive: tenantData.isActive,
          createdAt: tenantData.createdAt?.toISOString() || new Date().toISOString(),
          updatedAt: tenantData.updatedAt?.toISOString() || new Date().toISOString(),
          subdomain: tenantData.subdomain,
          settings: (tenantData.settings as any) || {},
        }
      : { ...mockTenant, businessName: tenantTemplate.templates?.name || "Preview" };

    const sectionProps = {
      tenant: { ...previewTenant, subdomain: previewTenant.subdomain || previewTenant.slug || "preview" },
      consultationUrl: "#consultation",
      productsUrl: "#products",
      contactUrl: "#contact",
      aboutUrl: "#about",
      heroImageUrl,
      logoUrl,
      designSystem: mergedDesignSystem,
      pageContent: (tenantTemplate.pageContent as any) || defaults?.pageContent || {},
      navigation: defaults?.navigation || {},
      footer: defaults?.footer || {},
      valueProps: defaults?.valueProps || [],
    };

    return (
      <TenantThemeProvider
        tenant={previewTenant}
        tenantTemplate={
          mergedDesignSystem
            ? { designSystem: mergedDesignSystem, customCss: tenantTemplate.customCss || null }
            : undefined
        }
      >
        {!isEmbed && <PreviewToolbar templateName={previewTenant.businessName || templateSlug} />}
        <div className="preview-content">
          <TemplateRenderer
            layout={layout}
            sectionProps={sectionProps}
            customCss={customCss}
            renderChrome={true}
          />
        </div>
      </TenantThemeProvider>
    );
  }

  // ─── PATH 1: Base template preview (super admin / marketplace) ───
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
    const s3Prefix = `templates/${templateSlug}`;

    // Sign assets
    await signLayoutAssets(layout, s3Prefix);
    const heroImageUrl = await signDefaultAsset(defaults?.heroImagePath, s3Prefix);
    const logoUrl = await signDefaultAsset(defaults?.logoPath, s3Prefix);

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
        {!isEmbed && <PreviewToolbar templateName={defaults?.template || templateSlug} />}
        <div className="preview-content">
          <TemplateRenderer
            layout={layout}
            sectionProps={sectionProps}
            customCss={customCss}
            renderChrome={true}
          />
        </div>
      </TenantThemeProvider>
    );
  }

  // ─── PATH 2: Legacy React template (bundled at build time) ───
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
      {!isEmbed && <PreviewToolbar templateName={localDefaults?.template || templateSlug} />}
      <div className="preview-content">
        <TemplateComponent {...templateProps} />
      </div>
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
