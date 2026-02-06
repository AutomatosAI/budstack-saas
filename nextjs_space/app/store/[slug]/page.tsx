import { notFound } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { getFileUrl, getJsonFromS3, getTextFromS3 } from "@/lib/s3";

// Import template registry (legacy React templates)
import { TEMPLATE_COMPONENTS } from "@/lib/template-registry";

// Import section-based renderer (data-driven templates)
import { TemplateRenderer } from "@/components/template-renderer";
import type { TemplateLayout } from "@/lib/types/template-layout";

// Import theme provider
import { TenantThemeProvider } from "@/components/tenant-theme-provider";

// Import existing homepage components (fallback)
import { HeroSection } from "@/components/home/hero-section";
import { TrustBadges } from "@/components/home/trust-badges";
import { FeaturedConditions } from "@/components/home/featured-conditions";
import { ProcessSteps } from "@/components/home/process-steps";
import { EducationalContent } from "@/components/home/educational-content";
import { TestimonialsSlider } from "@/components/home/testimonials-slider";
import { CallToAction } from "@/components/home/call-to-action";

export default async function TenantStorePage() {
  const tenant = await getCurrentTenant();
  console.log(
    "[DEBUG] TenantStorePage: Resolved tenant:",
    tenant ? tenant.subdomain : "null",
  );

  if (!tenant) {
    console.error("[DEBUG] TenantStorePage: Tenant not found, returning 404");
    notFound();
  }

  // Fetch tenant with active template
  const tenantWithTemplate = await prisma.tenants.findUnique({
    where: { id: tenant.id },
    include: {
      template: true, // Base template (legacy)
      activeTenantTemplate: {
        include: {
          templates: true,
        },
      },
    },
  });

  if (!tenantWithTemplate) {
    console.error(
      "[DEBUG] TenantStorePage: tenantWithTemplate not found for id:",
      tenant.id,
    );
    notFound();
  } else {
    console.log(
      "[DEBUG] TenantStorePage: Found tenantWithTemplate. activeTenantTemplate:",
      !!tenantWithTemplate.activeTenantTemplate,
      "Legacy template:",
      !!tenantWithTemplate.template,
    );
  }

  // URLs for template props
  const consultationUrl = `/store/${tenantWithTemplate.subdomain}/consultation`;
  const productsUrl = `/store/${tenantWithTemplate.subdomain}/products`;
  const contactUrl = `/store/${tenantWithTemplate.subdomain}/contact`;
  const aboutUrl = `/store/${tenantWithTemplate.subdomain}/about`;

  // NEW: Check if tenant has an active TenantTemplate
  if (tenantWithTemplate.activeTenantTemplate) {
    const tenantTemplate = tenantWithTemplate.activeTenantTemplate;
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

    // Process hero image URL (sign if S3 path)
    let heroImageUrl = tenantTemplate.heroImageUrl || null;
    if (
      heroImageUrl &&
      !heroImageUrl.startsWith("/") &&
      !heroImageUrl.startsWith("http")
    ) {
      try {
        console.log("[DEBUG] StorePage: Signing heroImageUrl:", heroImageUrl);
        const signedUrl = await getFileUrl(heroImageUrl);
        console.log(
          "[DEBUG] StorePage: Signed hero URL result:",
          signedUrl ? signedUrl.substring(0, 50) + "..." : "null",
        );
        heroImageUrl = signedUrl;
      } catch (error) {
        console.error("Error fetching hero image from S3:", error);
        // Fallback to original, though likely broken if private S3
      }
    }

    // Process logo URL (sign if S3 path)
    let logoUrl = tenantTemplate.logoUrl || null;
    if (logoUrl && !logoUrl.startsWith("/") && !logoUrl.startsWith("http")) {
      try {
        console.log("[DEBUG] StorePage: Signing logoUrl:", logoUrl);
        const signedUrl = await getFileUrl(logoUrl);
        console.log(
          "[DEBUG] StorePage: Signed logo URL result:",
          signedUrl ? signedUrl.substring(0, 50) + "..." : "null",
        );
        logoUrl = signedUrl;
      } catch (error) {
        console.error("Error fetching logo from S3:", error);
      }
    }

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

    // PATH 1: Data-driven template (layout.json in S3)
    // Templates with layout.json in S3 are data-driven (cannabizz, wellness-nature, gta-cannabis)
    // Templates WITHOUT layout.json fall through to PATH 2 (healingbuds)
    const tenantS3Path = tenantTemplate.s3Path;
    const baseS3Path = `templates/${templateSlug}`;
    let layout: TemplateLayout | null = null;
    let customCss: string | null = null;
    let defaults: any = null;

    for (const s3Prefix of [tenantS3Path, baseS3Path].filter(Boolean)) {
      try {
        layout = await getJsonFromS3<TemplateLayout>(`${s3Prefix}/layout.json`);
        if (layout) {
          customCss = await getTextFromS3(`${s3Prefix}/styles.css`);
          defaults = await getJsonFromS3(`${s3Prefix}/defaults.json`).catch(() => null);
          break;
        }
      } catch {
        // No layout.json at this path, try next
      }
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
        designSystem: signedTenantTemplate.designSystem || defaults?.designSystem || null,
      };

      return (
        <TenantThemeProvider tenantTemplate={mergedTenantTemplate}>
          <TemplateRenderer
            layout={layout}
            sectionProps={mergedProps}
            customCss={customCss}
            renderChrome={false}
          />
        </TenantThemeProvider>
      );
    }

    // PATH 2: Legacy React template (bundled at build time)
    // Only reached when no layout.json exists in S3 (e.g. healingbuds)
    const TemplateComponent = templateSlug ? TEMPLATE_COMPONENTS[templateSlug] : undefined;

    if (TemplateComponent) {
      return (
        <TenantThemeProvider tenantTemplate={signedTenantTemplate}>
          <TemplateComponent {...templateProps} />
        </TenantThemeProvider>
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
      <EducationalContent />

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
    alternates: {
      canonical: baseUrl,
    },
  };
}
