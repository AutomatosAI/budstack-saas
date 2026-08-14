/**
 * SEO Supercharge US-014 — the JSON-LD engine.
 *
 * THE DEFECT THIS CLOSES: the platform emitted ZERO structured data. Not a
 * single `application/ld+json` block existed anywhere in the repo, so no
 * storefront could ever produce a rich result — no knowledge panel, no
 * breadcrumb trail, no price or availability in the SERP itself. Workstream A
 * made the metadata real; this is where the machine-readable layer starts.
 *
 * TWO RULES THIS MODULE EXISTS TO ENFORCE, both of which are easy to get wrong
 * once per page rather than once per app:
 *
 *  1. ONE SERIALIZER. `serializeJsonLd` is the only way a node reaches the DOM.
 *     `JSON.stringify` alone is a stored-XSS sink inside a `<script>` element:
 *     a `businessName` of `</script><script>alert(1)</script>` closes OUR tag
 *     and opens the attacker's, and the CSP nonce does not save us because the
 *     injected tag inherits nothing — it is simply a new inline script that
 *     `strict-dynamic` will refuse, leaving a broken page and a proven sink.
 *     Escaping `<` to the JSON escape `\u003c` (which parses straight back
 *     to `<`) means no string in any node can terminate the element it lives
 *     in, whatever an owner types into the SEO Manager.
 *
 *  2. PRO ONLY, BY DEGRADING. `buildStoreJsonLd` returns an EMPTY array for a
 *     tenant without `seo.pro`, and an empty array serializes to null, so the
 *     component renders nothing at all. That is the storefront contract from
 *     `lib/entitlements/require-feature.ts`: a missing Pro feature degrades
 *     rendering, it never 403s a shopper or blocks commerce.
 *
 * PURE MODULE — no Prisma, no headers, no React. It runs in the store page's
 * render path, which has no `error.tsx` boundary above it, so every input is
 * treated as untrusted and degrades to omission rather than throwing.
 */

import { storeCanonical } from "@/lib/seo/canonical";
import { isSeoProUnlocked } from "@/lib/seo/pro-features";
import { normalizeSocialLinks } from "@/lib/seo/social-links";
import { seoText, storeDisplayName } from "@/lib/seo/store-identity";
import { storedPublicImagePath } from "@/lib/storage/public-image-url";

/** The vocabulary every node in this app is expressed in. */
export const JSON_LD_CONTEXT = "https://schema.org";

/** The `type` attribute of the script element the serialized output belongs in. */
export const JSON_LD_SCRIPT_TYPE = "application/ld+json";

/**
 * One schema.org node. `@type` is required because a node without one is not
 * addressable by any consumer; everything else is open, since the vocabulary is
 * far larger than the handful of properties Workstream C uses.
 */
export interface JsonLdNode {
  readonly "@type": string;
  readonly [property: string]: unknown;
}

/**
 * Characters that can end the `<script>` element (or, for the line separators,
 * silently corrupt the block when it is copied into a JS context). Each maps to
 * an escape sequence `JSON.parse` turns straight back into the original
 * character, so the emitted markup differs from `JSON.stringify` output while
 * the parsed VALUE is byte-identical.
 */
const JSON_LD_UNSAFE = /[<>&\u2028\u2029]/g;

const JSON_LD_ESCAPES: Readonly<Record<string, string>> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

/** `</script>`-safe form of an already-serialized JSON string. */
export function escapeJsonLd(json: string): string {
  return json.replace(JSON_LD_UNSAFE, (char) => JSON_LD_ESCAPES[char]);
}

/**
 * THE renderer: nodes → the exact string that goes inside the script element,
 * or null when there is nothing to emit (no nodes, or a value that will not
 * serialize). Null is the caller's signal to render no element at all — an
 * empty `<script type="application/ld+json"></script>` is a parse error to
 * every consumer that reads it.
 *
 * A single node is emitted as a plain object with `@context`; two or more go in
 * an `@graph`, which is how one block carries several entities that reference
 * each other by `@id`.
 */
export function serializeJsonLd(nodes: readonly JsonLdNode[]): string | null {
  if (nodes.length === 0) return null;

  const document =
    nodes.length === 1
      ? { "@context": JSON_LD_CONTEXT, ...nodes[0] }
      : { "@context": JSON_LD_CONTEXT, "@graph": nodes };

  try {
    const json = JSON.stringify(document);
    // `undefined` back from stringify means the value was not representable.
    return json ? escapeJsonLd(json) : null;
  } catch {
    return null;
  }
}

/** The `tenants` address columns, exactly as the row carries them. */
export interface StoreAddressSource {
  readonly businessAddress1: unknown;
  readonly businessAddress2: unknown;
  readonly businessCity: unknown;
  readonly businessState: unknown;
  readonly businessPostalCode: unknown;
  readonly businessCountry: unknown;
}

export interface StoreJsonLdSource extends StoreAddressSource {
  /** `tenants.id` — the plan gate's subject. */
  readonly id: string;
  /** Raw `tenants.plan`; parsed fail-closed downstream. */
  readonly plan: unknown;
  readonly businessName: unknown;
  readonly subdomain: string;
  readonly customDomain: string | null;
  /**
   * The stored logo reference (an S3 key, a path, or a URL), already cascaded
   * by the caller across the columns that can hold one. Resolved through
   * `storedPublicImagePath`, so an expiring presigned URL becomes NO logo
   * rather than a `logo` property that 403s a month from now.
   */
  readonly logoRef: string | null;
  /**
   * US-006 — the store's profiles elsewhere, already resolved by the caller
   * through `tenantSocialLinks`. Re-normalised inside the builder; see
   * {@link buildOrganizationNode} for why it is not optional.
   */
  readonly socialLinks: readonly string[];
}

/**
 * PostalAddress, or null when the tenant has not filled in enough of one.
 *
 * Street, locality and country are the floor. Below it we emit no address and
 * therefore no LocalBusiness: a PostalAddress carrying only a city is not a
 * smaller truth than a full one, it is an entity a validator rejects and a
 * consumer cannot place on a map. Region and postal code ride along when set.
 *
 * Address line 2 is folded into `streetAddress` — schema.org has no second
 * street property, and dropping it would lose the unit or floor.
 */
export function buildPostalAddress(
  source: StoreAddressSource,
): JsonLdNode | null {
  // Line 1 specifically, not "either line": a tenant who filled in only line 2
  // has an address of "Unit 4", which is the half-empty PostalAddress this
  // function exists to refuse.
  const street = seoText(source.businessAddress1);
  const addressLocality = seoText(source.businessCity);
  const addressCountry = seoText(source.businessCountry);

  if (!street || !addressLocality || !addressCountry) return null;

  const unit = seoText(source.businessAddress2);
  const streetAddress = unit ? `${street}, ${unit}` : street;

  const addressRegion = seoText(source.businessState);
  const postalCode = seoText(source.businessPostalCode);

  return {
    "@type": "PostalAddress",
    streetAddress,
    addressLocality,
    ...(addressRegion ? { addressRegion } : {}),
    ...(postalCode ? { postalCode } : {}),
    addressCountry,
  };
}

/**
 * Absolute URL for a store-relative asset path, or null when it will not parse.
 * JSON-LD is read out of band by a crawler that has no page to resolve a
 * relative reference against, so a relative `logo` is a broken one.
 *
 * Shared with the per-entity builders (US-015's Product image): every image that
 * reaches a JSON-LD node goes through `storedPublicImagePath` first, so a
 * presigned S3 URL resolves to NO image rather than to one that 403s.
 */
export function absoluteAssetUrl(
  storeUrl: string,
  ref: string | null,
): string | null {
  const path = storedPublicImagePath(ref);
  if (!path) return null;
  try {
    return new URL(path, storeUrl).toString();
  } catch {
    return null;
  }
}

/**
 * The store's Organization `@id`.
 *
 * ONE function, because the value is a JOIN KEY: US-016's Article references
 * `{ "@id": … }` for its publisher, and a reference that does not match the node
 * it points at is a publisher with no name rather than a resolution failure a
 * validator reports.
 *
 * Anchored to the store's own origin (not the platform's) so two tenants can
 * never share an identity, and fragment-suffixed so it names the ENTITY rather
 * than the page — the homepage document is `${url}`, the organization it
 * describes is `${url}/#organization`.
 */
export function organizationJsonLdId(storeUrl: string): string {
  return `${storeUrl}/#organization`;
}

/**
 * The store as an Organization.
 *
 * Emitted on every page that references it, NOT only on the homepage: structured
 * data is parsed per URL, so an `@id` pointing at a node defined on a different
 * page hands the consumer an entity with no properties at all (the rule US-015
 * wrote down for Product `brand`). Restating it here is what makes the reference
 * resolve, and routing every caller through this function is what stops the two
 * statements of the same `@id` from disagreeing.
 *
 * `socialLinks` is REQUIRED rather than defaulted for exactly that reason
 * (LLM Visibility US-006): a caller that could omit it would publish an
 * Organization asserting this store has no profiles anywhere, on a page whose
 * `@id` the homepage states WITH them. Both call sites resolve the list through
 * `lib/seo/tenant-social-links.ts`, the same way both resolve the logo through
 * `lib/seo/tenant-logo.ts`.
 */
export function buildOrganizationNode(
  storeUrl: string,
  name: string,
  logoRef: string | null,
  socialLinks: readonly string[],
): JsonLdNode {
  const logo = absoluteAssetUrl(storeUrl, logoRef);
  // Re-normalised here rather than trusted: this is the last point before a
  // string becomes a published claim about who the store is, and the builder is
  // reachable from any caller that assembles a list some other way.
  const sameAs = normalizeSocialLinks(socialLinks);

  return {
    "@type": "Organization",
    "@id": organizationJsonLdId(storeUrl),
    name,
    url: storeUrl,
    ...(logo ? { logo } : {}),
    // Omitted entirely when there is nothing to say. An empty `sameAs: []` is
    // not "we have not told you yet", it is a positive assertion that this
    // entity has no other presence at all — worse than silence, and free to
    // avoid.
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

/**
 * The store's identity nodes: Organization always, LocalBusiness when there is
 * a complete address to anchor it to.
 *
 * Empty array when the tenant's plan does not include `seo.pro`, or when the
 * tenant has no usable name — an Organization without a `name` is not a partial
 * entity, it is an invalid one.
 *
 * Both nodes carry a stable `@id` on the store's own origin so later Workstream
 * C stories (Product `brand`, Article `publisher`) can reference this entity
 * instead of restating it on every page.
 */
export function buildStoreJsonLd(
  source: StoreJsonLdSource,
): readonly JsonLdNode[] {
  if (!isSeoProUnlocked({ id: source.id, plan: source.plan })) return [];

  const name = storeDisplayName(source.businessName, source.subdomain);
  if (!name) return [];

  const url = storeCanonical(
    { subdomain: source.subdomain, customDomain: source.customDomain },
    "",
  );
  const logo = absoluteAssetUrl(url, source.logoRef);
  const organization = buildOrganizationNode(
    url,
    name,
    source.logoRef,
    source.socialLinks,
  );

  const address = buildPostalAddress(source);
  if (!address) return [organization];

  return [
    organization,
    {
      "@type": "LocalBusiness",
      "@id": `${url}/#localbusiness`,
      name,
      url,
      // `image` rather than `logo`: it is the property Google's LocalBusiness
      // documentation reads, and the same asset serves both.
      ...(logo ? { image: logo } : {}),
      address,
    },
  ];
}
