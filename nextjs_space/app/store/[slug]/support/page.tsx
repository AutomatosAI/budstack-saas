import { notFound } from "next/navigation";
import { getCurrentTenant, getTenantWithTemplate } from "@/lib/tenant/tenant";
import { getTenantBasePath } from "@/lib/tenant/tenant-utils";
import SupportContent from "./support-content";

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
