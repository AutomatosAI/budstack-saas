import { notFound } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { getFileUrl, getJsonFromS3, getTextFromS3 } from "@/lib/s3";

// Import renderer
import { TemplateRenderer } from "@/components/template-renderer";
import type { TemplateLayout } from "@/lib/types/template-layout";
import type { SectionProps } from "@/lib/types/section-props";

// Import existing homepage components (fallback)
import { HeroSection } from "@/components/home/hero-section";
import { TrustBadges } from "@/components/home/trust-badges";
import { FeaturedConditions } from "@/components/home/featured-conditions";
import { ProcessSteps } from "@/components/home/process-steps";
import { EducationalContent } from "@/components/home/educational-content";
import { TestimonialsSlider } from "@/components/home/testimonials-slider";
import { CallToAction } from "@/components/home/call-to-action";

/**
 * Try to load a JSON file from S3, returning null on failure
 */
async function tryLoadJson<T>(key: string): Promise<T | null> {
  try {
    return await getJsonFromS3<T>(key);
  } catch {
    return null;
  }
}

export default async function TenantStorePage() {
  const tenant = await getCurrentTenant();

  if (!tenant) {
    notFound();
  }

  // Fetch tenant with active template
  const tenantWithTemplate = await prisma.tenants.findUnique({
    where: { id: tenant.id },
    include: {
      template: true,
      activeTenantTemplate: {
        include: {
          templates: true,
        },
      },
    },
  });

  if (!tenantWithTemplate) {
    notFound();
  }

  // URLs for template props
  const consultationUrl = `/store/${tenantWithTemplate.subdomain}/consultation`;
  const productsUrl = `/store/${tenantWithTemplate.subdomain}/products`;
  const contactUrl = `/store/${tenantWithTemplate.subdomain}/contact`;
  const aboutUrl = `/store/${tenantWithTemplate.subdomain}/about`;

  // Check if tenant has an active TenantTemplate
  if (tenantWithTemplate.activeTenantTemplate) {
    const tenantTemplate = tenantWithTemplate.activeTenantTemplate;
    const baseTemplate = tenantTemplate.templates;
    const templateSlug = baseTemplate.slug;

    console.log("[StorePage] Active template:", {
      tenantId: tenant.id,
      templateSlug,
      tenantTemplateId: tenantTemplate.id,
      s3Path: (tenantTemplate as any).s3Path || "none",
      hasDesignSystem: !!tenantTemplate.designSystem,
    });

    // Fetch latest posts
    const latestPosts = await prisma.posts.findMany({
      where: { tenantId: tenant.id, published: true },
      take: 3,
      orderBy: { createdAt: "desc" },
      include: { users: true },
    });

    // Process hero image URL (sign if S3 path)
    let heroImageUrl = tenantTemplate.heroImageUrl || null;
    if (heroImageUrl && !heroImageUrl.startsWith("/") && !heroImageUrl.startsWith("http")) {
      try {
        heroImageUrl = await getFileUrl(heroImageUrl);
      } catch (error) {
        console.error("Error fetching hero image from S3:", error);
      }
    }

    // Process logo URL (sign if S3 path)
    let logoUrl = tenantTemplate.logoUrl || null;
    if (logoUrl && !logoUrl.startsWith("/") && !logoUrl.startsWith("http")) {
      try {
        logoUrl = await getFileUrl(logoUrl);
      } catch (error) {
        console.error("Error fetching logo from S3:", error);
      }
    }

    // Try to load layout.json from S3
    // Priority: tenant clone → base template
    const tenantS3Path = (tenantTemplate as any).s3Path;
    let layout: TemplateLayout | null = null;
    let defaults: any = null;
    let customCss: string | null = null;

    // Try tenant-specific S3 path first
    if (tenantS3Path) {
      layout = await tryLoadJson<TemplateLayout>(`${tenantS3Path}layout.json`);
      defaults = await tryLoadJson(`${tenantS3Path}defaults.json`);
      customCss = await getTextFromS3(`${tenantS3Path}styles.css`);
    }

    // Fallback to base template S3 path
    if (!layout && templateSlug) {
      layout = await tryLoadJson<TemplateLayout>(`templates/${templateSlug}/layout.json`);
    }
    if (!defaults && templateSlug) {
      defaults = await tryLoadJson(`templates/${templateSlug}/defaults.json`);
    }
    if (!customCss && templateSlug) {
      customCss = await getTextFromS3(`templates/${templateSlug}/styles.css`);
    }

    console.log("[StorePage] S3 load results:", {
      templateSlug,
      hasLayout: !!layout,
      hasDefaults: !!defaults,
      hasCss: !!customCss,
      layoutSections: layout?.sections?.map(s => s.type) || "none",
      layoutNav: layout?.navigation || "none",
      layoutFooter: layout?.footer || "none",
    });

    if (layout) {
      // Merge: DB overrides take precedence over defaults.json
      const designSystem = tenantTemplate.designSystem || defaults?.designSystem || null;
      const pageContent = tenantTemplate.pageContent || defaults?.pageContent || null;
      const navigation = tenantTemplate.navigation || defaults?.navigation || null;
      const footer = tenantTemplate.footer || defaults?.footer || null;
      const valueProps = defaults?.valueProps || null;

      const sectionProps: SectionProps = {
        tenant: tenantWithTemplate,
        consultationUrl,
        productsUrl,
        contactUrl,
        aboutUrl,
        heroImageUrl,
        logoUrl,
        designSystem,
        pageContent,
        navigation,
        footer,
        valueProps,
        posts: latestPosts,
      };

      return (
        <TemplateRenderer layout={layout} sectionProps={sectionProps} customCss={customCss} renderChrome={false} />
      );
    }

    // No layout.json found — log warning
    console.warn("[StorePage] No layout.json found for template, falling back.", {
      templateSlug,
      tenantId: tenant.id,
    });
  }

  // LEGACY: Fallback to old system if no TenantTemplate or no layout.json
  const settings = (tenantWithTemplate.settings as any) || {};
  let heroImageUrl = null;
  let logoUrl = null;

  if (settings.heroImagePath) {
    try {
      if (settings.heroImagePath.startsWith("/templates/") || settings.heroImagePath.startsWith("/public/")) {
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
      if (settings.logoPath.startsWith("/templates/") || settings.logoPath.startsWith("/public/")) {
        logoUrl = settings.logoPath;
      } else {
        logoUrl = await getFileUrl(settings.logoPath);
      }
    } catch (error) {
      console.error("Error fetching logo:", error);
    }
  }

  // Default/Fallback template (original design)
  return (
    <div className="min-h-screen">
      <HeroSection
        tenant={tenantWithTemplate}
        heroImageUrl={heroImageUrl}
        consultationUrl={consultationUrl}
      />
      <TrustBadges />
      <FeaturedConditions consultationUrl={consultationUrl} />
      <ProcessSteps consultationUrl={consultationUrl} />
      <EducationalContent />
      <TestimonialsSlider />
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
    return { title: "Store Not Found" };
  }

  const tenantWithSeo = await prisma.tenants.findUnique({
    where: { id: tenant.id },
    select: {
      businessName: true,
      subdomain: true,
      customDomain: true,
      pageSeo: true,
    },
  });

  const pageSeo = tenantWithSeo?.pageSeo as {
    home?: { title?: string; description?: string; ogImage?: string };
  } | null;
  const homeSeo = pageSeo?.home;

  const title = homeSeo?.title || `${tenant.businessName} - Medical Cannabis Solutions`;
  const description = homeSeo?.description || `Premium medical cannabis products and consultations from ${tenant.businessName}`;

  const baseUrl = tenantWithSeo?.customDomain
    ? `https://${tenantWithSeo.customDomain}`
    : `https://${tenantWithSeo?.subdomain || tenant.subdomain}.budstack.to`;

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
    alternates: { canonical: baseUrl },
  };
}
