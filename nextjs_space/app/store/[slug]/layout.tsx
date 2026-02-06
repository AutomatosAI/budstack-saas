import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { TenantThemeProvider } from "@/components/tenant-theme-provider";
import { CookieConsent } from "@/components/cookie-consent";
import { getCurrentTenant } from "@/lib/tenant";
import { getFileUrl, getJsonFromS3, getTextFromS3 } from "@/lib/s3";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSectionComponent } from "@/lib/section-registry";
import type { TemplateLayout } from "@/lib/types/template-layout";
import { CartProvider } from "./_contexts/CartContext";

async function tryLoadJson<T>(key: string): Promise<T | null> {
  try {
    return await getJsonFromS3<T>(key);
  } catch {
    return null;
  }
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

  const activeTemplate = tenantWithTemplate.activeTenantTemplate;
  const settings = (tenantWithTemplate.settings as any) || {};

  // Get logo URL
  let logoUrl: string | null = null;
  if (activeTemplate?.logoUrl) {
    if (!activeTemplate.logoUrl.startsWith("/") && !activeTemplate.logoUrl.startsWith("http")) {
      try {
        logoUrl = await getFileUrl(activeTemplate.logoUrl);
      } catch (error) {
        console.error("Error fetching template logo from S3:", error);
        logoUrl = activeTemplate.logoUrl;
      }
    } else {
      logoUrl = activeTemplate.logoUrl;
    }
  } else if (settings.logoPath) {
    if (settings.logoPath.startsWith("/")) {
      logoUrl = settings.logoPath;
    } else {
      try {
        logoUrl = await getFileUrl(settings.logoPath);
      } catch (error) {
        console.error("Error fetching logo from S3:", error);
      }
    }
  }

  const activeBaseTemplate = activeTemplate?.templates;
  const templateSlug = activeBaseTemplate?.slug || tenantWithTemplate.template?.slug;
  const subdomain = tenantWithTemplate.subdomain;

  const consultationUrl = `/store/${subdomain}/consultation`;
  const productsUrl = `/store/${subdomain}/products`;
  const contactUrl = `/store/${subdomain}/contact`;
  const aboutUrl = `/store/${subdomain}/about`;

  // Try to load layout.json + defaults.json + styles.css from S3
  let layout: TemplateLayout | null = null;
  let defaults: any = null;
  let templateCss: string | null = null;
  let googleFontsUrl: string | null = null;
  const tenantS3Path = (activeTemplate as any)?.s3Path;

  if (tenantS3Path) {
    layout = await tryLoadJson<TemplateLayout>(`${tenantS3Path}layout.json`);
    defaults = await tryLoadJson(`${tenantS3Path}defaults.json`);
    templateCss = await getTextFromS3(`${tenantS3Path}styles.css`);
  }
  if (!layout && templateSlug) {
    layout = await tryLoadJson<TemplateLayout>(`templates/${templateSlug}/layout.json`);
  }
  if (!defaults && templateSlug) {
    defaults = await tryLoadJson(`templates/${templateSlug}/defaults.json`);
  }
  if (!templateCss && templateSlug) {
    templateCss = await getTextFromS3(`templates/${templateSlug}/styles.css`);
  }
  if (layout) {
    googleFontsUrl = layout.settings?.googleFontsUrl || null;
  }

  // Build section props for nav/footer components
  const sectionProps = {
    tenant: tenantWithTemplate,
    consultationUrl,
    productsUrl,
    contactUrl,
    aboutUrl,
    logoUrl,
    heroImageUrl: null,
    designSystem: activeTemplate?.designSystem || defaults?.designSystem || null,
    navigation: (activeTemplate?.navigation as any) || defaults?.navigation || null,
    footer: (activeTemplate?.footer as any) || defaults?.footer || null,
  };

  // Render navigation using section registry or default
  const renderNavigation = () => {
    if (layout) {
      const NavComponent = getSectionComponent(layout.navigation);
      if (NavComponent) {
        return <NavComponent {...sectionProps} />;
      }
    }
    return <Navigation tenant={tenantWithTemplate} logoUrl={logoUrl} />;
  };

  // Render footer using section registry or default
  const renderFooter = () => {
    if (layout) {
      const FooterComponent = getSectionComponent(layout.footer);
      if (FooterComponent) {
        return <FooterComponent {...sectionProps} />;
      }
    }
    return <Footer tenant={tenantWithTemplate} logoUrl={logoUrl} />;
  };

  const wrapperClass = layout?.settings?.wrapperClass || "";

  return (
    <TenantThemeProvider
      tenant={tenantWithTemplate}
      tenantTemplate={
        activeTemplate
          ? {
            designSystem: activeTemplate.designSystem || defaults?.designSystem || null,
            customCss: activeTemplate.customCss || templateCss || null,
          }
          : undefined
      }
      googleFontsUrl={googleFontsUrl}
    >
      <CartProvider storeSlug={params.slug}>
        <div className={`min-h-screen ${wrapperClass}`}>
          {renderNavigation()}
          <main>{children}</main>
          {renderFooter()}
          <CookieConsent tenant={tenantWithTemplate} />
        </div>
      </CartProvider>
    </TenantThemeProvider>
  );
}
