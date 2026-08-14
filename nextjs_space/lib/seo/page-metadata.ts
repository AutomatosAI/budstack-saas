/**
 * SEO Supercharge US-002 — metadata for the storefront's static pages.
 *
 * THE DEFECT THIS CLOSES: `tenants.pageSeo` was write-only for every key except
 * `home`. An owner could fill in About and Contact in the SEO Manager, see them
 * saved, and have the pages keep rendering the layout defaults — nothing read
 * the column back (grep: only app/store/[slug]/page.tsx:379-382 did).
 *
 * WHAT IT EMITS, and how it composes with the US-001 layout metadata (semantics
 * verified against next/dist/lib/metadata/resolve-metadata.js, 14.2.35):
 *  - An AUTHORED title is `{ absolute }`, so it renders exactly as typed. The
 *    SEO Manager shows the owner a Google preview of that string; appending
 *    " | {businessName}" to it would make the preview a lie.
 *  - A DEFAULT title is a plain string, which the layout's `title.template`
 *    wraps into "About Us | Acme Cannabis" — the layout stashes its template for
 *    every segment deeper than the homepage (the `i < metadataItems.length - 2`
 *    guard, and a page under /store/[slug]/ sits two nodes deeper).
 *  - `openGraph` is REPLACED wholesale by the deepest segment that declares it,
 *    never merged, so this re-declares siteName/type/locale. Dropping them would
 *    strip og:site_name from exactly the pages this story is fixing.
 *  - og/twitter titles and descriptions are deliberately NOT set: Next's
 *    postProcessMetadata fills them from the RESOLVED title and description
 *    (i.e. after the template is applied), which is the only way og:title and
 *    <title> are guaranteed to agree.
 *
 * Pure, like every other builder in this directory: `generateMetadata` renders
 * with no error.tsx boundary above it, so a bad Json blob must degrade to a
 * default rather than throw a blank page.
 */

import type { Metadata } from "next";

import { storeCanonical } from "@/lib/seo/canonical";
import { brandedOgImage } from "@/lib/seo/og-image";
import { STORE_OG_LOCALE, seoText, storeDisplayName } from "@/lib/seo/store-identity";
import {
  readStorePageSeo,
  storeSeoPage,
  type StoreSeoPageKey,
} from "@/lib/seo/store-pages";
import { storedPublicImagePath } from "@/lib/storage/public-image-url";

/**
 * The title a page carries when the owner has authored none. These are wrapped
 * by the layout's "%s | {businessName}" template, which is why they name the
 * page and not the business.
 *
 * `home` is the exception on both counts: it is the one page Next does NOT
 * apply the template to (it sits at `metadataItems.length - 2`), and it still
 * builds its own metadata in app/store/[slug]/page.tsx:385. Its wording is
 * mirrored here so the default is stated once, ready for whichever later story
 * moves the homepage onto this builder.
 */
const DEFAULT_TITLES: Readonly<
  Record<StoreSeoPageKey, (businessName: string) => string>
> = {
  home: (name) => `${name} - Medical Cannabis Solutions`,
  about: () => "About Us",
  contact: () => "Contact Us",
  support: () => "Support & FAQ",
  conditions: () => "Medical Conditions",
};

/** Page-specific description defaults, all tenant-branded, none claiming outcomes. */
const DEFAULT_DESCRIPTIONS: Readonly<
  Record<StoreSeoPageKey, (businessName: string) => string>
> = {
  home: (name) =>
    `Premium medical cannabis products and consultations from ${name}`,
  about: (name) => `Learn about ${name} and how our medical cannabis service works.`,
  contact: (name) =>
    `Contact ${name} with questions about products, orders and consultations.`,
  support: (name) =>
    `Answers from ${name} on ordering, prescriptions, delivery and your account.`,
  conditions: (name) => `Browse the medical conditions covered by ${name}.`,
};

export interface StorePageMetadataSource {
  readonly pageKey: StoreSeoPageKey;
  readonly businessName: string;
  readonly subdomain: string;
  readonly customDomain: string | null;
  /** Raw `tenants.pageSeo` Json — parsed here, never trusted. */
  readonly pageSeo: unknown;
  /** `tenants.id` — the US-018 plan gate's subject. */
  readonly tenantId?: string;
  /** Raw `tenants.plan`; fail-closed to Basic, which emits no branded card. */
  readonly plan?: unknown;
}

export function buildStorePageMetadata(
  source: StorePageMetadataSource,
): Metadata {
  const businessName = storeDisplayName(source.businessName, source.subdomain);
  const page = storeSeoPage(source.pageKey);
  const seo = readStorePageSeo(source.pageSeo, source.pageKey);

  const authoredTitle = seoText(seo.title);
  const headline = authoredTitle || DEFAULT_TITLES[source.pageKey](businessName);
  const title = authoredTitle ? { absolute: authoredTitle } : headline;

  const description =
    seoText(seo.description) ||
    DEFAULT_DESCRIPTIONS[source.pageKey](businessName);

  const canonical = storeCanonical(
    { subdomain: source.subdomain, customDomain: source.customDomain },
    page.path,
  );

  // Fails closed: a presigned S3 URL an owner pasted before Email US-005 is
  // dropped rather than rendered, because an og:image that 403s an hour after
  // it is minted looks correct and breaks silently. Relative paths are resolved
  // against the layout's metadataBase by Next (the parent's base is what a
  // child's URLs resolve against — resolve-metadata.js:130).
  const ogImage = storedPublicImagePath(seo.ogImage);

  // US-018 — the branded card, only when the owner authored no image of their
  // own, and only for a Pro tenant. Its 1200x630 IS declared: unlike a pasted
  // URL, this one is a size we control exactly.
  const brandedOg = ogImage
    ? null
    : brandedOgImage({
        tenantId: source.tenantId,
        plan: source.plan,
        kind: "page",
        title: headline,
      });

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      siteName: businessName,
      type: "website",
      locale: STORE_OG_LOCALE,
      url: canonical,
      // No width/height on the AUTHORED image: it is a URL the owner pasted,
      // and declaring dimensions we have not measured makes scrapers crop it
      // wrong.
      ...(ogImage
        ? { images: [ogImage] }
        : brandedOg
          ? { images: [brandedOg] }
          : {}),
    },
  };
}
