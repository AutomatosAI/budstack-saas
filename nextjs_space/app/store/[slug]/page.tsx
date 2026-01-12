import { notFound } from 'next/navigation';
import { getCurrentTenant } from '@/lib/tenant';
import { prisma } from '@/lib/db';
import { getFileUrl } from '@/lib/s3';

// Import template registry
import { TEMPLATE_COMPONENTS } from '@/lib/template-registry';

// Import theme provider
import { TenantThemeProvider } from '@/components/tenant-theme-provider';

// Import existing homepage components (fallback)
import { HeroSection } from '@/components/home/hero-section';
import { TrustBadges } from '@/components/home/trust-badges';
import { FeaturedConditions } from '@/components/home/featured-conditions';
import { ProcessSteps } from '@/components/home/process-steps';
import { EducationalContent } from '@/components/home/educational-content';
import { TestimonialsSlider } from '@/components/home/testimonials-slider';
import { CallToAction } from '@/components/home/call-to-action';

export default async function TenantStorePage() {
  const tenant = await getCurrentTenant();
  console.log('[DEBUG] TenantStorePage: Resolved tenant:', tenant ? tenant.subdomain : 'null');

  if (!tenant) {
    console.error('[DEBUG] TenantStorePage: Tenant not found, returning 404');
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
    console.error('[DEBUG] TenantStorePage: tenantWithTemplate not found for id:', tenant.id);
    notFound();
  } else {
    console.log('[DEBUG] TenantStorePage: Found tenantWithTemplate. activeTenantTemplate:', !!tenantWithTemplate.activeTenantTemplate, 'Legacy template:', !!tenantWithTemplate.template);
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
        published: true
      },
      take: 3,
      orderBy: { createdAt: 'desc' },
      include: { users: true }
    });

    // Get the template component
    const TemplateComponent = TEMPLATE_COMPONENTS[baseTemplate.slug!];

    // Process hero image URL (sign if S3 path)
    let heroImageUrl = tenantTemplate.heroImageUrl || null;
    if (heroImageUrl && !heroImageUrl.startsWith('/') && !heroImageUrl.startsWith('http')) {
      try {
        console.log('[DEBUG] StorePage: Signing heroImageUrl:', heroImageUrl);
        const signedUrl = await getFileUrl(heroImageUrl);
        console.log('[DEBUG] StorePage: Signed hero URL result:', signedUrl ? signedUrl.substring(0, 50) + '...' : 'null');
        heroImageUrl = signedUrl;
      } catch (error) {
        console.error('Error fetching hero image from S3:', error);
        // Fallback to original, though likely broken if private S3
      }
    }

    // Process logo URL (sign if S3 path)
    let logoUrl = tenantTemplate.logoUrl || null;
    if (logoUrl && !logoUrl.startsWith('/') && !logoUrl.startsWith('http')) {
      try {
        console.log('[DEBUG] StorePage: Signing logoUrl:', logoUrl);
        const signedUrl = await getFileUrl(logoUrl);
        console.log('[DEBUG] StorePage: Signed logo URL result:', signedUrl ? signedUrl.substring(0, 50) + '...' : 'null');
        logoUrl = signedUrl;
      } catch (error) {
        console.error('Error fetching logo from S3:', error);
      }
    }

    if (TemplateComponent) {
      // Build template props with tenant customizations
      const templateProps = {
        tenant: tenantWithTemplate,
        consultationUrl,
        productsUrl,
        contactUrl,
        aboutUrl,
        // Pass tenant template customizations
        heroImageUrl,
        logoUrl,
        // Pass design system and content customizations
        designSystem: tenantTemplate.designSystem,
        pageContent: tenantTemplate.pageContent,
        navigation: tenantTemplate.navigation,
        footer: tenantTemplate.footer,
        // Pass dynamic content
        posts: latestPosts,
      };

      // Wrap in theme provider to inject CSS variables
      // Create a shallow copy with the signed URLs to ensure the provider sees the updated values
      const signedTenantTemplate = {
        ...tenantTemplate,
        heroImageUrl, // This is the SIGNED url
        logoUrl,      // This is the SIGNED url
      };

      return (
        <TenantThemeProvider tenantTemplate={signedTenantTemplate}>
          <TemplateComponent {...templateProps} />
        </TenantThemeProvider>
      );
    }
  }

  // LEGACY: Fallback to old system if no TenantTemplate
  // (For existing tenants not yet migrated)
  const settings = (tenantWithTemplate.settings as any) || {};
  let heroImageUrl = null;
  let logoUrl = null;

  if (settings.heroImagePath) {
    try {
      if (
        settings.heroImagePath.startsWith('/templates/') ||
        settings.heroImagePath.startsWith('/public/')
      ) {
        heroImageUrl = settings.heroImagePath;
      } else {
        heroImageUrl = await getFileUrl(settings.heroImagePath);
      }
    } catch (error) {
      console.error('Error fetching hero image:', error);
    }
  }

  if (settings.logoPath) {
    try {
      if (
        settings.logoPath.startsWith('/templates/') ||
        settings.logoPath.startsWith('/public/')
      ) {
        logoUrl = settings.logoPath;
      } else {
        logoUrl = await getFileUrl(settings.logoPath);
      }
    } catch (error) {
      console.error('Error fetching logo:', error);
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
      <CallToAction tenant={tenantWithTemplate} consultationUrl={consultationUrl} />
    </div>
  );
}

// Generate metadata for SEO
export async function generateMetadata() {
  const tenant = await getCurrentTenant();

  if (!tenant) {
    return {
      title: 'Store Not Found',
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
  const pageSeo = tenantWithSeo?.pageSeo as { home?: { title?: string; description?: string; ogImage?: string } } | null;
  const homeSeo = pageSeo?.home;

  const title = homeSeo?.title || `${tenant.businessName} - Medical Cannabis Solutions`;
  const description = homeSeo?.description || `Premium medical cannabis products and consultations from ${tenant.businessName}`;

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
      type: 'website',
      ...(homeSeo?.ogImage && { images: [{ url: homeSeo.ogImage, width: 1200, height: 630 }] }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(homeSeo?.ogImage && { images: [homeSeo.ogImage] }),
    },
    alternates: {
      canonical: baseUrl,
    },
  };
}
