import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions/require-page-permission";
import { getActiveAdminTenant } from "@/lib/tenant/active-admin-tenant";
import { LEGAL_DOCUMENTS, LEGAL_DOCUMENT_SLUGS } from "@/lib/legal/documents";
import { getTenantLegalDocument } from "@/lib/legal/tenant-policy";
import DocumentManager from "./documents-client";

/**
 * Where an operator chooses, per document, between the maintained default and
 * their own wording — and sees what is actually live on their domain.
 *
 * See docs/PRDS/prd-data-protection-remediation.md.
 */

export const dynamic = "force-dynamic";

export default async function LegalDocumentsPage() {
  await requirePagePermission("canEditSettings");

  const active = await getActiveAdminTenant();
  if (!active) redirect("/auth/login");

  const tenant = await prisma.tenants.findUnique({
    where: { id: active.tenantId },
    select: { subdomain: true, customDomain: true },
  });

  const rows = await prisma.tenant_legal_documents.findMany({
    where: { tenantId: active.tenantId },
  });

  // Resolve each document exactly as the storefront will, so the admin reports
  // what is actually being served rather than what was intended.
  const live = await Promise.all(
    LEGAL_DOCUMENT_SLUGS.map((slug) =>
      getTenantLegalDocument(active.tenantId, slug),
    ),
  );

  const documents = LEGAL_DOCUMENT_SLUGS.map((slug, i) => {
    const row = rows.find((r: { slug: string }) => r.slug === slug) ?? null;
    const meta = LEGAL_DOCUMENTS[slug];
    return {
      slug,
      title: meta.title,
      summary: meta.summary,
      defaultVersion: meta.version,
      mode: row?.mode ?? "default",
      body: row?.body ?? "",
      publishedAt: row?.publishedAt?.toISOString() ?? null,
      liveStatus: live[i].status,
      responsibilityAcceptedAt:
        row?.responsibilityAcceptedAt?.toISOString() ?? null,
    };
  });

  const base = tenant?.customDomain
    ? `https://${tenant.customDomain}`
    : `/store/${tenant?.subdomain ?? ""}`;

  return <DocumentManager documents={documents} storefrontBase={base} />;
}
