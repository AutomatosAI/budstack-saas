import type { Metadata } from "next";

import { generateStoreRouteMetadata } from "@/lib/seo/generate-page-metadata";

import { ProductsListClient } from "./products-list-client";

/**
 * SEO US-007 — the catalogue had no metadata at all: it inherited the store
 * layout's title and description and, being a client component, could not
 * declare a canonical. A tenant on a custom domain therefore published the same
 * catalogue on two hosts with nothing saying which one owned it.
 */
export function generateMetadata(): Promise<Metadata> {
  return generateStoreRouteMetadata("products");
}

export default function StoreProductsPage() {
  return <ProductsListClient />;
}
