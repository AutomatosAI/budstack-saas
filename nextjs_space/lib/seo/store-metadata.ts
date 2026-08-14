/**
 * SEO Supercharge US-001 — the storefront metadata foundation.
 *
 * THE DEFECT THIS CLOSES: `app/store/[slug]/layout.tsx` exported no metadata, so
 * every store page except the homepage inherited `app/layout.tsx` wholesale and
 * titled itself "BudStacks - Medical Cannabis SaaS Platform", with the
 * platform's description, og:url, twitter card and author on a tenant's own
 * pages. This module builds the layout-level metadata that replaces all of it.
 *
 * WHY A PURE BUILDER: `generateMetadata` runs in a render path with no
 * `error.tsx` boundary, so a throw there is a blank page rather than a bad tag.
 * Every input here is treated as untrusted (a Json blob, a stored asset
 * reference, a custom domain someone typed) and degrades to a sensible default
 * instead of throwing. Keeping it free of Prisma/headers also makes the
 * "no page can fall through to the platform title" guarantee directly testable.
 *
 * HOW NEXT MERGES THIS (14.2, verified against
 * `next/dist/lib/metadata/resolve-metadata.js`):
 *  - `title.template` is stashed for DEEPER segments only — the guard is
 *    `i < metadataItems.length - 2`, and the store layout sits at exactly
 *    `length - 2` for `app/store/[slug]/page.tsx`. So the homepage's own title
 *    (page.tsx `generateMetadata`) renders verbatim, un-suffixed, exactly as it
 *    does today, while /products, /the-wire/… et al. get "%s | {businessName}".
 *  - `title.default` is what a segment that sets NO title renders — which is
 *    every store page until US-002..005 give them their own.
 *  - `openGraph` and `twitter` are REPLACED, not deep-merged, by the deepest
 *    segment that declares them. Declaring them here is therefore what evicts
 *    the platform's og:url/og:title and twitter title+description from tenant
 *    pages; their own title/description are then auto-filled per page by Next's
 *    `postProcessMetadata` from the resolved title/description.
 */

import type { Metadata } from "next";

import { brandedOgImage } from "@/lib/seo/og-image";
import { storeVerificationMetadata } from "@/lib/seo/site-verification";
import {
  STORE_OG_LOCALE,
  seoText,
  storeDisplayName,
} from "@/lib/seo/store-identity";
import { storedPublicImagePath } from "@/lib/storage/public-image-url";
import { parseTenantSettings } from "@/lib/tenant/tenant-settings";
import { getTenantBaseUrl } from "@/lib/tenant/tenant-utils";

/** Platform favicon, shipped at `public/favicon.svg` — the last resort. */
export const PLATFORM_FAVICON = "/favicon.svg";

/** Title for a host that resolves to no tenant; mirrors `page.tsx`'s wording. */
export const STORE_NOT_FOUND_TITLE = "Store Not Found";

/**
 * The description every store page carries until it declares its own.
 *
 * Mirrors the homepage's existing default (`app/store/[slug]/page.tsx`) so a
 * store reads consistently, and is a tenant-branded sentence rather than the
 * platform's "Multi-tenant SaaS platform for medical cannabis dispensaries".
 */
function defaultStoreDescription(businessName: string): string {
  return `Premium medical cannabis products and consultations from ${businessName}`;
}

export interface StoreMetadataSource {
  /** `tenants.id` — labels a settings parse failure, and the plan gate's subject. */
  readonly tenantId?: string;
  /** Raw `tenants.plan` (US-018's branded og:image); fail-closed to Basic. */
  readonly plan?: unknown;
  readonly businessName: string;
  readonly subdomain: string;
  readonly customDomain: string | null;
  /** Raw `tenants.settings` Json — parsed here, never trusted. */
  readonly settings: unknown;
  /**
   * The stored favicon reference (an S3 key, a path, or a URL), already
   * cascaded by the caller across the columns that can hold one.
   */
  readonly faviconRef: string | null;
}

/**
 * `metadataBase` for a tenant: the canonical public origin every relative URL
 * in this tree resolves against (US-007 builds canonicals on the same base).
 *
 * `customDomain` reaches the DB from domain provisioning and the super-admin
 * form, so it can be a value `new URL` rejects. That must not take the whole
 * page down for a metadata field, hence the fall back to the always-well-formed
 * subdomain origin, and finally to `undefined` (Next's own default handling).
 */
function storeMetadataBase(
  subdomain: string,
  customDomain: string | null,
): URL | undefined {
  const candidates = customDomain
    ? [
        getTenantBaseUrl({ subdomain, customDomain }),
        getTenantBaseUrl({ subdomain, customDomain: null }),
      ]
    : [getTenantBaseUrl({ subdomain, customDomain: null })];

  for (const candidate of candidates) {
    try {
      return new URL(candidate);
    } catch {
      // Not a URL — try the next candidate.
    }
  }
  return undefined;
}

/**
 * Layout-level metadata for a tenant storefront. Every field here is a DEFAULT
 * that a deeper page may override; nothing here is page-specific (no canonical,
 * no og:url — a store-root URL on a product page would be a worse tag than
 * none, and US-007 emits those per page).
 */
export function buildStoreMetadata(source: StoreMetadataSource): Metadata {
  // A blank businessName would render an empty <title>, which is no better than
  // the platform one; the subdomain is the tenant's other public identity.
  const businessName =
    storeDisplayName(source.businessName, source.subdomain) ||
    STORE_NOT_FOUND_TITLE;

  const settings = parseTenantSettings(source.settings, {
    tenantId: source.tenantId,
  });
  const description =
    seoText(settings.tagline) || defaultStoreDescription(businessName);

  const favicon =
    storedPublicImagePath(source.faviconRef) ?? PLATFORM_FAVICON;

  // US-018 — the store card, for any page that declares no openGraph of its
  // own. That is a shrinking set (US-002..007 gave the rest their own, and a
  // deeper segment REPLACES this block wholesale rather than merging into it),
  // so each of those builders carries the same fallback for itself. Null for a
  // Basic tenant, and then nothing is emitted at all.
  const brandedOg = brandedOgImage({
    tenantId: source.tenantId,
    plan: source.plan,
    kind: "store",
  });

  // US-026 — the Search Console / Bing tokens, declared on the LAYOUT so every
  // page of the store carries them. Unlike `openGraph` above, `verification` is
  // merged field-by-field by Next, and no store page declares one of its own, so
  // this reaches all of them. Undefined for a Basic tenant, and for a Pro tenant
  // who has verified nothing — and then no tag is emitted at all.
  const verification = storeVerificationMetadata({
    tenantId: source.tenantId,
    plan: source.plan,
    settings,
  });

  return {
    metadataBase: storeMetadataBase(source.subdomain, source.customDomain),
    title: {
      template: `%s | ${businessName}`,
      default: businessName,
    },
    description,
    // Otherwise every store page carries `<meta name="author" content="BudStacks">`.
    authors: [{ name: businessName }],
    icons: { icon: favicon, shortcut: favicon, apple: favicon },
    openGraph: {
      siteName: businessName,
      type: "website",
      locale: STORE_OG_LOCALE,
      ...(brandedOg ? { images: [brandedOg] } : {}),
    },
    // Declared so the platform's twitter:title / twitter:description cannot
    // survive into a tenant page; Next refills both from this page's own
    // resolved title and description.
    twitter: { card: "summary_large_image" },
    ...(verification ? { verification } : {}),
  };
}
