/**
 * SEO Supercharge US-002 — the `generateMetadata` body every static store page
 * shares. US-007 added the two variants below for the routes that carry no
 * authorable SEO record.
 *
 * NO EXTRA QUERY: `getCurrentTenant()` is React-`cache()`d (lib/tenant/tenant.ts)
 * and is the same call the page component itself makes to resolve the tenant, so
 * metadata and render split one round trip. `tenants.pageSeo` rides along on it
 * — the resolver selects the whole row (lib/tenant/tenant-resolver.ts) — which is
 * why no page needs the second `prisma.tenants.findUnique` the homepage still
 * carries.
 */

import type { Metadata } from "next";

import type { LegalDocumentSlug } from "@/lib/legal/documents";
import { buildStorePageMetadata } from "@/lib/seo/page-metadata";
import {
  buildLegalDocumentMetadata,
  buildStoreRouteMetadata,
  type StoreRouteKey,
} from "@/lib/seo/route-metadata";
import { STORE_NOT_FOUND_TITLE } from "@/lib/seo/store-metadata";
import type { StoreSeoPageKey } from "@/lib/seo/store-pages";
import { getCurrentTenant } from "@/lib/tenant/tenant";

/**
 * The metadata a store page carries when the host resolves to no tenant. Every
 * such page calls `notFound()` in its body; metadata resolves first, so it
 * answers with the homepage's wording rather than throwing (`generateMetadata`
 * has no error.tsx boundary above it).
 */
const NO_TENANT_METADATA: Metadata = { title: STORE_NOT_FOUND_TITLE };

export async function generateStorePageMetadata(
  pageKey: StoreSeoPageKey,
): Promise<Metadata> {
  const tenant = await getCurrentTenant();
  if (!tenant) return NO_TENANT_METADATA;

  return buildStorePageMetadata({
    pageKey,
    businessName: tenant.businessName,
    subdomain: tenant.subdomain,
    customDomain: tenant.customDomain,
    pageSeo: tenant.pageSeo,
  });
}

/**
 * US-007 — for a storefront route the SEO Manager does not offer
 * (`/products`, `/how-it-works`, `/consultation`, `/blockchain`).
 */
export async function generateStoreRouteMetadata(
  route: StoreRouteKey,
): Promise<Metadata> {
  const tenant = await getCurrentTenant();
  if (!tenant) return NO_TENANT_METADATA;

  return buildStoreRouteMetadata(route, {
    businessName: tenant.businessName,
    subdomain: tenant.subdomain,
    customDomain: tenant.customDomain,
  });
}

/**
 * US-007 — for one of the operator's four legal documents.
 *
 * One body for all four, for the same reason `LegalDocumentPage` is one
 * component: they drifted apart once already. Each route file previously had
 * its own copy that hardcoded the document title and appended
 * " | {businessName}" by hand — which US-001's layout template then suffixed a
 * SECOND time, so a store served "Privacy Policy | Acme | Acme" and no canonical
 * on either host.
 */
export async function generateLegalDocumentMetadata(
  slug: LegalDocumentSlug,
): Promise<Metadata> {
  const tenant = await getCurrentTenant();
  if (!tenant) return NO_TENANT_METADATA;

  return buildLegalDocumentMetadata(slug, {
    businessName: tenant.businessName,
    subdomain: tenant.subdomain,
    customDomain: tenant.customDomain,
  });
}
