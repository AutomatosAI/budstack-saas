import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant/tenant";
import { getTenantPrivacyPolicy } from "@/lib/legal/tenant-policy";

/**
 * The operator's own privacy notice, served on the operator's own domain.
 *
 * This page previously re-exported the BudStacks corporate policy, so every
 * storefront told its patients that BudStacks was their data controller. The
 * operator is the controller; only a notice naming them discharges their
 * Art. 13 duty.
 *
 * When no policy is published the page says so plainly. It must never fall back
 * to the platform notice — that is the defect being fixed.
 *
 * See docs/PRDS/prd-data-protection-remediation.md (US-009).
 */

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getCurrentTenant();
  return {
    title: tenant ? `Privacy Policy | ${tenant.businessName}` : "Privacy Policy",
    robots: { index: true, follow: true },
  };
}

export default async function StorePrivacyPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  const policy = await getTenantPrivacyPolicy(tenant.id);

  return (
    <div
      className="min-h-screen pb-24 lg:pb-0"
      style={{ backgroundColor: "hsl(var(--tenant-color-background))" }}
    >
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1
          className="text-3xl font-semibold tracking-tight sm:text-4xl"
          style={{ color: "hsl(var(--tenant-color-heading))" }}
        >
          Privacy Policy
        </h1>

        {policy.status === "published" ? (
          <>
            <p
              className="mt-3 text-sm"
              style={{ color: "hsl(var(--tenant-color-muted))" }}
            >
              Last updated{" "}
              <time dateTime={policy.publishedAt.toISOString()}>
                {policy.publishedAt.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </time>
            </p>
            <div
              className="legal-document mt-10"
              // Safe: the body is our own versioned template and the renderer
              // HTML-escapes every text node, including tenant merge values,
              // before emitting any tag. See lib/legal/markdown.ts.
              dangerouslySetInnerHTML={{ __html: policy.html }}
            />
          </>
        ) : (
          <div
            className="mt-10 rounded-2xl border p-6"
            style={{
              borderColor: "hsl(var(--tenant-color-border))",
              backgroundColor: "hsl(var(--tenant-color-card))",
            }}
          >
            <p
              className="text-base font-medium"
              style={{ color: "hsl(var(--tenant-color-heading))" }}
            >
              This privacy policy has not been published yet.
            </p>
            <p
              className="mt-3 text-sm leading-relaxed"
              style={{ color: "hsl(var(--tenant-color-foreground))" }}
            >
              {tenant.businessName} has not yet published its privacy notice. If
              you want to know how your personal information is handled before
              you use this service, please contact {tenant.businessName}{" "}
              directly and ask for a copy.
            </p>
            <p
              className="mt-3 text-sm leading-relaxed"
              style={{ color: "hsl(var(--tenant-color-muted))" }}
            >
              You can still exercise your data protection rights at any time,
              including asking what information is held about you.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
