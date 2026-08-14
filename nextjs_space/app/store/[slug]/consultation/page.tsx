import type { Metadata } from "next";
import { ConsultationForm } from "@/components/consultation/consultation-form";
import { notFound } from "next/navigation";
import { generateStoreRouteMetadata } from "@/lib/seo/generate-page-metadata";
import { getCurrentTenant, getTenantWithTemplate } from "@/lib/tenant/tenant";
import { getTenantBasePath } from "@/lib/tenant/tenant-utils";
import ConsultationContent from "./consultation-content";
import { IdUploadForm } from "@/components/consultation/id-upload-form";
import {
  getTenantVerificationMode,
  isSaIdUploadEnabled,
} from "@/lib/verification-mode";

/**
 * SEO US-007 — nav- and footer-linked (components/navigation.tsx:104,
 * components/footer.tsx:163) and, until this story, carrying no title,
 * description or canonical.
 *
 * The mode is resolved the same way the body resolves it, from the same
 * React-`cache()`d tenant and two pure functions — no extra query. An SA
 * ID-upload tenant renders a registration + ID form rather than a medical
 * consultation, and titling that page "Consultation" would describe a page the
 * visitor never sees. Both modes canonicalise to /consultation, which is the
 * one URL either form is served at.
 */
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getCurrentTenant();
  const idMode =
    !!tenant &&
    isSaIdUploadEnabled() &&
    getTenantVerificationMode(tenant) === "ID_UPLOAD";

  return generateStoreRouteMetadata(
    idMode ? "idUploadRegistration" : "consultation",
  );
}

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
  const tenantWithTemplate = await getTenantWithTemplate(tenant.id);
  const consultationContent =
    (tenantWithTemplate?.activeTenantTemplate?.pageContent as any)?.consultation;

  // SA ID-upload tenants skip the medical consultation: register + upload an ID.
  const idMode =
    isSaIdUploadEnabled() && getTenantVerificationMode(tenant) === "ID_UPLOAD";

  return (
    <div
      className="min-h-screen pb-24 lg:pb-0"
      style={{ backgroundColor: "hsl(var(--tenant-color-background))" }}
    >
      <main>
        {idMode ? (
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
                  Register &amp; verify with your ID
                </h2>
                <IdUploadForm tenantSlug={tenant.subdomain} />
              </div>
            </div>
          </section>
        ) : (
          <>
            <ConsultationContent basePath={basePath} pageContent={consultationContent} />

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
                    Register here
                  </h2>
                  <ConsultationForm tenantSlug={tenant.subdomain} />
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
