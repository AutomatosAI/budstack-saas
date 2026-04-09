import { notFound } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantBasePath } from "@/lib/tenant-utils";
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
  const pageContent = (tenant as any).pageContent?.support;

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
