import type { Metadata } from "next";
import { cache } from "react";

import { JsonLd } from "@/components/seo/json-ld";
import { prisma } from "@/lib/db";
import {
  buildBreadcrumbJsonLd,
  productBreadcrumbTrail,
} from "@/lib/seo/breadcrumb-json-ld";
import {
  fetchProduct,
  type DoctorGreenProduct,
} from "@/lib/drgreen/doctor-green-api";
import { logger } from "@/lib/logger";
import { readEntitySeo } from "@/lib/seo/entity-seo";
import {
  buildProductJsonLd,
  type ProductJsonLdSource,
} from "@/lib/seo/product-json-ld";
import {
  PRODUCT_NOT_FOUND_TITLE,
  buildProductMetadata,
} from "@/lib/seo/product-metadata";
import { STORE_NOT_FOUND_TITLE } from "@/lib/seo/store-metadata";
import { getCurrentTenant } from "@/lib/tenant/tenant";
import { getTenantDrGreenConfig } from "@/lib/tenant/tenant-config";
import { runWithTenantContextAsync } from "@/lib/tenant/tenant-context";

import { ProductDetailClient } from "./product-detail-client";

interface ProductDetailPageProps {
  params: {
    slug: string;
    id: string;
  };
}

/**
 * The fallback the page body's own API route uses when a tenant row carries a
 * blank country (app/api/store/[slug]/products/route.ts:43). Repeated rather
 * than imported so metadata and the body cannot resolve DIFFERENT catalogues.
 */
const DEFAULT_COUNTRY_CODE = "ZA";

/**
 * The SEO override the owner authored for this strain, or null.
 *
 * Matched on `drGreenStrainId`, NOT on `products.id`: the URL names a Dr Green
 * strain and the local row is the join (app/api/tenant-admin/products/sync/
 * route.ts:58). The row shape is stated explicitly because the `prisma` export
 * in lib/db.ts is any-widened by its build-time mock Proxy — through a generic
 * (`runWithTenantContextAsync<T>`) `any` collapses the inferred T to `{}`.
 *
 * `findFirst` with flat fields, and bound to a tenant context: `products` is
 * tenant-scoped in lib/db.ts, so without the binding the $extends layer sees an
 * UNBOUND context, warns on `security.tenant_context_missing` and would throw
 * under TENANT_CONTEXT_STRICT — inside metadata, where a throw is a blank page.
 * The explicit `tenantId` in the `where` is what makes the query correct; the
 * binding is what makes it legal. (Same pattern as the Wire article page, US-003.)
 * The extension also injects `deletedAt: null` (lib/soft-delete.ts:35), so a
 * soft-deleted row cannot resurrect its metadata onto a live strain.
 */
interface ProductSeoRow {
  readonly seo: unknown;
}

const loadProductSeoRow = cache(
  async (
    tenantId: string,
    drGreenStrainId: string,
  ): Promise<ProductSeoRow | null> =>
    runWithTenantContextAsync<ProductSeoRow | null>(tenantId, () =>
      prisma.products.findFirst({
        where: { tenantId, drGreenStrainId },
        select: { seo: true },
      }),
    ),
);

/**
 * The live strain this URL names, or null — the SAME source the page body
 * reaches through `/api/store/[slug]/products?id=…`, which resolves a product as
 * `fetchProducts(country, config).find(p => p.id === productId)`
 * (app/api/store/[slug]/products/route.ts:53-55). `fetchProduct` is that lookup,
 * over a 60s in-memory list cache; React `cache()` dedupes it per request on top.
 *
 * Total by construction. `getTenantDrGreenConfig` throws on missing or
 * undecryptable credentials and `fetchProduct` throws on an unknown id or an
 * unreachable upstream — all of which are ordinary states for a storefront, and
 * none of which may take the page down: `generateMetadata` has no `error.tsx`
 * boundary above it, so a throw here is a blank page rather than a missing tag.
 */
const loadLiveProduct = cache(
  async (
    tenantId: string,
    countryCode: string,
    productId: string,
  ): Promise<DoctorGreenProduct | null> => {
    try {
      const config = await getTenantDrGreenConfig(tenantId);
      return await fetchProduct(productId, countryCode, config);
    } catch (error) {
      // Ids and the failure reason only — the config carries Dr Green
      // credentials and never reaches a log line.
      logger.warn("[seo] product metadata: live strain unavailable", {
        tenantId,
        productId,
        reason: error instanceof Error ? error.message : "unknown",
      });
      return null;
    }
  },
);

/** SEO US-004 — products.seo over the live strain, on the page that had none. */
export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { title: STORE_NOT_FOUND_TITLE };

  const product = await loadLiveProduct(
    tenant.id,
    tenant.countryCode || DEFAULT_COUNTRY_CODE,
    params.id,
  );
  // The body renders its "Product not found" alert for the same case; metadata
  // resolves first, so it answers with the matching title instead of throwing.
  if (!product) return { title: PRODUCT_NOT_FOUND_TITLE };

  const local = await loadProductSeoRow(tenant.id, product.id);

  return buildProductMetadata({
    businessName: tenant.businessName,
    subdomain: tenant.subdomain,
    customDomain: tenant.customDomain,
    // US-018 — the plan gate for the branded og:image fallback.
    tenantId: tenant.id,
    plan: tenant.plan,
    // The RESOLVED id, not the raw param: they are equal whenever the lookup
    // succeeded, and this is the one the catalogue agrees with.
    productId: product.id,
    name: product.name,
    description: product.description,
    imageUrl: product.image_url ?? product.imageUrl,
    seo: local?.seo ?? null,
  });
}

/**
 * The live strain and the local row behind it, resolved once for everything the
 * server side of this page needs: US-009's authored alt text and US-015's
 * Product JSON-LD.
 *
 * BOTH loaders are the `cache()`d ones `generateMetadata` already calls with the
 * same arguments, so on a normal render this costs NOTHING: React dedupes them
 * within the request. It resolves the live strain first for the same reason
 * metadata does — the row is matched on `drGreenStrainId`, and the resolved id
 * is the one the catalogue agrees with.
 *
 * The storefront product API serves the Dr Green payload verbatim
 * (app/api/store/[slug]/products/route.ts:68-79) and no local row, so this is
 * the seam where an authored value reaches the client without adding a DB read
 * to a force-dynamic commerce route.
 */
async function loadProductForRender(
  tenantId: string,
  countryCode: string,
  productId: string,
): Promise<{
  product: DoctorGreenProduct | null;
  seo: unknown;
}> {
  const product = await loadLiveProduct(tenantId, countryCode, productId);
  if (!product) return { product: null, seo: null };

  const local = await loadProductSeoRow(tenantId, product.id);
  return { product, seo: local?.seo ?? null };
}

/**
 * SEO US-015 — the Product/Offer node, built from the SAME live strain the body
 * renders. Nothing here can block the page: `buildProductJsonLd` returns [] for
 * a Basic tenant, for a strain with no price and for a currency that is not an
 * ISO code, and `<JsonLd>` renders nothing for [].
 */
function productJsonLdSource(
  tenant: NonNullable<Awaited<ReturnType<typeof getCurrentTenant>>>,
  product: DoctorGreenProduct,
  seo: unknown,
): ProductJsonLdSource {
  return {
    tenantId: tenant.id,
    plan: tenant.plan,
    businessName: tenant.businessName,
    subdomain: tenant.subdomain,
    customDomain: tenant.customDomain,
    productId: product.id,
    name: product.name,
    description: product.description,
    imageUrl: product.image_url ?? product.imageUrl,
    price: product.price,
    // The ISO code, never `product.currency` — that one is a display symbol.
    currencyCode: product.currencyCode,
    inStock: product.in_stock,
    thcContent: product.thc_content ?? product.thc,
    cbdContent: product.cbd_content ?? product.cbd,
    // `type` is what the page prints (product-detail-client.tsx:344); the
    // normalized `strain_type` is the upper-cased fallback for a blank one.
    strainType: product.type || product.strain_type,
    seo,
  };
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const tenant = await getCurrentTenant();

  const { product, seo } = tenant
    ? await loadProductForRender(
        tenant.id,
        tenant.countryCode || DEFAULT_COUNTRY_CODE,
        params.id,
      )
    : { product: null, seo: null };

  const imageAlt = readEntitySeo(seo).imageAlt ?? "";
  // US-015's Product/Offer and US-016's breadcrumb in ONE block: they describe
  // the same page, and `serializeJsonLd` puts several nodes in one `@graph`.
  const jsonLdNodes =
    tenant && product
      ? [
          ...buildProductJsonLd(productJsonLdSource(tenant, product, seo)),
          ...buildBreadcrumbJsonLd(
            {
              tenantId: tenant.id,
              plan: tenant.plan,
              subdomain: tenant.subdomain,
              customDomain: tenant.customDomain,
            },
            // The RESOLVED strain id, which is the one the URL is keyed by.
            productBreadcrumbTrail(product.name, product.id),
          ),
        ]
      : [];

  return (
    <>
      <JsonLd nodes={jsonLdNodes} />
      <ProductDetailClient imageAlt={imageAlt} />
    </>
  );
}
