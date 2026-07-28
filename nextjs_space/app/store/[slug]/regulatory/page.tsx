import type { Metadata } from "next";
import { getCurrentTenant } from "@/lib/tenant/tenant";
import LegalDocumentPage from "../_components/LegalDocumentPage";

/**
 * Regulatory Information — the OPERATOR's, served on the operator's own domain.
 *
 * Previously a two-line re-export of the BudStacks platform page. See
 * app/store/[slug]/_components/LegalDocumentPage.tsx.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getCurrentTenant();
  return {
    title: tenant ? `Regulatory Information | ${tenant.businessName}` : "Regulatory Information",
  };
}

export default function StoreRegulatoryPage() {
  return <LegalDocumentPage slug="regulatory" />;
}
