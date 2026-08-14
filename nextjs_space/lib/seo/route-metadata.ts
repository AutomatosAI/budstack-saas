/**
 * SEO Supercharge US-007 — metadata for the storefront routes that carry no
 * authorable SEO record.
 *
 * THE DEFECT THIS CLOSES: a tenant on a custom domain serves the identical
 * store on `{subdomain}.budstacks.io`, and until this story only the pages with
 * an SEO record of their own (home, about, contact, support, conditions, the
 * catalogue's detail pages, The Wire) declared which host owned the content.
 * `/products`, `/how-it-works`, `/consultation`, `/blockchain` and the four
 * legal documents emitted no `<link rel="canonical">` at all, so both hosts
 * competed for the same copy.
 *
 * These routes are NOT in `STORE_SEO_PAGE_KEYS` — the SEO Manager does not
 * offer them — so the titles and descriptions below are the whole story, the
 * same arrangement The Wire's index has carried since US-003. Making one
 * authorable is a one-line addition to `lib/seo/store-pages.ts` plus swapping
 * its page onto `buildStorePageMetadata`.
 *
 * English-only, like every other builder in this directory: the storefront
 * renders translated copy (lib/i18n) but publishes one `og:locale`
 * (`STORE_OG_LOCALE`) and one set of tags, and a half-translated head is worse
 * than a consistent one. Per-locale metadata arrives with real localisation.
 *
 * Pure, like the rest of `lib/seo/`: `generateMetadata` renders with no
 * `error.tsx` boundary above it, so nothing here may throw.
 */

import type { Metadata } from "next";

import { getLegalDocument, type LegalDocumentSlug } from "@/lib/legal/documents";
import { storeCanonical } from "@/lib/seo/canonical";
import {
  PRODUCTS_INDEX_PATH,
  PRODUCTS_INDEX_TITLE,
} from "@/lib/seo/product-paths";
import { STORE_OG_LOCALE, storeDisplayName } from "@/lib/seo/store-identity";

/** The tenant fields every builder here needs — the shape `getCurrentTenant` returns. */
export interface StoreRouteTenant {
  readonly businessName: string;
  readonly subdomain: string;
  readonly customDomain: string | null;
}

/**
 * The un-authorable storefront routes.
 *
 * `consultation` and `idUploadRegistration` are the SAME URL: SA tenants with
 * ID upload enabled get a registration + ID form instead of a medical
 * consultation (app/store/[slug]/consultation/page.tsx), and titling that page
 * "Consultation" would describe a page the visitor never sees. One path, two
 * descriptions of it — the canonical is identical either way.
 */
export const STORE_ROUTE_KEYS = [
  "products",
  "howItWorks",
  "consultation",
  "idUploadRegistration",
  "blockchain",
] as const;

export type StoreRouteKey = (typeof STORE_ROUTE_KEYS)[number];

interface StoreRouteDefinition {
  /** Store-relative path, which is also the canonical path. */
  readonly path: string;
  /**
   * Rendered through the store layout's `%s | {businessName}` template, so it
   * names the page and not the business (US-001's merge notes).
   */
  readonly title: string;
  readonly description: (businessName: string) => string;
}

/**
 * Titles mirror the storefront's own navigation labels (lib/i18n/locales/en.ts
 * `nav.*`) so a search result and the link a visitor clicked agree. Descriptions
 * describe what the page does and claim no clinical outcome.
 */
export const STORE_ROUTES: Readonly<
  Record<StoreRouteKey, StoreRouteDefinition>
> = {
  products: {
    // Read from the module that owns the products URL, so the page title and
    // US-016's breadcrumb crumb for the same section cannot drift.
    path: PRODUCTS_INDEX_PATH,
    title: PRODUCTS_INDEX_TITLE,
    description: (name) =>
      `Browse the medical cannabis products available from ${name}.`,
  },
  howItWorks: {
    path: "/how-it-works",
    title: "How It Works",
    description: (name) =>
      `Consultation, medical assessment, prescription and delivery — how access to medical cannabis works at ${name}.`,
  },
  consultation: {
    path: "/consultation",
    title: "Consultation",
    description: (name) =>
      `Request an online medical cannabis consultation with ${name}.`,
  },
  idUploadRegistration: {
    path: "/consultation",
    title: "Patient Registration",
    description: (name) =>
      `Register with ${name} and upload your ID to get started.`,
  },
  blockchain: {
    path: "/blockchain",
    title: "Blockchain Technology",
    description: (name) =>
      `How ${name} uses blockchain for transparency and traceability in medical cannabis.`,
  },
};

/**
 * What each legal document tells a VISITOR. `LEGAL_DOCUMENTS[slug].summary` is
 * the operator-facing line shown in the admin ("How you handle customers'
 * personal information…") and reads as instructions to the wrong audience in a
 * search snippet, so the public sentence is stated separately. The title is not
 * duplicated — it comes from the registry, which is what the page renders as
 * its `<h1>`.
 */
const LEGAL_DESCRIPTIONS: Readonly<
  Record<LegalDocumentSlug, (businessName: string) => string>
> = {
  privacy: (name) =>
    `How ${name} collects, uses and protects your personal information, and the rights you have over it.`,
  terms: (name) =>
    `The terms of sale you agree to when you order from ${name} — ordering, delivery, returns and liability.`,
  cookies: (name) =>
    `What ${name} stores on your device, why, and the choices you have.`,
  regulatory: (name) =>
    `${name}'s licence and regulator, and the boundary between the service and your prescriber.`,
};

/**
 * The shape every route here emits.
 *
 * `openGraph` is REPLACED wholesale by the deepest segment that declares it —
 * never deep-merged (next/dist/lib/metadata/resolve-metadata.js) — so
 * siteName/type/locale are re-declared rather than inherited from the store
 * layout. Dropping them would strip `og:site_name` from exactly the pages this
 * story is fixing. og/twitter titles and descriptions are deliberately unset:
 * Next's `postProcessMetadata` fills them from the RESOLVED title, which is the
 * only way `og:title` and `<title>` are guaranteed to agree once the layout's
 * template has been applied.
 */
function routeMetadata(
  tenant: StoreRouteTenant,
  path: string,
  title: string,
  description: string,
): Metadata {
  const businessName = storeDisplayName(
    tenant.businessName,
    tenant.subdomain,
  );
  const canonical = storeCanonical(tenant, path);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      siteName: businessName,
      type: "website",
      locale: STORE_OG_LOCALE,
      url: canonical,
    },
  };
}

/** Metadata for one un-authorable storefront route. */
export function buildStoreRouteMetadata(
  route: StoreRouteKey,
  tenant: StoreRouteTenant,
): Metadata {
  const definition = STORE_ROUTES[route];
  const businessName = storeDisplayName(tenant.businessName, tenant.subdomain);

  return routeMetadata(
    tenant,
    definition.path,
    definition.title,
    definition.description(businessName),
  );
}

/**
 * Metadata for one of the operator's legal documents.
 *
 * The title comes from `LEGAL_DOCUMENTS` and is a bare document name, so the
 * store layout's template renders "Privacy Policy | Acme Cannabis". The four
 * route files each appended " | {businessName}" by hand before this story,
 * which the template then suffixed a SECOND time once US-001 gave the store
 * layout one.
 */
export function buildLegalDocumentMetadata(
  slug: LegalDocumentSlug,
  tenant: StoreRouteTenant,
): Metadata {
  const businessName = storeDisplayName(tenant.businessName, tenant.subdomain);

  return routeMetadata(
    tenant,
    `/${slug}`,
    getLegalDocument(slug).title,
    LEGAL_DESCRIPTIONS[slug](businessName),
  );
}
