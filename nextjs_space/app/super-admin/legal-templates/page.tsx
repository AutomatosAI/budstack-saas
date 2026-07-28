import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { LEGAL_DOCUMENTS, LEGAL_DOCUMENT_SLUGS } from "@/lib/legal/documents";
import TemplateEditor from "./templates-client";

/**
 * The standard wording every operator on `default` inherits.
 *
 * Database-backed so a solicitor's or DPO's revisions do not need a developer.
 * Until a document is edited here the shipped wording is served, so this table
 * starts empty rather than seeded — the first save creates the row.
 *
 * See docs/PRDS/prd-data-protection-remediation.md.
 */

export const dynamic = "force-dynamic";

export default async function LegalTemplatesPage() {
  const user = await currentUser();

  if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
  }

  const stored = await prisma.platform_legal_templates.findMany();

  // How many live storefronts each edit would reach. Stated up front, because
  // changing a document here changes it for every operator inheriting it.
  const counts = await prisma.tenant_legal_documents.groupBy({
    by: ["slug"],
    where: { mode: "default", publishedAt: { not: null } },
    _count: { _all: true },
  });

  const templates = LEGAL_DOCUMENT_SLUGS.map((slug) => {
    const meta = LEGAL_DOCUMENTS[slug];
    const row = stored.find((r: { slug: string }) => r.slug === slug) ?? null;
    const count =
      counts.find((c: { slug: string }) => c.slug === slug)?._count?._all ?? 0;

    return {
      slug,
      title: meta.title,
      summary: meta.summary,
      requiredTokens: [...meta.requiredTokens],
      body: row?.body ?? meta.template,
      version: row?.version ?? meta.version,
      shippedVersion: meta.version,
      edited: Boolean(row),
      storefrontsInheriting: count,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
    };
  });

  return <TemplateEditor templates={templates} />;
}
