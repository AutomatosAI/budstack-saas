/**
 * SEO Supercharge US-015 — Product + Offer structured data for a storefront
 * product page.
 *
 * THE GAP THIS CLOSES: US-004 gave product pages a title, a description and an
 * og:image, which is what a link preview needs. It is NOT what a shopping
 * crawler reads. Price, currency and availability reach a search result only
 * through a `Product`/`Offer` node, so until now the most commercially valuable
 * page type in every store was invisible to the surfaces that show prices.
 *
 * WHERE EACH FIELD COMES FROM, and why it is not the other place it could:
 *
 *  - name, image, price, currency, stock, THC/CBD, strain type — the LIVE Dr
 *    Green strain, the same `cache()`d fetch `generateMetadata` and the page
 *    body already resolve. The local `products` row carries `thcContent`,
 *    `cbdContent` and `strainType` too, but they are a SYNC SNAPSHOT of these
 *    exact upstream fields (app/api/tenant-admin/products/sync/route.ts:61-63),
 *    so falling back to them would emit a THC figure the page itself no longer
 *    displays. Structured data that disagrees with the rendered page is the one
 *    thing Google explicitly penalises, so there is no fallback: what the
 *    shopper sees is what the crawler is told.
 *  - description — the authored `products.seo.description` when there is one,
 *    else the truncated strain copy. That is US-004's cascade exactly
 *    (lib/seo/product-metadata.ts), so this block can never contradict the
 *    `<meta name="description">` sitting a few lines above it in the same head.
 *
 * THE CURRENCY RULE. `priceCurrency` is ISO 4217 and nothing else.
 * `DoctorGreenProduct` carries BOTH `currency` (a display SYMBOL — "R", "€",
 * from `getCurrencySymbol`, lib/drgreen/doctor-green-api.ts:286) and
 * `currencyCode` (the actual code). Wiring the wrong one is a live bug class in
 * this repo — `product-detail-client.tsx:186` reads `product.currency || "EUR"`,
 * which hardcodes euros onto a South African store. So the code is VALIDATED
 * here, not trusted: a symbol fails the three-letter test and the whole node is
 * dropped, because a wrong `priceCurrency` misprices a product in the SERP,
 * which is worse than no rich result at all.
 *
 * PRICE IS PER GRAM — the number the listing card and the detail page both
 * render as the headline price (`product-card.tsx:38,134`, "per gram"), emitted
 * with the same two decimals they display. Same parity rule as above.
 *
 * GATED, BY DEGRADING. A tenant without `seo.pro` gets an empty array, which
 * `<JsonLd>` renders as no element at all. The storefront never blocks on plan
 * (lib/entitlements/require-feature.ts) — a Basic product page still sells, it
 * just does not carry the schema.
 *
 * Pure and total, like every builder in this directory: it runs in a render path
 * with no `error.tsx` boundary above it, over an untyped upstream payload, so
 * every input is read defensively and every failure degrades to omission.
 */

import { storeCanonical } from "@/lib/seo/canonical";
import { readEntitySeo } from "@/lib/seo/entity-seo";
import { absoluteAssetUrl, type JsonLdNode } from "@/lib/seo/json-ld";
import { productPath } from "@/lib/seo/product-paths";
import { isSeoProUnlocked } from "@/lib/seo/pro-features";
import {
  seoText,
  storeDisplayName,
  truncateSeoText,
} from "@/lib/seo/store-identity";

/** schema.org availability values, spelled as the full URLs Google documents. */
export const SCHEMA_IN_STOCK = "https://schema.org/InStock";
export const SCHEMA_OUT_OF_STOCK = "https://schema.org/OutOfStock";

/** `additionalProperty` labels — stable, because a consumer matches on them. */
const THC_PROPERTY_NAME = "THC content";
const CBD_PROPERTY_NAME = "CBD content";
const STRAIN_TYPE_PROPERTY_NAME = "Strain type";

/** Cannabinoid content is a percentage, displayed to one decimal on the page. */
const CANNABINOID_UNIT = "%";
const CANNABINOID_DECIMALS = 1;

/** Money, at the precision the storefront prints it. */
const PRICE_DECIMALS = 2;

/** ISO 4217 is exactly three letters — a currency SYMBOL cannot pass this. */
const ISO_4217 = /^[A-Za-z]{3}$/;

export interface ProductJsonLdSource {
  /** `tenants.id` — the plan gate's subject. */
  readonly tenantId: string;
  /** Raw `tenants.plan`; parsed fail-closed by the gate. */
  readonly plan: unknown;
  readonly businessName: unknown;
  readonly subdomain: string;
  readonly customDomain: string | null;
  /** The Dr Green strain id this URL names — the canonical path segment. */
  readonly productId: string;
  /** Live strain fields. `unknown`: they come off an untyped upstream payload. */
  readonly name: unknown;
  readonly description: unknown;
  readonly imageUrl: unknown;
  /** Local unit price, already converted by `normalizeProduct`. */
  readonly price: unknown;
  /** ISO code from `normalizeProduct` — NOT the display symbol. */
  readonly currencyCode: unknown;
  /** `in_stock`, which `normalizeProduct` derives from the sellable locations. */
  readonly inStock: unknown;
  readonly thcContent: unknown;
  readonly cbdContent: unknown;
  readonly strainType: unknown;
  /** Raw `products.seo` Json from the LOCAL row — parsed here, never trusted. */
  readonly seo: unknown;
}

/** A finite number from an untyped payload, or null. Numeric strings included. */
function seoNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * A number the storefront treats as PRESENT.
 *
 * Zero counts as absent, which is the convention the pages already follow:
 * `normalizeProduct` coerces a missing cannabinoid reading to 0
 * (doctor-green-api.ts:298-299) and both the card and the detail page hide the
 * badge for a falsy value. A `0%` THC claim in the schema would therefore assert
 * something the page does not show.
 */
function presentNumber(value: unknown): number | null {
  const parsed = seoNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** The ISO 4217 code, upper-cased — or null for anything that is not one. */
function isoCurrency(value: unknown): string | null {
  const code = seoText(value);
  return ISO_4217.test(code) ? code.toUpperCase() : null;
}

/** One `PropertyValue`, or null when the reading is absent. */
function cannabinoidProperty(
  name: string,
  value: unknown,
): JsonLdNode | null {
  const content = presentNumber(value);
  if (content === null) return null;

  return {
    "@type": "PropertyValue",
    name,
    value: roundTo(content, CANNABINOID_DECIMALS),
    unitText: CANNABINOID_UNIT,
  };
}

/**
 * The strain's own attributes: THC, CBD, and Indica/Sativa/Hybrid. Empty when
 * the payload carries none of them, so the caller omits the key entirely rather
 * than emitting `additionalProperty: []`.
 */
function buildAdditionalProperties(
  source: ProductJsonLdSource,
): readonly JsonLdNode[] {
  const strainType = seoText(source.strainType);

  return [
    cannabinoidProperty(THC_PROPERTY_NAME, source.thcContent),
    cannabinoidProperty(CBD_PROPERTY_NAME, source.cbdContent),
    strainType
      ? {
          "@type": "PropertyValue",
          name: STRAIN_TYPE_PROPERTY_NAME,
          value: strainType,
        }
      : null,
  ].filter((property): property is JsonLdNode => property !== null);
}

/**
 * The product's image as an absolute URL, or null.
 *
 * Same cascade and the same fail-closed rule as US-004's `og:image`: an authored
 * override first, then the live strain shot, and a presigned S3 URL resolves to
 * NOTHING rather than to a link that 403s an hour after it is minted. Absolute
 * because JSON-LD is read out of band by a crawler with no page to resolve a
 * relative reference against.
 */
function productImageUrl(
  storeUrl: string,
  source: ProductJsonLdSource,
): string | null {
  const seo = readEntitySeo(source.seo);
  return (
    absoluteAssetUrl(storeUrl, seo.ogImage ?? null) ??
    absoluteAssetUrl(storeUrl, seoText(source.imageUrl) || null)
  );
}

/**
 * The `Product` node for a storefront product page, or an empty array.
 *
 * Empty for four reasons, all of which are ordinary states rather than errors:
 * the tenant is not on Pro; the strain has no name; the strain has no usable
 * price; or its currency is not an ISO code. The last two are one rule — an
 * `Offer` is the entire commercial point of this node, and a `Product` carrying
 * an empty or half-priced offer earns a Search Console warning instead of a
 * rich result.
 */
export function buildProductJsonLd(
  source: ProductJsonLdSource,
): readonly JsonLdNode[] {
  if (!isSeoProUnlocked({ id: source.tenantId, plan: source.plan })) return [];

  const name = seoText(source.name);
  if (!name) return [];

  const price = presentNumber(source.price);
  const priceCurrency = isoCurrency(source.currencyCode);
  if (price === null || !priceCurrency) return [];

  const storeUrl = storeCanonical(source, "");
  const url = storeCanonical(source, productPath(source.productId));

  const seo = readEntitySeo(source.seo);
  const description =
    seoText(seo.description) || truncateSeoText(source.description);
  const image = productImageUrl(storeUrl, source);
  const brandName = storeDisplayName(source.businessName, source.subdomain);
  const additionalProperty = buildAdditionalProperties(source);

  return [
    {
      "@type": "Product",
      "@id": `${url}#product`,
      name,
      ...(description ? { description } : {}),
      ...(image ? { image } : {}),
      // A `Brand` node restating the name, NOT an `@id` reference to the
      // Organization the home page declares: structured data is parsed per
      // page, so a reference to a node defined on a different URL hands the
      // consumer a brand with no name at all.
      ...(brandName ? { brand: { "@type": "Brand", name: brandName } } : {}),
      ...(additionalProperty.length > 0 ? { additionalProperty } : {}),
      offers: {
        "@type": "Offer",
        url,
        // A string at the printed precision: it is the exact number the page
        // shows, and it cannot arrive as a float artefact from the EUR
        // conversion in `normalizeProduct`.
        price: price.toFixed(PRICE_DECIMALS),
        priceCurrency,
        // Only an explicit `true` is in stock. `normalizeProduct` always sets a
        // boolean, so this is exact for a normalized payload and fails closed
        // for anything else — claiming stock a store does not have is the
        // availability mismatch that costs a merchant their rich results.
        availability:
          source.inStock === true ? SCHEMA_IN_STOCK : SCHEMA_OUT_OF_STOCK,
      },
    },
  ];
}
