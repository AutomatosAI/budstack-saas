import { notFound } from "next/navigation";
import { getCurrentTenant, getTenantWithTemplate, getTemplateAssets } from "@/lib/tenant/tenant";
import { getTenantUrl, getTenantBasePath, getTenantBaseUrl } from "@/lib/tenant/tenant-utils";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/storage/s3";
import { JsonLd } from "@/components/seo/json-ld";
import { buildStoreJsonLd, type StoreJsonLdSource } from "@/lib/seo/json-ld";
import { parseTenantSettings } from "@/lib/tenant/tenant-settings";

// Revalidate every 60 seconds — template/product data doesn't change frequently
// This avoids hitting S3 + DB on every single request
export const revalidate = 60;

// Import template registry (legacy React templates)
import { TEMPLATE_COMPONENTS } from "@/lib/templates/template-registry";

// Import section-based renderer (data-driven templates)
import { TemplateRenderer } from "@/components/template-renderer";
import { SECTION_ASSET_KEYS, type TemplateLayout } from "@/lib/types/template-layout";

// Import existing homepage components (fallback)
import { HeroSection } from "@/components/home/hero-section";
import { TrustBadges } from "@/components/home/trust-badges";
import { FeaturedConditions } from "@/components/home/featured-conditions";
import { ProcessSteps } from "@/components/home/process-steps";
import { EducationalContent } from "@/components/home/educational-content";
import { TestimonialsSlider } from "@/components/home/testimonials-slider";
import { CallToAction } from "@/components/home/call-to-action";
import { logger } from "@/lib/logger";

/**
 * SEO US-014 — the store home, with the structured data that identifies it.
 *
 * Both reads below are React-`cache()`d and are the SAME calls `StoreHomeContent`
 * and the layout already make, so the JSON-LD costs no extra query. It is
 * resolved HERE rather than inside the content function because that function
 * returns from four different template branches, and the identity nodes belong
 * on the homepage whichever one renders.
 *
 * Nothing here can block the store: `buildStoreJsonLd` returns [] for a Basic
 * tenant (and for a tenant with no name), and `<JsonLd>` renders nothing for [].
 */
export default async function TenantStorePage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const tenant = await getCurrentTenant();
  const tenantForSeo = tenant ? await getTenantWithTemplate(tenant.id) : null;

  return (
    <>
      {tenantForSeo && <JsonLd nodes={buildStoreJsonLd(storeJsonLdSource(tenantForSeo))} />}
      <StoreHomeContent searchParams={searchParams} />
    </>
  );
}

/**
 * The tenant row → JSON-LD inputs. The logo cascade mirrors US-001's favicon
 * cascade (branding row first, active template second) and then the legacy
 * `settings.logoPath` the layout still falls back to, so a store that has never
 * opened the branding form still gets its logo into the Organization node.
 *
 * Deliberately NOT `getFileUrl` — that mints a presigned S3 URL that dies in an
 * hour. `storedPublicImagePath` (inside the builder) turns an upload key into
 * the durable `/api/public/images/…` route instead, and returns nothing at all
 * for a reference it cannot promise will still resolve.
 */
function storeJsonLdSource(
  row: NonNullable<Awaited<ReturnType<typeof getTenantWithTemplate>>>,
): StoreJsonLdSource {
  const settings = parseTenantSettings(row.settings, { tenantId: row.id });

  return {
    id: row.id,
    plan: row.plan,
    businessName: row.businessName,
    subdomain: row.subdomain,
    customDomain: row.customDomain,
    logoRef:
      row.tenant_branding?.logoUrl ??
      row.activeTenantTemplate?.logoUrl ??
      settings.logoPath ??
      null,
    businessAddress1: row.businessAddress1,
    businessAddress2: row.businessAddress2,
    businessCity: row.businessCity,
    businessState: row.businessState,
    businessPostalCode: row.businessPostalCode,
    businessCountry: row.businessCountry,
  };
}

async function StoreHomeContent({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const tenant = await getCurrentTenant();
  const resolvedSearchParams = await searchParams;
  const previewTemplateId = resolvedSearchParams?.preview || null;

  if (!tenant) {
    notFound();
  }

  // Cached — shared with layout.tsx, no duplicate DB hit
  const tenantWithTemplate = await getTenantWithTemplate(tenant.id);

  // If preview mode, load the specified template instead
  let previewTenantTemplate: any = null;
  if (previewTemplateId && tenantWithTemplate) {
    previewTenantTemplate = await prisma.tenant_templates.findFirst({
      where: {
        id: previewTemplateId,
        tenantId: tenant.id,
      },
      include: { templates: true },
    });
  }

  if (!tenantWithTemplate) {
    notFound();
  }

  // URLs for template props (navigation links — use basePath to avoid double prefix)
  const basePath = getTenantBasePath(tenantWithTemplate.subdomain);
  const consultationUrl = `${basePath}/consultation`;
  const productsUrl = `${basePath}/products`;
  const contactUrl = `${basePath}/contact`;
  const aboutUrl = `${basePath}/about`;

  // Determine which template to use: preview template or active template
  const effectiveTemplate = previewTenantTemplate || tenantWithTemplate.activeTenantTemplate;
  const isPreview = !!previewTenantTemplate;

  if (effectiveTemplate) {
    const tenantTemplate = effectiveTemplate;
    const baseTemplate = tenantTemplate.templates;

    // Fetch latest posts for the template
    const latestPosts = await prisma.posts.findMany({
      where: {
        tenantId: tenant.id,
        published: true,
      },
      take: 3,
      orderBy: { createdAt: "desc" },
      include: { users: true },
    });

    const templateSlug = baseTemplate.slug;

    // Load template assets from tenant's own S3 path (cached — shared with layout.tsx)
    const tenantS3Path = tenantTemplate.s3Path?.replace(/\/+$/, '') || null;

    logger.info(`[store] Tenant ${tenant.id} loading template`, {
      businessName: (tenant as any).businessName,
      activeTenantTemplateId: (tenantWithTemplate as any).activeTenantTemplateId,
      tenantTemplateId: tenantTemplate.id,
      tenantS3Path,
      templateSlug,
      isPreview,
    });

    const templateAssets = await getTemplateAssets(tenantS3Path);
    const { layout, customCss, defaults } = templateAssets;

    logger.info(`[store] Template assets loaded`, {
      hasLayout: !!layout,
      sectionCount: layout?.sections?.length || 0,
      hasDefaults: !!defaults,
      hasCss: !!customCss,
    });

    // Sign hero image and logo URLs in parallel — tenant's own S3 path only
    let heroImageUrl = tenantTemplate.heroImageUrl || null;
    if (!heroImageUrl && defaults?.heroImagePath && tenantS3Path) {
      const hp = defaults.heroImagePath;
      const isAbsoluteHero = hp.startsWith('development/') || hp.startsWith('tenants/') || hp.startsWith('templates/');
      heroImageUrl = isAbsoluteHero ? hp : `${tenantS3Path}/${hp}`;
    }

    let logoUrl = tenantTemplate.logoUrl || null;

    const [signedHero, signedLogo] = await Promise.all([
      (async () => {
        if (!heroImageUrl || heroImageUrl.startsWith("/") || heroImageUrl.startsWith("http")) return heroImageUrl;
        try { return await getFileUrl(heroImageUrl); }
        catch { return heroImageUrl; }
      })(),
      (async () => {
        if (!logoUrl || logoUrl.startsWith("/") || logoUrl.startsWith("http")) return logoUrl;
        try { return await getFileUrl(logoUrl); }
        catch { return logoUrl; }
      })(),
    ]);
    heroImageUrl = signedHero;
    logoUrl = signedLogo;

    // Build common template props
    const templateProps = {
      tenant: tenantWithTemplate,
      consultationUrl,
      productsUrl,
      contactUrl,
      aboutUrl,
      heroImageUrl,
      logoUrl,
      designSystem: tenantTemplate.designSystem,
      pageContent: tenantTemplate.pageContent,
      navigation: tenantTemplate.navigation,
      footer: tenantTemplate.footer,
      posts: latestPosts,
    };

    const signedTenantTemplate = {
      ...tenantTemplate,
      heroImageUrl,
      logoUrl,
    };

    // Sign section-level asset URLs in layout.json configs
    // Assets are at the tenant's own S3 path — no fallback needed
    if (layout?.sections && tenantS3Path) {
      const assetKeys = SECTION_ASSET_KEYS;

      function signAssetUrl(val: string, contentTypeHint?: string): Promise<string> {
        const isAbsoluteKey = val.startsWith('development/') || val.startsWith('tenants/') || val.startsWith('templates/');
        if (isAbsoluteKey) {
          return getFileUrl(val, contentTypeHint);
        }
        return getFileUrl(`${tenantS3Path}/${val}`, contentTypeHint);
      }

      // Collect all signing tasks, then execute in parallel
      const signingTasks: Array<{ target: any; key: string; promise: Promise<string> }> = [];
      for (const section of layout.sections) {
        for (const key of assetKeys) {
          const val = section.config?.[key];
          if (val && typeof val === 'string' && !val.startsWith('http') && !val.startsWith('/')) {
            // For videoUrl keys without a file extension, hint video/mp4 content type
            const hint = key === 'videoUrl' && !/\.\w+$/.test(val) ? 'video/mp4' : undefined;
            signingTasks.push({ target: section.config, key, promise: signAssetUrl(val, hint) });
          }
        }
        // Sign asset URLs inside nested arrays (e.g. categories[].imageUrl, logos[].src)
        if (section.config) {
          for (const arrKey of Object.keys(section.config)) {
            if (Array.isArray(section.config[arrKey])) {
              for (let idx = 0; idx < section.config[arrKey].length; idx++) {
                const item = section.config[arrKey][idx];
                // Handle flat string arrays (e.g. SocialProof avatars[])
                if (typeof item === 'string' && !item.startsWith('http') && !item.startsWith('/') && (item.includes('/') || item.match(/\.(png|jpg|jpeg|webp|svg|gif)$/i))) {
                  signingTasks.push({ target: section.config[arrKey], key: String(idx), promise: signAssetUrl(item) });
                  continue;
                }
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
          (signingTasks[i].target as any)[signingTasks[i].key] = result.value;
        }
      });
    }

    if (layout) {
      const mergedProps = {
        ...templateProps,
        pageContent: templateProps.pageContent || defaults?.pageContent || {},
        navigation: templateProps.navigation || defaults?.navigation || {},
        footer: templateProps.footer || defaults?.footer || {},
        valueProps: defaults?.valueProps || [],
      };

      const mergedTenantTemplate = {
        ...signedTenantTemplate,
        designSystem: signedTenantTemplate.designSystem || null,
      };

      return (
        <>
          {isPreview && (
            <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium sticky top-0 z-50">
              Template Preview — Not yet active
            </div>
          )}
          <TemplateRenderer
            layout={layout}
            sectionProps={mergedProps}
            customCss={customCss}
            renderChrome={false}
          />
        </>
      );
    }

    // PATH 2: Legacy React template (bundled at build time)
    // Only reached when no layout.json exists in S3 (e.g. healingbuds)
    // Layout now renders nav/footer + TenantThemeProvider, so pass renderChrome={false}
    const TemplateComponent = templateSlug ? TEMPLATE_COMPONENTS[templateSlug] : undefined;

    if (TemplateComponent) {
      return (
        <>
          {isPreview && (
            <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium sticky top-0 z-50">
              Template Preview — Not yet active
            </div>
          )}
          <TemplateComponent {...templateProps} renderChrome={false} />
        </>
      );
    }

    console.warn('[StorePage] No layout.json or legacy template found.', {
      templateSlug,
      tenantId: tenant.id,
    });
  }

  // LEGACY: Fallback to old system if no TenantTemplate
  // (For existing tenants not yet migrated)
  const settings = (tenantWithTemplate.settings as any) || {};
  let heroImageUrl = null;
  let logoUrl = null;

  if (settings.heroImagePath) {
    try {
      if (
        settings.heroImagePath.startsWith("/templates/") ||
        settings.heroImagePath.startsWith("/public/")
      ) {
        heroImageUrl = settings.heroImagePath;
      } else {
        heroImageUrl = await getFileUrl(settings.heroImagePath);
      }
    } catch (error) {
      console.error("Error fetching hero image:", error);
    }
  }

  if (settings.logoPath) {
    try {
      if (
        settings.logoPath.startsWith("/templates/") ||
        settings.logoPath.startsWith("/public/")
      ) {
        logoUrl = settings.logoPath;
      } else {
        logoUrl = await getFileUrl(settings.logoPath);
      }
    } catch (error) {
      console.error("Error fetching logo:", error);
    }
  }

  // Check if there's a template assigned (legacy)
  if (tenantWithTemplate.template?.slug) {
    const templateSlug = tenantWithTemplate.template.slug;
    const TemplateComponent = TEMPLATE_COMPONENTS[templateSlug];

    if (TemplateComponent) {
      const templateProps = {
        tenant: tenantWithTemplate,
        consultationUrl,
        productsUrl,
        contactUrl,
        heroImageUrl,
        logoUrl,
      };

      return <TemplateComponent {...templateProps} />;
    }
  }

  // Default/Fallback template (original design)
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <HeroSection
        tenant={tenantWithTemplate}
        heroImageUrl={heroImageUrl}
        consultationUrl={consultationUrl}
      />

      {/* Trust Badges */}
      <TrustBadges />

      {/* Featured Conditions */}
      <FeaturedConditions consultationUrl={consultationUrl} />

      {/* Process Steps */}
      <ProcessSteps consultationUrl={consultationUrl} />

      {/* Educational Content */}
      <EducationalContent tenantSlug={tenant.subdomain} />

      {/* Testimonials */}
      <TestimonialsSlider />

      {/* Call to Action */}
      <CallToAction
        tenant={tenantWithTemplate}
        consultationUrl={consultationUrl}
      />
    </div>
  );
}

// Generate metadata for SEO
export async function generateMetadata() {
  const tenant = await getCurrentTenant();

  if (!tenant) {
    return {
      title: "Store Not Found",
    };
  }

  // Fetch tenant's pageSeo for custom metadata
  const tenantWithSeo = await prisma.tenants.findUnique({
    where: { id: tenant.id },
    select: {
      businessName: true,
      subdomain: true,
      customDomain: true,
      pageSeo: true,
    },
  });

  // Get SEO config with cascade: custom → default
  const pageSeo = tenantWithSeo?.pageSeo as {
    home?: { title?: string; description?: string; ogImage?: string };
  } | null;
  const homeSeo = pageSeo?.home;

  const title =
    homeSeo?.title || `${tenant.businessName} - Medical Cannabis Solutions`;
  const description =
    homeSeo?.description ||
    `Premium medical cannabis products and consultations from ${tenant.businessName}`;

  // Build base URL for OG images
  const baseUrl = getTenantBaseUrl({
    subdomain: tenantWithSeo?.subdomain || tenant.subdomain,
    customDomain: tenantWithSeo?.customDomain ?? null,
  });

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: baseUrl,
      siteName: tenant.businessName,
      type: "website",
      ...(homeSeo?.ogImage && {
        images: [{ url: homeSeo.ogImage, width: 1200, height: 630 }],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(homeSeo?.ogImage && { images: [homeSeo.ogImage] }),
    },
    alternates: {
      canonical: baseUrl,
    },
  };
}
