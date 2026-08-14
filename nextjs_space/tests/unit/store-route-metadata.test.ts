import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { getLegalDocument, LEGAL_DOCUMENT_SLUGS } from "@/lib/legal/documents";
import { storeCanonical } from "@/lib/seo/canonical";
import {
  buildLegalDocumentMetadata,
  buildStoreRouteMetadata,
  STORE_ROUTES,
  STORE_ROUTE_KEYS,
  type StoreRouteKey,
} from "@/lib/seo/route-metadata";
import { STORE_SEO_PAGES } from "@/lib/seo/store-pages";

/**
 * SEO Supercharge US-007 — canonicals everywhere.
 *
 * THE PROPERTY THIS FILE HOLDS: a tenant on a custom domain must never publish
 * the same page on two hosts without saying which one owns it. Before this
 * story only the pages with an SEO record of their own declared a canonical;
 * `/products`, `/how-it-works`, `/consultation`, `/blockchain` and the four
 * legal documents declared nothing at all.
 *
 * The last describe block is the part that keeps this true: it walks
 * app/store/[slug] on disk and fails when a NEW store route appears that
 * neither emits a canonical nor is named in the exclusion table with a reason.
 */

const BUSINESS_NAME = "Acme Cannabis Co";
const SUBDOMAIN = "acme";
const CUSTOM_DOMAIN = "acme-cannabis.example";
const CUSTOM_ORIGIN = `https://${CUSTOM_DOMAIN}`;

const tenant = {
  businessName: BUSINESS_NAME,
  subdomain: SUBDOMAIN,
  customDomain: CUSTOM_DOMAIN,
};
const subdomainOnly = { ...tenant, customDomain: null };

// `alternates` is `AlternateURLs | null | undefined` on next's Metadata, so the
// `| null` is load-bearing — without it every call below is a TS2345.
function canonicalOf(metadata: { alternates?: { canonical?: unknown } | null }) {
  return metadata.alternates?.canonical;
}

describe("buildStoreRouteMetadata", () => {
  it("canonicalises every route to the custom domain when the tenant has one", () => {
    for (const key of STORE_ROUTE_KEYS) {
      expect(canonicalOf(buildStoreRouteMetadata(key, tenant))).toBe(
        `${CUSTOM_ORIGIN}${STORE_ROUTES[key].path}`,
      );
    }
  });

  it("falls back to the subdomain host when there is no custom domain", () => {
    for (const key of STORE_ROUTE_KEYS) {
      const canonical = canonicalOf(
        buildStoreRouteMetadata(key, subdomainOnly),
      ) as string;

      expect(canonical.startsWith(`https://${SUBDOMAIN}.`)).toBe(true);
      expect(canonical.endsWith(STORE_ROUTES[key].path)).toBe(true);
    }
  });

  it("agrees with storeCanonical — one helper decides the primary host", () => {
    for (const key of STORE_ROUTE_KEYS) {
      expect(canonicalOf(buildStoreRouteMetadata(key, tenant))).toBe(
        storeCanonical(tenant, STORE_ROUTES[key].path),
      );
    }
  });

  it("points og:url at the canonical, never at the subdomain twin", () => {
    for (const key of STORE_ROUTE_KEYS) {
      const metadata = buildStoreRouteMetadata(key, tenant);
      expect(metadata.openGraph?.url).toBe(canonicalOf(metadata));
    }
  });

  it("re-declares og:site_name, which the layout's openGraph does not survive to give it", () => {
    // openGraph is REPLACED wholesale by the deepest segment that declares it
    // (next/dist/lib/metadata/resolve-metadata.js), so omitting siteName here
    // would strip it from exactly the pages this story fixes.
    for (const key of STORE_ROUTE_KEYS) {
      const openGraph = buildStoreRouteMetadata(key, tenant).openGraph;
      expect(openGraph).toMatchObject({
        siteName: BUSINESS_NAME,
        type: "website",
      });
    }
  });

  it("titles the page, not the business — the layout template adds the suffix", () => {
    // A plain-string title is what Next applies `%s | {businessName}` to
    // (resolve-title.js). A title that already carried the business name would
    // render "Products | Acme | Acme".
    for (const key of STORE_ROUTE_KEYS) {
      const title = buildStoreRouteMetadata(key, tenant).title;
      expect(typeof title).toBe("string");
      expect(title).not.toContain(BUSINESS_NAME);
    }
  });

  it("describes each route in the tenant's name", () => {
    for (const key of STORE_ROUTE_KEYS) {
      const description = buildStoreRouteMetadata(key, tenant)
        .description as string;
      expect(description).toContain(BUSINESS_NAME);
    }
  });

  it("falls back to the subdomain for a tenant with no business name", () => {
    const metadata = buildStoreRouteMetadata("products", {
      businessName: "",
      subdomain: SUBDOMAIN,
      customDomain: CUSTOM_DOMAIN,
    });

    expect(metadata.description).toContain(SUBDOMAIN);
    expect(metadata.openGraph?.siteName).toBe(SUBDOMAIN);
  });

  it("serves the ID-upload variant at the same URL as the consultation", () => {
    // SA tenants with ID upload enabled render a registration form at
    // /consultation; the copy differs, the canonical must not.
    expect(canonicalOf(buildStoreRouteMetadata("idUploadRegistration", tenant)))
      .toBe(canonicalOf(buildStoreRouteMetadata("consultation", tenant)));
    expect(buildStoreRouteMetadata("idUploadRegistration", tenant).title).not.toBe(
      buildStoreRouteMetadata("consultation", tenant).title,
    );
  });

  it("does not shadow a page the SEO Manager can author", () => {
    // An authorable page must go through buildStorePageMetadata, or an owner's
    // saved title would be silently outranked by a constant in this module.
    const authorablePaths = new Set(STORE_SEO_PAGES.map((page) => page.path));
    for (const key of STORE_ROUTE_KEYS) {
      expect(authorablePaths.has(STORE_ROUTES[key].path)).toBe(false);
    }
  });
});

describe("buildLegalDocumentMetadata", () => {
  it("canonicalises each document to /{slug} on the primary host", () => {
    for (const slug of LEGAL_DOCUMENT_SLUGS) {
      expect(canonicalOf(buildLegalDocumentMetadata(slug, tenant))).toBe(
        `${CUSTOM_ORIGIN}/${slug}`,
      );
    }
  });

  it("takes its title from the registry the page renders as its <h1>", () => {
    for (const slug of LEGAL_DOCUMENT_SLUGS) {
      expect(buildLegalDocumentMetadata(slug, tenant).title).toBe(
        getLegalDocument(slug).title,
      );
    }
  });

  it("no longer appends the business name — the layout template does that once", () => {
    // The regression this closes: each route file appended " | {businessName}"
    // by hand, and US-001's store-layout template then suffixed it a SECOND
    // time ("Privacy Policy | Acme | Acme").
    for (const slug of LEGAL_DOCUMENT_SLUGS) {
      expect(buildLegalDocumentMetadata(slug, tenant).title).not.toContain(
        BUSINESS_NAME,
      );
    }
  });

  it("describes the document to a visitor, not to the operator", () => {
    for (const slug of LEGAL_DOCUMENT_SLUGS) {
      const description = buildLegalDocumentMetadata(slug, tenant)
        .description as string;

      expect(description).toContain(BUSINESS_NAME);
      // getLegalDocument(slug).summary is the admin-facing line, addressed to
      // the operator ("How you handle customers' personal information…").
      expect(description).not.toBe(getLegalDocument(slug).summary);
    }
  });

  it("falls back to the subdomain host when there is no custom domain", () => {
    for (const slug of LEGAL_DOCUMENT_SLUGS) {
      const canonical = canonicalOf(
        buildLegalDocumentMetadata(slug, subdomainOnly),
      ) as string;

      expect(canonical).toBe(storeCanonical(subdomainOnly, `/${slug}`));
      expect(canonical.startsWith(`https://${SUBDOMAIN}.`)).toBe(true);
    }
  });
});

/**
 * The drift guard. `alternates` is not deep-merged by Next — a page that
 * declares none inherits whatever an ancestor declared, and the store layout
 * deliberately declares none (a store-root URL on a product page is a worse tag
 * than no tag). So "everywhere" has to mean every page, and adding a store page
 * without a canonical has to fail here rather than in a crawl report.
 */
const STORE_ROUTES_DIR = join(process.cwd(), "app", "store", "[slug]");

/**
 * Every builder in lib/seo/ whose return value carries alternates.canonical —
 * each asserted above or in its own test file (store-page-metadata,
 * product-metadata, wire-post-metadata, condition-metadata).
 */
const CANONICAL_EMITTERS = [
  "alternates",
  "generateStorePageMetadata",
  "generateStoreRouteMetadata",
  "generateLegalDocumentMetadata",
  "buildStorePageMetadata",
  "buildStoreRouteMetadata",
  "buildLegalDocumentMetadata",
  "buildProductMetadata",
  "buildPostMetadata",
  "buildWireIndexMetadata",
  "buildConditionMetadata",
];

/**
 * Store routes that deliberately carry no canonical, and why.
 *
 * The checkout funnel and the signed-in account pages are not content: a
 * canonical is not the tag they need, and the tag they DO need (robots
 * noindex / a robots.txt Disallow) is owned by US-022. They are listed rather
 * than pattern-matched so that adding one is a deliberate act.
 */
const NO_CANONICAL: Readonly<Record<string, string>> = {
  faq: "redirect() to /support since before this run — renders nothing to index",
  cart: "checkout funnel — noindex, not canonical (US-022)",
  checkout: "checkout funnel — noindex, not canonical (US-022)",
  "payment/return/[orderId]": "checkout funnel — per-order, never indexable",
  dashboard: "signed-in account page",
  settings: "signed-in account page",
  orders: "signed-in account page",
  "orders/[orderId]": "signed-in account page — per-order",
  "consultation/success": "post-submission confirmation, reached only by redirect",
  login: "auth entry point",
  register: "auth entry point",
};

function storeRoutes(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return storeRoutes(full);
    if (entry !== "page.tsx") return [];
    // "" for app/store/[slug]/page.tsx, the store homepage.
    return [relative(STORE_ROUTES_DIR, dir).split("\\").join("/")];
  });
}

describe("every store route either emits a canonical or is excluded on purpose", () => {
  const routes = storeRoutes(STORE_ROUTES_DIR);

  it("finds the store routes", () => {
    expect(routes.length).toBeGreaterThan(20);
    expect(routes).toContain("");
    expect(routes).toContain("products");
  });

  it.each(routes.filter((route) => !(route in NO_CANONICAL)))(
    "/%s emits a canonical",
    (route) => {
      const source = readFileSync(
        join(STORE_ROUTES_DIR, route, "page.tsx"),
        "utf8",
      );

      expect(
        CANONICAL_EMITTERS.some((emitter) => source.includes(emitter)),
      ).toBe(true);
    },
  );

  it("carries no stale exclusion for a route that no longer exists", () => {
    for (const route of Object.keys(NO_CANONICAL)) {
      expect(routes).toContain(route);
    }
  });

  it("covers every route the sitemap advertises", () => {
    // A URL in the sitemap with no canonical is the exact duplicate-content
    // shape this story exists to remove.
    for (const page of STORE_SEO_PAGES) {
      const route = page.path.replace(/^\//, "");
      expect(routes).toContain(route);
      expect(NO_CANONICAL[route]).toBeUndefined();
    }
  });
});

describe("STORE_ROUTES paths match the routes on disk", () => {
  it.each(STORE_ROUTE_KEYS)("%s resolves to a real page", (key: StoreRouteKey) => {
    const route = STORE_ROUTES[key].path.replace(/^\//, "");
    expect(storeRoutes(STORE_ROUTES_DIR)).toContain(route);
  });
});
