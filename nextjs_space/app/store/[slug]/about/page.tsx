import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentTenant, getTenantWithTemplate } from "@/lib/tenant/tenant";
import { getTenantBasePath } from "@/lib/tenant/tenant-utils";
import { generateStorePageMetadata } from "@/lib/seo/generate-page-metadata";
import { TemplateRenderer } from "@/components/template-renderer";
import { buildAboutLayout } from "@/lib/templates/about-page";
import { signSectionAssets } from "@/lib/templates/sign-layout-assets";

// Match the store home's ISR window so a branding publish (which calls
// revalidatePath on the store subtree) refreshes this page immediately.
export const revalidate = 60;

/** SEO US-002 — tenants.pageSeo.about, shared with the page's own tenant fetch. */
export function generateMetadata(): Promise<Metadata> {
  return generateStorePageMetadata("about");
}

/**
 * Tenant About page — a fixed section layout (lib/templates/about-page.ts)
 * rendered through the same TemplateRenderer as the store home. Section
 * configs come from `tenant_templates.pageContent.about` (sparse overlays
 * edited in the branding Store Editor's Pages tab); an untouched tenant gets
 * the stock page, byte-for-byte the markup of the legacy about-content.tsx.
 * Nav/footer come from the store layout, hence renderChrome={false}.
 */
export default async function AboutPage() {
  const tenant = await getCurrentTenant();

  if (!tenant) {
    notFound();
  }

  const basePath = getTenantBasePath(tenant.subdomain);
  // Cached — shared with layout.tsx, no duplicate DB hit
  const tenantWithTemplate = await getTenantWithTemplate(tenant.id);

  if (!tenantWithTemplate) {
    notFound();
  }

  const activeTemplate = tenantWithTemplate.activeTenantTemplate;
  const pageContent = (activeTemplate?.pageContent as any) || {};

  const layout = buildAboutLayout(pageContent.about);

  const tenantS3Path = activeTemplate?.s3Path?.replace(/\/+$/, "") || null;
  await signSectionAssets(layout.sections, tenantS3Path, tenant.id);

  const sectionProps = {
    tenant: tenantWithTemplate,
    consultationUrl: `${basePath}/consultation`,
    productsUrl: `${basePath}/products`,
    contactUrl: `${basePath}/contact`,
    aboutUrl: `${basePath}/about`,
    designSystem: activeTemplate?.designSystem,
    pageContent,
  };

  return (
    <div
      className="min-h-screen pb-24 lg:pb-0"
      style={{ backgroundColor: "hsl(var(--tenant-color-background))" }}
    >
      <main>
        <TemplateRenderer
          layout={layout}
          sectionProps={sectionProps}
          renderChrome={false}
        />
      </main>
    </div>
  );
}
