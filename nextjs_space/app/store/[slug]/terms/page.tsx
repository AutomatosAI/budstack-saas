import type { Metadata } from "next";
import LegalDocumentPage from "../_components/LegalDocumentPage";
import { generateLegalDocumentMetadata } from "@/lib/seo/generate-page-metadata";

/**
 * Terms of Sale — the OPERATOR's, served on the operator's own domain.
 *
 * Previously a two-line re-export of the BudStacks platform page. See
 * app/store/[slug]/_components/LegalDocumentPage.tsx.
 */

export const dynamic = "force-dynamic";

// SEO US-007 — title, description and canonical, shared by all four documents.
export function generateMetadata(): Promise<Metadata> {
  return generateLegalDocumentMetadata("terms");
}

export default function StoreTermsPage() {
  return <LegalDocumentPage slug="terms" />;
}
