import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { TenantThemeProvider } from "@/components/tenant-theme-provider";
import { CookieConsent } from "@/components/cookie-consent";
import { NewsletterNotice } from "@/components/newsletter-notice";
import { getCurrentTenant, getTenantWithTemplate, getTemplateAssets } from "@/lib/tenant/tenant";
import { runWithTenantContextAsync } from "@/lib/tenant/tenant-context";
import { getFileUrl } from "@/lib/storage/s3";
import { notFound } from "next/navigation";
import { readFile } from "fs/promises";
import { join } from "path";
// Import template registries (legacy + section-based)
import { TEMPLATE_COMPONENTS, TEMPLATE_NAVIGATION, TEMPLATE_FOOTER } from "@/lib/templates/template-registry";
import { getSectionComponent } from "@/lib/templates/section-registry";
import type { TemplateLayout } from "@/lib/types/template-layout";
import type { CSSProperties } from "react";
import { CartProvider } from "./_contexts/CartContext";
import { getTenantBasePath } from "@/lib/tenant/tenant-utils";
import { AutomatosWidgetWrapper } from "@/components/admin/AutomatosWidgetWrapper";
import { sanitizeCss, extractGoogleFontsImports } from "@/lib/security/css-utils";
import { hexToHsl } from "@/lib/color-utils";

// Extract runtime-safe CSS from a template's styles.css on disk
// Keeps :root vars, class rules, @keyframes — strips @tailwind/@layer/@apply/body/* selectors
async function extractTemplateCss(templateSlug: string): Promise<{ css: string; fontUrl: string | null }> {
  try {
    const cssPath = join(process.cwd(), 'templates', templateSlug, 'styles.css');
    const raw = await readFile(cssPath, 'utf-8');

    // Extract Google Fonts URL from @import
    const fontMatch = raw.match(/@import\s+url\(['"]?(https:\/\/fonts\.googleapis\.com[^'")\s]+)['"]?\)/);
    const fontUrl = fontMatch?.[1] || null;

    // Remove directives that can't run at runtime
    let cleaned = raw
      .replace(/@import[^;]+;/g, '')
      .replace(/@tailwind[^;]+;/g, '');

    // Remove @layer wrappers but keep inner content
    // Match @layer ... { ... } and unwrap
    cleaned = cleaned.replace(/@layer\s+\w+\s*\{/g, '');
    // Remove matching closing braces (one per @layer removed)
    // Simple approach: process block by block
    const blocks: string[] = [];
    let depth = 0;
    let current = '';
    for (const char of cleaned) {
      if (char === '{') depth++;
      if (char === '}') {
        depth--;
        if (depth < 0) {
          // This is the closing brace of an @layer we removed
          depth = 0;
          continue;
        }
      }
      current += char;
      if (depth === 0 && current.trim()) {
        blocks.push(current);
        current = '';
      }
    }
    if (current.trim()) blocks.push(current);
    cleaned = blocks.join('\n');

    // Remove rules that use @apply (can't run at runtime)
    cleaned = cleaned.replace(/[^{}]*@apply[^}]*\}/g, '}');
    // Remove empty rule bodies
    cleaned = cleaned.replace(/[^{}]+\{\s*\}/g, '');

    // Remove global selectors that would bleed: body, *, h1-h6, p, label, input, etc.
    cleaned = cleaned.replace(/^\s*(?:body|html|\*|h[1-6]|p|label|input|textarea|select|button)\s*(?:,\s*(?:body|html|\*|h[1-6]|p|label|input|textarea|select|button)\s*)*\{[^}]*\}/gm, '');

    return { css: cleaned, fontUrl };
  } catch {
    return { css: '', fontUrl: null };
  }
}

export default async function TenantStoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  // PRD-202 AC-5 pilot: resolve the tenant first (a NON-tenant-scoped lookup),
  // then run the entire data-loading + render inside one explicit
  // runWithTenantContextAsync scope. Every tenant-scoped Prisma read below
  // therefore executes under the correct, confined context — never relying on a
  // resolver's enterWith side-effect (removed in US-008/009) and never able to
  // leak into a concurrent request's continuation (the bug this PRD fixes).
  const tenant = await getCurrentTenant();

  if (!tenant) {
    notFound();
  }

  return runWithTenantContextAsync(tenant.id, () =>
    renderTenantStore(tenant.id, params, children),
  );
}

async function renderTenantStore(
  tenantId: string,
  params: { slug: string },
  children: React.ReactNode,
) {
  const tenantWithTemplate = await getTenantWithTemplate(tenantId);

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
  const basePath = getTenantBasePath(subdomain);
  const consultationUrl = `${basePath}/consultation`;
  const productsUrl = `${basePath}/products`;
  const contactUrl = `${basePath}/contact`;
  const aboutUrl = `${basePath}/about`;

  // Extract contact info from settings
  const contactEmail = settings.contactEmail || "info@example.com";
  const contactPhone = settings.contactPhone || "+1 234 567 890";
  const address = settings.address || "Your Business Address";
  const socialLinks = settings.socialMedia || {};

  // Load template assets from tenant's own S3 path (cached — shared with page.tsx)
  const tenantS3Path = activeTemplate?.s3Path?.replace(/\/+$/, '') || null;
  const { layout, defaults, customCss } = await getTemplateAssets(tenantS3Path);

  // 3. Fallback to defaults.json logoPath when DB logoUrl is null
  if (!logoUrl && defaults?.logoPath && tenantS3Path) {
    try {
      logoUrl = await getFileUrl(`${tenantS3Path}/${defaults.logoPath}`);
    } catch { /* no logo available */ }
  }

  // Legacy templates (in TEMPLATE_COMPONENTS) bundle their own nav/footer in index.tsx
  const legacyTemplateExists = !!(templateSlug && TEMPLATE_COMPONENTS[templateSlug]);
  const skipLayoutChrome = legacyTemplateExists && !layout;

  // For legacy templates, load CSS from filesystem so sub-pages get design tokens
  let legacyCss = '';
  let legacyFontUrl: string | null = null;
  if (legacyTemplateExists && !layout && templateSlug) {
    const extracted = await extractTemplateCss(templateSlug);
    legacyCss = extracted.css;
    legacyFontUrl = extracted.fontUrl;
  }

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
        const navOverrides = layout.navigationConfig?.colorOverrides;
        const navStyle: CSSProperties | undefined = navOverrides
          ? (Object.fromEntries(
              Object.entries(navOverrides)
                .filter(([, v]) => v && typeof v === 'string' && v.trim())
                .map(([k, v]) => [`--tenant-color-${k}`, (v as string).startsWith('#') ? hexToHsl(v as string) : v])
            ) as CSSProperties)
          : undefined;
        return (
          <div style={navStyle}>
            <NavComponent {...sectionProps} sectionConfig={layout.navigationConfig} />
          </div>
        );
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
        const isDarkFooter = layout.footer === 'FooterBrand' || layout.footer === 'FooterFull';
        const darkDefaults: Record<string, string> = isDarkFooter
          ? { '--tenant-color-background': '220 15% 10%', '--tenant-color-text': '0 0% 100%', '--tenant-color-heading': '0 0% 100%', '--tenant-color-border': '0 0% 100%' }
          : {};
        const footerOverrides = layout.footerConfig?.colorOverrides;
        const overrideEntries = footerOverrides
          ? Object.fromEntries(
              Object.entries(footerOverrides)
                .filter(([, v]) => v && typeof v === 'string' && v.trim())
                .map(([k, v]) => [`--tenant-color-${k}`, (v as string).startsWith('#') ? hexToHsl(v as string) : v])
            )
          : {};
        const footerStyle = { ...darkDefaults, ...overrideEntries } as CSSProperties;
        return (
          <div style={Object.keys(footerStyle).length > 0 ? footerStyle : undefined}>
            <FooterComponent {...sectionProps} sectionConfig={layout.footerConfig} />
          </div>
        );
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
          subdomain={subdomain}
          consultationUrl={consultationUrl}
          productsUrl={productsUrl}
          contactUrl={contactUrl}
        />
      );
    }

    return <Footer tenant={tenantWithTemplate} logoUrl={logoUrl} />;
  };

  // Wrapper class from layout settings (legacy hardcoded mapping removed)
  const wrapperClass = layout?.settings?.wrapperClass || "";

  // Tenant's DB designSystem only — no merging with base template defaults
  const mergedDesignSystem = activeTemplate?.designSystem || null;

  let widgetThemeOverrides: Record<string, string> | undefined = undefined;
  if ((mergedDesignSystem as any)?.colors) {
    const colors = (mergedDesignSystem as any).colors;
    widgetThemeOverrides = {
      "--aw-primary": colors.primary,
      "--aw-primary-hover": colors.secondary || colors.primary,
      "--aw-bg": "#ffffff",
      "--aw-text": "#1a1a1a",
      "--aw-user-text": "#1a1a1a",
    };

    // remove undefined/falsy values
    Object.keys(widgetThemeOverrides).forEach(key => {
      if (!widgetThemeOverrides![key]) delete widgetThemeOverrides![key];
    });
  }

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
      useTemplatePadding={layout?.settings?.useTemplatePadding === true}
    >
      <CartProvider storeSlug={params.slug}>
        <div className={`min-h-screen ${wrapperClass}`}>
          {/* Inject template custom CSS from S3 (sanitized) */}
          {/* Must use dangerouslySetInnerHTML — React escapes > to \u003e in JSX children, breaking CSS child combinators like #id > section */}
          {customCss && <style dangerouslySetInnerHTML={{ __html: sanitizeCss(customCss) }} />}
          {/* Load Google Fonts from layout.json settings */}
          {layout?.settings?.googleFontsUrl && <link rel="stylesheet" href={layout.settings.googleFontsUrl} />}
          {/* Load Google Fonts extracted from styles.css @import (sanitiseCss strips @import) */}
          {extractGoogleFontsImports(customCss).map((href) => (
            <link key={href} rel="stylesheet" href={href} />
          ))}
          {/* Inject legacy template CSS (from filesystem) for sub-page styling — sanitized like customCss above */}
          {legacyCss && <style dangerouslySetInnerHTML={{ __html: sanitizeCss(legacyCss) }} />}
          {legacyFontUrl && <link rel="stylesheet" href={legacyFontUrl} />}
          {/* Skip nav/footer when: data-driven (TemplateRenderer handles it) or legacy (template bundles its own) */}
          {!skipLayoutChrome && renderNavigation()}
          {/* Newsletter double opt-in outcome (US-003), rendered above the page
              content whatever chrome the template brings. */}
          <NewsletterNotice />
          <main>{children}</main>
          {!skipLayoutChrome && renderFooter()}
          <CookieConsent tenant={tenantWithTemplate} />

          {/* Conditionally render the Tenant's Automatos Widget if configured */}
          {tenantWithTemplate.automatosApiKey && (
            <AutomatosWidgetWrapper
              apiKey={tenantWithTemplate.automatosApiKey}
              agentId={tenantWithTemplate.automatosAgentId ?? undefined}
              position="bottom-right"
              theme="light"
              title={`${tenantWithTemplate.businessName} - Support`}
              greeting={`Hi there! 👋 Welcome to ${tenantWithTemplate.businessName}. How can we help you today?`}
              themeOverrides={widgetThemeOverrides}
            />
          )}
        </div>
      </CartProvider>
    </TenantThemeProvider>
  );
}
