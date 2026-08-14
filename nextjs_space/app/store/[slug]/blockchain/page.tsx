import type { Metadata } from "next";

import { generateStoreRouteMetadata } from "@/lib/seo/generate-page-metadata";

import { BlockchainClient } from "./blockchain-client";

/**
 * SEO US-007 — public and crawlable but linked from no storefront nav or footer
 * (grep: nothing outside this directory references /blockchain). It still served
 * on both a tenant's custom domain and their subdomain with no canonical, so it
 * gets the same treatment as every other store page rather than an exception.
 */
export function generateMetadata(): Promise<Metadata> {
  return generateStoreRouteMetadata("blockchain");
}

export default function StoreBlockchainPage() {
  return <BlockchainClient />;
}
