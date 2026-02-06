import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { TenantThemeProvider } from "@/components/tenant-theme-provider";
import { CookieConsent } from "@/components/cookie-consent";
import { getCurrentTenant } from "@/lib/tenant";
import { getFileUrl, getJsonFromS3, getTextFromS3 } from "@/lib/s3";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
// Import template registries (legacy + section-based)
import { TEMPLATE_COMPONENTS, TEMPLATE_NAVIGATION, TEMPLATE_FOOTER } from "@/lib/template-registry";
import { getSectionComponent } from "@/lib/section-registry";
import type { TemplateLayout } from "@/lib/types/template-layout";
import { CartProvider } from "./_contexts/CartContext";

// Sanitize CSS from S3 - strip dangerous patterns
function sanitizeCss(css: string | null): string {
  if (!css) return '';
  return css
    .replace(/@import[^;]+;/gi, '')
    .replace(/url\([^)]+\)/gi, '')
    .replace(/expression\([^)]+\)/gi, '');
}

export default async function TenantStoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const tenant = await getCurrentTenant();

  if (!tenant) {
    notFound();
  }

  // Fetch tenant with template relation
  // Fetch tenant with template relation AND active tenant template
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

  // Get active template customizations
  const activeTemplate = tenantWithTemplate.activeTenantTemplate;
  const designSystem = (activeTemplate?.designSystem as any) || {};
  const pageContent = (activeTemplate?.pageContent as any) || {};

  // Get logo URL - prioritize active template logoUrl over legacy settings
  const settings = (tenantWithTemplate.settings as any) || {};
  let logoUrl: string | null = null;

  // 1. Try active template first
  if (activeTemplate?.logoUrl) {
    // Check if it's an S3 path (doesn't start with / or http)
    if (
      !activeTemplate.logoUrl.startsWith("/") &&
      !activeTemplate.logoUrl.startsWith("http")
    ) {
      try {
        logoUrl = await getFileUrl(activeTemplate.logoUrl);
      } catch (error) {
        console.error("Error fetching template logo from S3:", error);
        // Fallback to raw string if signing fails, though it likely won't work
        logoUrl = activeTemplate.logoUrl;
      }
    } else {
      logoUrl = activeTemplate.logoUrl;
    }
  }
  // 2. Fallback to legacy settings
  else if (settings.logoPath) {
    // If logoPath starts with '/', it's a public folder path - use directly
    if (settings.logoPath.startsWith("/")) {
      logoUrl = settings.logoPath;
    } else {
      // Otherwise it's an S3 path - fetch the signed URL
      try {
        logoUrl = await getFileUrl(settings.logoPath);
      } catch (error) {
        console.error("Error fetching logo from S3:", error);
      }
    }
  }

  // Determine which footer to render based on template
  // Prioritize active custom template's base template, falling back to tenant's assigned template
  const activeBaseTemplate = tenantWithTemplate.activeTenantTemplate?.templates;
  const templateSlug =
    activeBaseTemplate?.slug || tenantWithTemplate.template?.slug;
  const subdomain = tenantWithTemplate.subdomain;

  // Prepare URLs for template footers
  const consultationUrl = `/store/${subdomain}/consultation`;
  const productsUrl = `/store/${subdomain}/products`;
  const contactUrl = `/store/${subdomain}/contact`;
  const aboutUrl = `/store/${subdomain}/about`;

  // Extract contact info from settings
  const contactEmail = settings.contactEmail || "info@example.com";
  const contactPhone = settings.contactPhone || "+1 234 567 890";
  const address = settings.address || "Your Business Address";
  const socialLinks = settings.socialMedia || {};

  // Check if this template has a layout.json (data-driven)
  // Templates with layout.json in S3 get data-driven nav/footer
  // Templates without (healingbuds) fall through to legacy nav/footer
  const tenantS3Path = activeTemplate?.s3Path;
  const baseS3Path = templateSlug ? `templates/${templateSlug}` : null;
  let layout: TemplateLayout | null = null;
  let customCss: string | null = null;
  let defaults: any = null;

  console.log("[layout] templateSlug:", templateSlug, "tenantS3Path:", tenantS3Path, "baseS3Path:", baseS3Path);
  for (const s3Prefix of [tenantS3Path, baseS3Path].filter(Boolean)) {
    try {
      console.log("[layout] Trying S3:", `${s3Prefix}/layout.json`);
      layout = await getJsonFromS3<TemplateLayout>(`${s3Prefix}/layout.json`);
      if (layout) {
        console.log("[layout] FOUND layout.json at:", s3Prefix, "nav:", layout.navigation, "footer:", layout.footer);
        customCss = await getTextFromS3(`${s3Prefix}/styles.css`);
        defaults = await getJsonFromS3(`${s3Prefix}/defaults.json`).catch(() => null);
        break;
      }
    } catch {
      console.log("[layout] No layout.json at:", s3Prefix);
    }
  }
  // Legacy templates (in TEMPLATE_COMPONENTS) bundle their own nav/footer in index.tsx
  // Data-driven templates (layout.json found) render nav/footer via TemplateRenderer
  // Layout only renders nav/footer when NEITHER applies (bare fallback)
  const legacyTemplateExists = !!(templateSlug && TEMPLATE_COMPONENTS[templateSlug]);
  const skipLayoutChrome = !!layout || legacyTemplateExists;
  console.log("[layout] Final: layout found:", !!layout, "legacyTemplate:", legacyTemplateExists, "skipLayoutChrome:", skipLayoutChrome);

  // Build section props for data-driven nav/footer
  const sectionProps = {
    tenant: tenantWithTemplate,
    consultationUrl,
    productsUrl,
    contactUrl,
    aboutUrl,
    logoUrl,
    navigation: (activeTemplate?.navigation as any) || defaults?.navigation || {},
    footer: (activeTemplate?.footer as any) || defaults?.footer || {},
    pageContent: (activeTemplate?.pageContent as any) || defaults?.pageContent || {},
  };

  // Render navigation
  const renderNavigation = () => {
    // Data-driven: use section component from layout.json
    if (layout?.navigation) {
      const NavComponent = getSectionComponent(layout.navigation);
      if (NavComponent) {
        return <NavComponent {...sectionProps} />;
      }
    }

    // Legacy: use template-specific React component
    const SpecificNavigation = templateSlug
      ? TEMPLATE_NAVIGATION[templateSlug]
      : null;

    if (SpecificNavigation) {
      return (
        <SpecificNavigation
          businessName={tenantWithTemplate.businessName}
          logoUrl={logoUrl}
          tenant={tenantWithTemplate}
          subdomain={subdomain}
        />
      );
    }

    return <Navigation tenant={tenantWithTemplate} logoUrl={logoUrl} />;
  };

  // Render footer
  const renderFooter = () => {
    // Data-driven: use section component from layout.json
    if (layout?.footer) {
      const FooterComponent = getSectionComponent(layout.footer);
      if (FooterComponent) {
        return <FooterComponent {...sectionProps} />;
      }
    }

    // Legacy: use template-specific React component
    const SpecificFooter = templateSlug ? TEMPLATE_FOOTER[templateSlug] : null;

    if (SpecificFooter) {
      return (
        <SpecificFooter
          businessName={tenantWithTemplate.businessName}
          logoUrl={logoUrl}
          tenant={tenantWithTemplate}
          consultationUrl={consultationUrl}
          productsUrl={productsUrl}
          contactUrl={contactUrl}
        />
      );
    }

    return <Footer tenant={tenantWithTemplate} logoUrl={logoUrl} />;
  };

  // Wrapper class from layout settings or legacy mapping
  const wrapperClass = layout?.settings?.wrapperClass || (() => {
    switch (templateSlug) {
      case "wellness-nature": return "wellness-template";
      case "gta-cannabis": return "gta-template";
      case "healingbuds": return "template-healingbuds";
      default: return "";
    }
  })();

  // Merge designSystem: DB > defaults > null
  const mergedDesignSystem = activeTemplate?.designSystem || defaults?.designSystem || null;

  return (
    <TenantThemeProvider
      tenant={tenantWithTemplate}
      tenantTemplate={
        activeTemplate || mergedDesignSystem
          ? {
            designSystem: mergedDesignSystem,
            customCss: activeTemplate?.customCss || null,
          }
          : undefined
      }
    >
      <CartProvider storeSlug={params.slug}>
        <div className={`min-h-screen ${wrapperClass}`}>
          {/* Inject template custom CSS from S3 (sanitized) */}
          {customCss && <style>{sanitizeCss(customCss)}</style>}
          {/* Skip nav/footer when: data-driven (TemplateRenderer handles it) or legacy (template bundles its own) */}
          {!skipLayoutChrome && renderNavigation()}
          <main>{children}</main>
          {!skipLayoutChrome && renderFooter()}
          <CookieConsent tenant={tenantWithTemplate} />
        </div>
      </CartProvider>
    </TenantThemeProvider>
  );
}
