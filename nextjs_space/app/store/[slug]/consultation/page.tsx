import { ConsultationForm } from "@/components/consultation/consultation-form";
import { notFound } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantBasePath } from "@/lib/tenant-utils";
import ConsultationContent from "./consultation-content";

export default async function ConsultationPage({
  params,
}: {
  params: { slug: string };
}) {
  const tenant = await getCurrentTenant();

  if (!tenant) {
    notFound();
  }

  const basePath = getTenantBasePath(tenant.subdomain);

  return (
    <div
      className="min-h-screen pb-24 lg:pb-0"
      style={{ backgroundColor: "hsl(var(--tenant-color-background))" }}
    >
      <main>
        <ConsultationContent basePath={basePath} pageContent={(tenant as any).pageContent?.consultation} />

        {/* Consultation Form */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <h2
                className="text-2xl md:text-3xl font-semibold mb-8 text-center tracking-tight"
                style={{
                  color: "hsl(var(--tenant-color-heading))",
                  fontFamily: "var(--tenant-font-heading, sans-serif)",
                }}
              >
                Start Your Consultation
              </h2>
              <ConsultationForm
                tenantSlug={tenant.subdomain}
                tenantId={tenant.id}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
