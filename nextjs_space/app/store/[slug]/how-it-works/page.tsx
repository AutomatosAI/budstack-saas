import type { Metadata } from "next";

import { generateStoreRouteMetadata } from "@/lib/seo/generate-page-metadata";

import { HowItWorksClient } from "./how-it-works-client";

/**
 * SEO US-007 — nav- and footer-linked (components/navigation.tsx:102,
 * components/footer.tsx:145) and, until this story, carrying no title, no
 * description and no canonical.
 */
export function generateMetadata(): Promise<Metadata> {
  return generateStoreRouteMetadata("howItWorks");
}

export default function StoreHowItWorksPage() {
  return <HowItWorksClient />;
}
