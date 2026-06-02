import { notFound } from "next/navigation";
import { getCurrentTenant, getTenantWithTemplate } from "@/lib/tenant/tenant";
import { getTenantBasePath } from "@/lib/tenant/tenant-utils";
import SupportContent from "../support/support-content";
import ContactClient from "./contact-client";

export default async function ContactPage({
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

  // Merge contact info into support content so SupportContent's
  // "Still Need Help?" section picks up editor-saved email/phone.
  const mergedSupportContent = {
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
          pageContent={mergedSupportContent}
        />

        {/* Contact Form Section */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              {(contactInfo.title || contactInfo.description || contactInfo.address) && (
                <div className="mb-10 text-center">
                  {contactInfo.title && (
                    <h2
                      className="text-2xl md:text-3xl font-semibold mb-3 tracking-tight"
                      style={{
                        color: "hsl(var(--tenant-color-heading))",
                        fontFamily: "var(--tenant-font-heading, sans-serif)",
                      }}
                    >
                      {contactInfo.title}
                    </h2>
                  )}
                  {contactInfo.description && (
                    <p
                      className="max-w-2xl mx-auto text-base"
                      style={{
                        color: "hsl(var(--tenant-color-text))",
                        fontFamily: "var(--tenant-font-base, sans-serif)",
                      }}
                    >
                      {contactInfo.description}
                    </p>
                  )}
                  {contactInfo.address && (
                    <p
                      className="mt-4 text-sm whitespace-pre-line"
                      style={{
                        color: "hsl(var(--tenant-color-text))",
                        fontFamily: "var(--tenant-font-base, sans-serif)",
                        opacity: 0.85,
                      }}
                    >
                      {contactInfo.address}
                    </p>
                  )}
                </div>
              )}
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
