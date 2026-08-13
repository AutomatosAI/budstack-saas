/**
 * SEO Supercharge US-002 — the `generateMetadata` body every static store page
 * shares.
 *
 * NO EXTRA QUERY: `getCurrentTenant()` is React-`cache()`d (lib/tenant/tenant.ts)
 * and is the same call the page component itself makes to resolve the tenant, so
 * metadata and render split one round trip. `tenants.pageSeo` rides along on it
 * — the resolver selects the whole row (lib/tenant/tenant-resolver.ts) — which is
 * why no page needs the second `prisma.tenants.findUnique` the homepage still
 * carries.
 */

import type { Metadata } from "next";

import { buildStorePageMetadata } from "@/lib/seo/page-metadata";
import { STORE_NOT_FOUND_TITLE } from "@/lib/seo/store-metadata";
import type { StoreSeoPageKey } from "@/lib/seo/store-pages";
import { getCurrentTenant } from "@/lib/tenant/tenant";

export async function generateStorePageMetadata(
  pageKey: StoreSeoPageKey,
): Promise<Metadata> {
  const tenant = await getCurrentTenant();

  // The page itself calls notFound() for this case; metadata resolves first, so
  // it answers with the same wording the homepage uses rather than throwing.
  if (!tenant) {
    return { title: STORE_NOT_FOUND_TITLE };
  }

  return buildStorePageMetadata({
    pageKey,
    businessName: tenant.businessName,
    subdomain: tenant.subdomain,
    customDomain: tenant.customDomain,
    pageSeo: tenant.pageSeo,
  });
}
