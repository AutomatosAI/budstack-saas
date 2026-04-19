import { notFound } from "next/navigation";
import { getCurrentTenant, getTenantWithTemplate } from "@/lib/tenant";
import { getTenantBasePath } from "@/lib/tenant-utils";
import AboutContent from "./about-content";

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
