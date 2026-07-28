import { notFound } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant/tenant";
import { getTenantLegalDocument } from "@/lib/legal/tenant-policy";
import type { LegalDocumentSlug } from "@/lib/legal/documents";

/**
 * Renders one of the operator's own legal documents on the operator's domain.
 *
 * All four storefront legal routes previously re-exported the BudStacks
 * platform page, so an operator's domain served the platform's documents under
 * the operator's brand — naming BudStacks as the data controller and, on the
 * terms page, as the party to the customer's contract.
 *
 * One component for all four so they cannot drift apart again, and so the
 * fallback behaviour is identical everywhere: never substitute the platform's
 * document for the operator's.
 *
 * See docs/PRDS/prd-data-protection-remediation.md.
 */

export default async function LegalDocumentPage({
  slug,
}: {
  slug: LegalDocumentSlug;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  const doc = await getTenantLegalDocument(tenant.id, slug);

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
          {doc.title}
        </h1>

        {doc.status === "published" ? (
          <>
            <p
              className="mt-3 text-sm"
              style={{ color: "hsl(var(--tenant-color-muted))" }}
            >
              Last updated{" "}
              <time dateTime={doc.publishedAt.toISOString()}>
                {doc.publishedAt.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </time>
            </p>
            <div
              className="legal-document mt-10"
              // Safe: the body is our own versioned template and the renderer
              // HTML-escapes every text node, including operator-supplied merge
              // values, before emitting any tag. See lib/legal/markdown.ts and
              // its injection tests.
              dangerouslySetInnerHTML={{ __html: doc.html }}
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
              This document has not been published yet.
            </p>
            <p
              className="mt-3 text-sm leading-relaxed"
              style={{ color: "hsl(var(--tenant-color-foreground))" }}
            >
              {tenant.businessName} has not yet published its {doc.title.toLowerCase()}.
              Please contact {tenant.businessName} directly if you need a copy
              before using this service.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
