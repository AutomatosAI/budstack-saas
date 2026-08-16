/**
 * US-015 — the metadata one budstacks.io marketing route serves, once
 * `platform_seo_settings` is allowed to have an opinion about it.
 *
 * `buildStorePageMetadata`'s counterpart for the platform (lib/seo/page-metadata
 * .ts does this job for a tenant's storefront) and, like
 * `platform-post-metadata.ts`, deliberately not a call into it: every input that
 * builder takes is a tenant — business name, subdomain, custom domain, plan —
 * and budstacks.io is not one.
 *
 * PURE AND TOTAL. No Prisma, no headers, no throw: `generateMetadata` has no
 * `error.tsx` boundary above it, so a page whose settings row cannot be read
 * must serve the metadata it ships with rather than a blank page. The read lives
 * in lib/seo/generate-platform-metadata.ts, which is what pages actually call.
 *
 * THE OVERRIDE IS PER COLUMN, NOT PER ROW. Every authored column is nullable and
 * the US-013 seed filled in exactly one of them — `ogImage` — for all fifteen
 * static routes. A "does a row exist?" test would therefore have blanked the
 * title of every page on the site the day it shipped. Each column falls back on
 * its own: authored value, then the page's shipped value, then the platform
 * default.
 *
 * HOW IT COMPOSES WITH THE ROOT LAYOUT (app/layout.tsx), which is where these
 * pages got all their metadata from until now:
 *  - The layout sets a PLAIN `title`, not a `title.template`, so nothing
 *    suffixes what is returned here. The fallbacks below are the strings each
 *    page already exported, brand suffix and all.
 *  - `openGraph` is REPLACED WHOLESALE by the deepest segment that declares it.
 *    Declaring it for the image means re-declaring siteName, locale, type and
 *    url alongside — and `url` is re-stated per route because the layout's is
 *    hardcoded to the apex, so every subpage currently claims og:url
 *    https://budstacks.io. Same for `twitter`, which the layout pins to the
 *    platform's own card on every page.
 *  - `robots` is only declared when a route is set to noindex. Leaving the key
 *    off inherits the layout's index/follow block; emitting `index: true` here
 *    would drop the googleBot directives it carries.
 *  - Images are ABSOLUTE. The platform layout declares no `metadataBase` (see
 *    `platformAbsoluteUrl`), so a relative one would point at localhost.
 */

import type { Metadata } from "next";

import {
  PLATFORM_DEFAULT_OG_IMAGE,
  PLATFORM_OG_LOCALE,
  PLATFORM_SITE_NAME,
} from "@/lib/seo/platform-post-metadata";
import { platformAbsoluteUrl, platformCanonical } from "@/lib/seo/platform-url";
import { seoText } from "@/lib/seo/store-identity";

/**
 * The title and description app/layout.tsx has always served, and the last
 * resort for a route that has neither an authored row nor a title of its own.
 *
 * Exported so the layout imports them rather than repeating them: they are the
 * documented fallback in US-015's acceptance criteria, and a second copy is a
 * second answer the moment one is edited.
 */
export const PLATFORM_DEFAULT_TITLE =
  "BudStacks - Medical Cannabis SaaS Platform";
export const PLATFORM_DEFAULT_DESCRIPTION =
  "Multi-tenant SaaS platform for medical cannabis dispensaries. Launch and manage your dispensary with ease.";

/** The subset of a settings row this builder reads. */
export interface PlatformSeoOverride {
  readonly title: string | null;
  readonly description: string | null;
  readonly ogImage: string | null;
  readonly noindex: boolean;
}

/** What a route serves when nothing is authored for it — its shipped metadata. */
export interface PlatformRouteFallback {
  readonly title?: string;
  readonly description?: string;
}

/**
 * The metadata each static marketing route SHIPPED WITH, verbatim — the strings
 * that were `export const metadata` in the page file until this story turned it
 * into a `generateMetadata` that reads the table first.
 *
 * Central for the reason `STORE_ROUTE_DEFINITIONS` (lib/seo/route-metadata.ts)
 * is: this is the fallback US-015's acceptance criteria name, and a copy left in
 * fifteen page files is fifteen places for it to drift from what the admin list
 * says the route serves. `tests/unit/platform-page-metadata.test.ts` asserts
 * these keys are exactly `PLATFORM_SEO_STATIC_ROUTES`, so a route added to one
 * list and not the other fails rather than silently serving the platform
 * default.
 *
 * TWO ROUTES SHIP NOTHING OF THEIR OWN and are `{}` on purpose, not by
 * omission: `/blog`'s page has never exported metadata, and `/contact` is a
 * client component, which cannot. Both therefore served — and still serve — the
 * root layout's title. Authoring one is now a super-admin's job rather than a
 * deploy, and US-020's audit flags them until someone does.
 */
export const PLATFORM_ROUTE_FALLBACKS: Readonly<
  Record<string, PlatformRouteFallback>
> = {
  "/": {},
  "/marketplace": {
    title: "Theme Marketplace | BudStacks",
    description:
      "Browse professional storefront themes for your cannabis business. Preview and choose the perfect design.",
  },
  "/learn": {
    title: "Learning Center | BudStacks",
    description:
      "Guides, tutorials, and documentation to help you get the most out of BudStacks.",
  },
  "/blog": {},
  "/contact": {},
  "/documents": {
    title: "The BudStacks Guide",
    description:
      "Every screen of your store admin explained — what it's for, what it does, and why you'll use it. Step by step, in plain language.",
  },
  "/faq": {
    title: "Frequently Asked Questions",
    description: "Common questions about our services and medical cannabis",
  },
  "/regulatory": {
    title: "Regulatory Information",
    description: "Regulatory compliance and legal information",
  },
  "/terms": {
    title: "Terms of Service | BudStacks",
    description: "Terms and conditions for using the BudStacks platform.",
  },
  "/privacy": {
    title: "Privacy Policy | BudStacks",
    description:
      "How BudStacks collects, processes and protects personal data on behalf of operators and visitors.",
  },
  "/cookies": {
    title: "Cookie Policy | BudStacks",
    description: "Information about cookies and how we use them",
  },
  "/dpa": {
    title: "Data Processing Agreement | BudStacks",
    description:
      "GDPR Article 28 Data Processing Agreement between BudStacks and operators.",
  },
  "/aup": {
    title: "Acceptable Use Policy | BudStacks",
    description:
      "Rules governing acceptable use of the BudStacks platform by operators and end users.",
  },
  "/legal/changelog": {
    title: "Legal changelog | BudStacks",
    description:
      "Material changes to BudStacks legal documents — privacy, terms, AUP, DPA, sub-processors.",
  },
  "/legal/subprocessors": {
    title: "Sub-processors | BudStacks",
    description:
      "Vendors that BudStacks engages to deliver the platform — purpose, region, and transfer mechanism.",
  },
};

export interface PlatformPageMetadataSource {
  /** The `platform_seo_settings.routePath` key, and the path og:url is built from. */
  readonly routePath: string;
  /** The page's own hardcoded metadata; the platform default fills any gap. */
  readonly fallback?: PlatformRouteFallback;
  /** The authored row, or null when there is none / the read failed. */
  readonly setting?: PlatformSeoOverride | null;
}

/** Authored value, then the page's shipped value, then the platform default. */
function resolveText(
  authored: string | null | undefined,
  shipped: string | undefined,
  platformDefault: string,
): string {
  return seoText(authored) || seoText(shipped) || platformDefault;
}

export function buildPlatformPageMetadata(
  source: PlatformPageMetadataSource,
): Metadata {
  const { routePath, fallback, setting } = source;

  const title = resolveText(
    setting?.title,
    fallback?.title,
    PLATFORM_DEFAULT_TITLE,
  );
  const description = resolveText(
    setting?.description,
    fallback?.description,
    PLATFORM_DEFAULT_DESCRIPTION,
  );

  // Ends in the platform hero rather than nothing, the same cascade
  // `postOgImage` runs: a marketing page shared with no image is a bare grey
  // card, and today every one of these pages is exactly that.
  //
  // The DEFAULT is absolutised on its own line rather than as the argument to a
  // single call. `platformAbsoluteUrl` returns null for a reference this origin
  // cannot serve — a bare filename, a protocol-relative `//host/x` — and folding
  // the two together would hand that null back the RELATIVE constant, which is
  // the one thing that must never reach the tag: with no `metadataBase` on the
  // platform layout, Next resolves a relative og:image against localhost.
  const ogImage =
    platformAbsoluteUrl(seoText(setting?.ogImage)) ??
    platformAbsoluteUrl(PLATFORM_DEFAULT_OG_IMAGE) ??
    PLATFORM_DEFAULT_OG_IMAGE;

  const url = platformCanonical(routePath);

  return {
    title,
    description,
    openGraph: {
      siteName: PLATFORM_SITE_NAME,
      type: "website",
      locale: PLATFORM_OG_LOCALE,
      url,
      title,
      description,
      // No width/height: the image is whatever a super-admin pointed at, and
      // dimensions we have not measured make scrapers crop it wrong.
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    // `follow` stays true: the instruction is "do not list this page", not "stop
    // reading the links on it" — the pages that would ever be flipped here are
    // thin or duplicate ones whose outbound links are still worth crawling.
    ...(setting?.noindex
      ? { robots: { index: false, follow: true } }
      : {}),
  };
}
