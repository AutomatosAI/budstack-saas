import { notFound } from "next/navigation";
import fs from "fs";
import path from "path";
import { TEMPLATE_COMPONENTS } from "@/lib/templates/template-registry";
import { TemplateRenderer } from "@/components/template-renderer";
import { getJsonFromS3, getTextFromS3, getFileUrl } from "@/lib/storage/s3";
import { isKeyInTenantScope } from "@/lib/storage/s3-tenant-guard";
import { getBucketConfig } from "@/lib/storage/aws-config";
import { SECTION_ASSET_KEYS, type TemplateLayout } from "@/lib/types/template-layout";
import { Tenant } from "@/types/client";
import { TenantThemeProvider } from "@/components/tenant-theme-provider";
import { prisma } from "@/lib/db";
import { getTemplateAssets } from "@/lib/tenant/tenant";
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

/**
 * Parse the previewed tenant id out of an already tenant-scoped s3Prefix
 * (e.g. `tenants/{id}/templates/{slug}` or `development/tenants/{id}/...`).
 * Returns null for non-tenant prefixes such as the marketplace
 * `templates/{slug}` base-template preview.
 */
function tenantIdFromPrefix(s3Prefix: string): string | null {
  return s3Prefix.match(/(?:^|\/)tenants\/([^/]+)\//)?.[1] ?? null;
}

/**
 * Sign an S3 key that came from (untrusted) template JSON.
 *
 * PRD-206 AC-4/AC-4a: an absolute value must NOT be signed verbatim — a
 * malicious or stale layout.json could point at `tenants/<other>/secret` to
 * exfiltrate another tenant's object. Relative values resolve under the
 * current preview's s3Prefix; the resolved key is then re-validated:
 *   - tenant preview → isKeyInTenantScope (US-002) against the previewed id
 *   - marketplace    → must stay within the previewed template prefix
 * Out-of-scope keys return null (skipped, never signed) so the rest of the
 * page still renders.
 */
async function signS3Path(
  val: string,
  s3Prefix: string,
  tenantId: string | null,
  contentTypeHint?: string,
): Promise<string | null> {
  // Never trust traversal/backslash from template JSON.
  if (val.includes('..') || val.includes('\\')) return null;

  const looksAbsolute =
    val.startsWith('development/') ||
    val.startsWith('tenants/') ||
    val.startsWith('templates/');
  const key = looksAbsolute ? val : `${s3Prefix}/${val}`;

  if (tenantId) {
    const { folderPrefix } = await getBucketConfig();
    if (!isKeyInTenantScope(key, tenantId, { folderPrefix })) return null;
    return getFileUrl(key, { tenantId, contentTypeHint });
  }

  // No tenant context (marketplace base-template preview): the resolved key
  // must stay within the previewed template prefix — reject absolute escapes.
  if (key !== s3Prefix && !key.startsWith(`${s3Prefix}/`)) return null;
  return getFileUrl(key, contentTypeHint);
}

/** Sign all asset URLs in layout sections */
async function signLayoutAssets(layout: TemplateLayout, s3Prefix: string) {
  if (!layout.sections) return;

  const tenantId = tenantIdFromPrefix(s3Prefix);
  const signingTasks: Array<{ target: any; key: string; promise: Promise<string | null> }> = [];

  for (const section of layout.sections) {
    for (const key of SECTION_ASSET_KEYS) {
      const val = section.config?.[key];
      if (val && typeof val === 'string' && !val.startsWith('http') && !val.startsWith('/')) {
        const hint = key === 'videoUrl' && !/\.\w+$/.test(val) ? 'video/mp4' : undefined;
        signingTasks.push({ target: section.config, key, promise: signS3Path(val, s3Prefix, tenantId, hint) });
      }
    }
    if (section.config) {
      for (const arrKey of Object.keys(section.config)) {
        if (Array.isArray(section.config[arrKey])) {
          for (let idx = 0; idx < section.config[arrKey].length; idx++) {
            const item = section.config[arrKey][idx];
            if (typeof item === 'string' && !item.startsWith('http') && !item.startsWith('/') && (item.includes('/') || item.match(/\.(png|jpg|jpeg|webp|svg|gif)$/i))) {
              signingTasks.push({ target: section.config[arrKey], key: String(idx), promise: signS3Path(item, s3Prefix, tenantId) });
              continue;
            }
            if (!item || typeof item !== 'object') continue;
            for (const itemKey of Object.keys(item)) {
              const v = (item as any)[itemKey];
              if (v && typeof v === 'string' && !v.startsWith('http') && !v.startsWith('/') && (v.includes('/') || v.match(/\.(png|jpg|jpeg|webp|svg|gif)$/i))) {
                signingTasks.push({ target: item, key: itemKey, promise: signS3Path(v, s3Prefix, tenantId) });
              }
            }
          }
        }
      }
    }
  }

  const results = await Promise.allSettled(signingTasks.map(t => t.promise));
  results.forEach((result, i) => {
    // Only overwrite when signing produced an in-scope URL. A null
    // (out-of-scope, dropped) or rejected task leaves the raw value untouched —
    // an unsigned key is never a usable cross-tenant URL, so it won't render.
    if (result.status === 'fulfilled' && result.value !== null) {
      signingTasks[i].target[signingTasks[i].key] = result.value;
    }
  });
}

/** Sign a defaults asset path (hero image or logo) */
async function signDefaultAsset(assetPath: string | undefined, s3Prefix: string): Promise<string | null> {
  if (!assetPath) return null;
  if (assetPath.startsWith("http") || assetPath.startsWith("/")) return assetPath;
  try {
    return await signS3Path(assetPath, s3Prefix, tenantIdFromPrefix(s3Prefix));
  } catch {
    return null;
  }
}

export default async function TemplatePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ templateSlug: string }>;
  searchParams: Promise<{ embed?: string; tenantTemplateId?: string }>;
}) {
  const { templateSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const isEmbed = resolvedSearchParams.embed === "true";
  const tenantTemplateId = resolvedSearchParams.tenantTemplateId;

  // ─── Tenant-specific preview (tenantTemplateId provided) ───
  // Loads the tenant's CUSTOMIZED template from DB + their S3 path. No fallback.
  if (tenantTemplateId) {
    const tenantTemplate = await prisma.tenant_templates.findUnique({
      where: { id: tenantTemplateId },
      include: { templates: true, tenant: true },
    });

    if (!tenantTemplate) {
      notFound();
    }

    const tenantS3Path = tenantTemplate.s3Path?.replace(/\/+$/, '') || null;

    console.log(`[preview] Tenant preview for tenantTemplateId=${tenantTemplateId}`, JSON.stringify({
      tenantS3Path,
      businessName: tenantTemplate.tenant?.businessName,
      dbLogoUrl: tenantTemplate.logoUrl?.substring(0, 80) || 'NULL',
      dbHeroImageUrl: tenantTemplate.heroImageUrl?.substring(0, 80) || 'NULL',
      hasDesignSystem: !!tenantTemplate.designSystem,
      hasPageContent: !!tenantTemplate.pageContent,
    }));

    // Load layout, defaults, CSS from tenant's own S3 path
    const { layout, defaults, customCss } = await getTemplateAssets(tenantS3Path);

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

    // Tenant's DB designSystem only — no merging with base template defaults
    const mergedDesignSystem = tenantTemplate.designSystem || null;
    if (!tenantS3Path) {
      console.error(`[preview] No s3Path for tenantTemplateId=${tenantTemplateId}`);
      notFound();
    }
    const s3Prefix = tenantS3Path;

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
    if (!tenantData) {
      console.error(`[preview] No tenant found for tenantTemplateId=${tenantTemplateId}`);
      notFound();
    }
    const previewTenant: Tenant = {
      id: tenantData.id,
      businessName: tenantData.businessName,
      slug: tenantData.subdomain,
      domain: tenantData.customDomain,
      isActive: tenantData.isActive,
      createdAt: tenantData.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: tenantData.updatedAt?.toISOString() || new Date().toISOString(),
      subdomain: tenantData.subdomain,
      settings: (tenantData.settings as any) || {},
    };

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

  // ─── Marketplace preview (no tenantTemplateId — base template only) ───
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

  // ─── Marketplace legacy React template (bundled at build time) ───
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ templateSlug: string }>;
}) {
  const { templateSlug } = await params;
  return {
    title: `Preview: ${templateSlug} | BudStacks Templates`,
    description: `Template preview for ${templateSlug}`,
  };
}
