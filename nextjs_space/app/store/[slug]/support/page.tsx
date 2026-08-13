import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentTenant, getTenantWithTemplate } from "@/lib/tenant/tenant";
import { getTenantBasePath } from "@/lib/tenant/tenant-utils";
import { generateStorePageMetadata } from "@/lib/seo/generate-page-metadata";
import SupportContent from "./support-content";

/**
 * SEO US-002 — tenants.pageSeo.support, falling back to the retired `faq` entry
 * (this page is where /faq redirects), shared with the page's own tenant fetch.
 */
export function generateMetadata(): Promise<Metadata> {
  return generateStorePageMetadata("support");
}

export default async function SupportPage({
  params,
}: {
  params: { slug: string };
}) {
  const tenant = await getCurrentTenant();

  if (!tenant) {
    notFound();
  }

  const basePath = getTenantBasePath(tenant.subdomain);
  const tenantWithTemplate = await getTenantWithTemplate(tenant.id);
  const fullPageContent =
    (tenantWithTemplate?.activeTenantTemplate?.pageContent as any) || {};
  const contactInfo = fullPageContent.contact || {};
  const supportContent = fullPageContent.support || {};
  // Merge contact info so /support "Still Need Help?" picks up editor-saved email/phone
  const pageContent = {
    ...supportContent,
    contactEmail: contactInfo.email || supportContent.contactEmail,
    contactPhone: contactInfo.phone || supportContent.contactPhone,
  };

  return (
    <div
      className="min-h-screen pb-24 lg:pb-0"
      style={{ backgroundColor: "hsl(var(--tenant-color-background))" }}
    >
      <main>
        <SupportContent
          basePath={basePath}
          businessName={tenant.businessName}
          pageContent={pageContent}
        />
      </main>
    </div>
  );
}
