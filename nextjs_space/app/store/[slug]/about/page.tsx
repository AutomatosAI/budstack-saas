import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentTenant, getTenantWithTemplate } from "@/lib/tenant/tenant";
import { getTenantBasePath } from "@/lib/tenant/tenant-utils";
import { generateStorePageMetadata } from "@/lib/seo/generate-page-metadata";
import AboutContent from "./about-content";

/** SEO US-002 — tenants.pageSeo.about, shared with the page's own tenant fetch. */
export function generateMetadata(): Promise<Metadata> {
  return generateStorePageMetadata("about");
}

export default async function AboutPage({
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
  const pageContent =
    (tenantWithTemplate?.activeTenantTemplate?.pageContent as any)?.about;

  return (
    <div
      className="min-h-screen pb-24 lg:pb-0"
      style={{ backgroundColor: "hsl(var(--tenant-color-background))" }}
    >
      <main>
        <AboutContent
          basePath={basePath}
          businessName={tenant.businessName}
          pageContent={pageContent}
        />
      </main>
    </div>
  );
}
