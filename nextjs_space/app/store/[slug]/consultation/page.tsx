import type { Metadata } from "next";
import { cookies } from "next/headers";
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
import {
  REFERRAL_COOKIE_NAME,
  REFERRAL_QUERY_PARAM,
  normaliseAffiliateCode,
} from "@/lib/affiliate/affiliate-code";

/**
 * BS-A02: the referral-code field's initial value. A `?ref=` on this very
 * request wins (middleware sets `bs_ref` on this response, so the cookie is
 * not on the request yet); otherwise the remembered `bs_ref` cookie. The
 * cookie is HttpOnly, so it is read here and handed down, never by the form.
 */
function initialAffiliateCode(
  searchParams: Record<string, string | string[] | undefined> | undefined,
): string {
  const ref = searchParams?.[REFERRAL_QUERY_PARAM];
  return (
    normaliseAffiliateCode(Array.isArray(ref) ? ref[0] : ref) ??
    normaliseAffiliateCode(cookies().get(REFERRAL_COOKIE_NAME)?.value) ??
    ""
  );
}

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
  searchParams,
}: {
  params: { slug: string };
  searchParams?: Record<string, string | string[] | undefined>;
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
  const affiliateCode = initialAffiliateCode(searchParams);

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
                <IdUploadForm
                  tenantSlug={tenant.subdomain}
                  storeName={tenant.businessName}
                  initialAffiliateCode={affiliateCode}
                />
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
                  <ConsultationForm
                    tenantSlug={tenant.subdomain}
                    storeName={tenant.businessName}
                    initialAffiliateCode={affiliateCode}
                  />
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
