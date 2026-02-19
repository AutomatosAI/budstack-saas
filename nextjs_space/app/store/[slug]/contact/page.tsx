import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenant";
import { getTenantBasePath } from "@/lib/tenant-utils";
import SupportContent from "../support/support-content";
import ContactClient from "./contact-client";

export default async function ContactPage({
  params,
}: {
  params: { slug: string };
}) {
  const tenant = await getTenantBySlug(params.slug);

  if (!tenant) {
    notFound();
  }

  const basePath = getTenantBasePath(params.slug);
  const pageContent = (tenant as any).pageContent?.support;

  return (
    <div
      className="min-h-screen pb-24 lg:pb-0"
      style={{ backgroundColor: "hsl(var(--tenant-color-background))" }}
    >
      <main className="pt-28 md:pt-32">
        <SupportContent
          basePath={basePath}
          businessName={tenant.businessName}
          pageContent={pageContent}
        />

        {/* Contact Form Section */}
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
                Send Us a Message
              </h2>
              <ContactClient tenant={tenant} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
