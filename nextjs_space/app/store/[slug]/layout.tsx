import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { TenantThemeProvider } from "@/components/tenant-theme-provider";
import { CookieConsent } from "@/components/cookie-consent";
import { getCurrentTenant } from "@/lib/tenant";
import { getFileUrl, getJsonFromS3, getTextFromS3 } from "@/lib/s3";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { readFileSync } from "fs";
import { join } from "path";
// Import template registries (legacy + section-based)
import { TEMPLATE_COMPONENTS, TEMPLATE_NAVIGATION, TEMPLATE_FOOTER } from "@/lib/template-registry";
import { getSectionComponent } from "@/lib/section-registry";
import type { TemplateLayout } from "@/lib/types/template-layout";
import { CartProvider } from "./_contexts/CartContext";
import { getTenantBasePath } from "@/lib/tenant-utils";
import { AutomatosWidgetWrapper } from "@/components/admin/AutomatosWidgetWrapper";

// Deep merge two objects — overrides win for leaf values, objects are recursed
function deepMergeObjects(base: any, overrides: any): any {
  if (!base) return overrides;
  if (!overrides) return base;
  const result = { ...base };
  for (const key of Object.keys(overrides)) {
    const val = overrides[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      result[key] = deepMergeObjects(base[key], val);
    } else if (val !== undefined && val !== null && val !== '') {
      result[key] = val;
    }
  }
  return result;
}

// Sanitize CSS from S3 - strip dangerous patterns
function sanitizeCss(css: string | null): string {
  if (!css) return '';
  return css
    .replace(/@import[^;]+;/gi, '')
    .replace(/url\([^)]+\)/gi, '')
    .replace(/expression\([^)]+\)/gi, '');
}

// Extract runtime-safe CSS from a template's styles.css on disk
// Keeps :root vars, class rules, @keyframes — strips @tailwind/@layer/@apply/body/* selectors
function extractTemplateCss(templateSlug: string): { css: string; fontUrl: string | null } {
  try {
    const cssPath = join(process.cwd(), 'templates', templateSlug, 'styles.css');
    const raw = readFileSync(cssPath, 'utf-8');

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

  // Check if this template has a layout.json (data-driven)
  // Templates with layout.json in S3 get data-driven nav/footer
  // Templates without (healingbuds) fall through to legacy nav/footer
  const tenantS3Path = activeTemplate?.s3Path?.replace(/\/+$/, '') || null;
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
        console.log("[layout] FOUND layout.json at:", s3Prefix, "nav:", layout.navigation, "footer:", layout.footer, "settings:", JSON.stringify(layout.settings));
        customCss = await getTextFromS3(`${s3Prefix}/styles.css`).catch(() => null);
        console.log("[layout] styles.css loaded:", customCss ? `${customCss.length} chars` : "NULL/EMPTY");
        defaults = await getJsonFromS3(`${s3Prefix}/defaults.json`).catch(() => null);
        console.log("[layout] defaults.json loaded:", defaults ? Object.keys(defaults) : "NULL");
        break;
      }
    } catch {
      console.log("[layout] No layout.json at:", s3Prefix);
    }
  }
  // Legacy templates (in TEMPLATE_COMPONENTS) bundle their own nav/footer in index.tsx
  // Data-driven templates get nav/footer from layout via renderNavigation/renderFooter
  const legacyTemplateExists = !!(templateSlug && TEMPLATE_COMPONENTS[templateSlug]);
  // Skip layout chrome ONLY for legacy templates (they bundle their own nav/footer)
  const skipLayoutChrome = legacyTemplateExists && !layout;
  console.log("[layout] Final: layout found:", !!layout, "legacyTemplate:", legacyTemplateExists, "skipLayoutChrome:", skipLayoutChrome);

  // For legacy templates, load CSS from filesystem so sub-pages get design tokens
  let legacyCss = '';
  let legacyFontUrl: string | null = null;
  if (legacyTemplateExists && !layout && templateSlug) {
    const extracted = extractTemplateCss(templateSlug);
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
          subdomain={subdomain}
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

  const mergedDesignSystem = deepMergeObjects(defaults?.designSystem || null, activeTemplate?.designSystem || null);
  console.log("[layout] designSystem: defaults?", !!defaults?.designSystem, "db?", !!activeTemplate?.designSystem,
    "merged colors.background:", (mergedDesignSystem as any)?.colors?.background || "NOT SET");

  let widgetThemeOverrides: Record<string, string> | undefined = undefined;
  if ((mergedDesignSystem as any)?.colors) {
    const colors = (mergedDesignSystem as any).colors;
    widgetThemeOverrides = {
      "--aw-primary": colors.primary,
      "--aw-primary-hover": colors.secondary || colors.primary,
      "--aw-bg": "#ffffff",
      "--aw-text": "#1a1a1a",
      "--aw-user-text": "#ffffff",
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
    >
      <CartProvider storeSlug={params.slug}>
        <div className={`min-h-screen ${wrapperClass}`}>
          {/* Inject template custom CSS from S3 (sanitized) */}
          {/* Must use dangerouslySetInnerHTML — React escapes > to \u003e in JSX children, breaking CSS child combinators like #id > section */}
          {customCss && <style dangerouslySetInnerHTML={{ __html: sanitizeCss(customCss) }} />}
          {/* Load Google Fonts from layout.json settings */}
          {layout?.settings?.googleFontsUrl && <link rel="stylesheet" href={layout.settings.googleFontsUrl} />}
          {/* Inject legacy template CSS (from filesystem) for sub-page styling */}
          {legacyCss && <style dangerouslySetInnerHTML={{ __html: legacyCss }} />}
          {legacyFontUrl && <link rel="stylesheet" href={legacyFontUrl} />}
          {/* Skip nav/footer when: data-driven (TemplateRenderer handles it) or legacy (template bundles its own) */}
          {!skipLayoutChrome && renderNavigation()}
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
              title={tenantWithTemplate.businessName}
              greeting={`Hi there! 👋 Welcome to ${tenantWithTemplate.businessName}. How can we help you today?`}
              themeOverrides={widgetThemeOverrides}
            />
          )}
        </div>
      </CartProvider>
    </TenantThemeProvider>
  );
}
