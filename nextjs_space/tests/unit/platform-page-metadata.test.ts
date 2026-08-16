import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi } from "vitest";

/**
 * US-015 — budstacks.io's marketing pages consume `platform_seo_settings`.
 *
 * The claims worth pinning are the ones that decide what a crawler is served
 * when the table is not what anybody expected:
 *
 *  1. THE OVERRIDE IS PER COLUMN. The US-013 seed filled in exactly one column
 *     — `ogImage` — for all fifteen routes. A "does a row exist?" test would
 *     therefore have blanked the title of every page on the site on day one.
 *  2. AN EMPTY TABLE MUST NOT BLANK THE SITE. Every route resolves a title and
 *     a description with no row at all, and the two routes that ship neither
 *     (`/`, `/blog`, `/contact`) still resolve the platform default rather than
 *     "".
 *  3. `noindex` EMITS A REAL ROBOTS TAG, and `noindex: false` emits none —
 *     declaring `index: true` here would replace the root layout's robots block
 *     and drop the googleBot directives it carries.
 *  4. IMAGES AND og:url ARE ABSOLUTE AND PER ROUTE. The platform layout
 *     declares no `metadataBase`, so a relative image resolves against
 *     localhost; and its og:url is hardcoded to the apex, so every subpage
 *     claimed to be the homepage until this story.
 *  5. THE BUILDER IS TOTAL. `generateMetadata` has no `error.tsx` boundary
 *     above it, so nothing here may throw whatever the row holds.
 *
 * The last block reads the pages as text. There is no component-test harness in
 * this repo (nothing under tests/unit renders React), and the rule that matters
 * — every marketing route delegates rather than hardcoding a title again — is
 * visible only in the source.
 */

import {
  PLATFORM_SEO_STATIC_ROUTES,
  platformSeoRoutes,
} from "@/lib/platform/seo-routes";
import {
  PLATFORM_DEFAULT_DESCRIPTION,
  PLATFORM_DEFAULT_TITLE,
  PLATFORM_ROUTE_FALLBACKS,
  buildPlatformPageMetadata,
  type PlatformSeoOverride,
} from "@/lib/seo/platform-page-metadata";
import {
  PLATFORM_DEFAULT_OG_IMAGE,
  PLATFORM_OG_LOCALE,
  PLATFORM_SITE_NAME,
} from "@/lib/seo/platform-post-metadata";
import { platformBaseUrl, platformCanonical } from "@/lib/seo/platform-url";

/** A settings row, defaulting to the shape the US-013 seed actually wrote. */
function row(over: Partial<PlatformSeoOverride> = {}): PlatformSeoOverride {
  return {
    title: null,
    description: null,
    ogImage: PLATFORM_DEFAULT_OG_IMAGE,
    noindex: false,
    ...over,
  };
}

const TERMS_FALLBACK = PLATFORM_ROUTE_FALLBACKS["/terms"];

/** og:image as a plain string, whatever container Next's types allow. */
function ogImageOf(meta: ReturnType<typeof buildPlatformPageMetadata>): string {
  const images = meta.openGraph?.images;
  return String(Array.isArray(images) ? images[0] : images);
}

describe("buildPlatformPageMetadata — the authored override", () => {
  it("serves an authored title and description over the page's own", () => {
    const meta = buildPlatformPageMetadata({
      routePath: "/terms",
      fallback: TERMS_FALLBACK,
      setting: row({
        title: "Terms — BudStacks",
        description: "The agreement operators sign.",
      }),
    });

    expect(meta.title).toBe("Terms — BudStacks");
    expect(meta.description).toBe("The agreement operators sign.");
  });

  it("falls back PER COLUMN: a seeded image-only row keeps the shipped title", () => {
    // This is the shape every one of the fifteen seeded rows has today. A
    // per-ROW check would have blanked every title on the site.
    const meta = buildPlatformPageMetadata({
      routePath: "/terms",
      fallback: TERMS_FALLBACK,
      setting: row(),
    });

    expect(meta.title).toBe(TERMS_FALLBACK.title);
    expect(meta.description).toBe(TERMS_FALLBACK.description);
  });

  it("keeps the shipped title when a description is authored and a title is not", () => {
    const meta = buildPlatformPageMetadata({
      routePath: "/terms",
      fallback: TERMS_FALLBACK,
      setting: row({ description: "Only this was authored." }),
    });

    expect(meta.title).toBe(TERMS_FALLBACK.title);
    expect(meta.description).toBe("Only this was authored.");
  });

  it("treats a whitespace-only authored value as nothing authored", () => {
    // The write route stores "" as NULL, but a row written by hand — or before
    // that rule — must not override a real title with a blank one.
    const meta = buildPlatformPageMetadata({
      routePath: "/terms",
      fallback: TERMS_FALLBACK,
      setting: row({ title: "   ", description: "" }),
    });

    expect(meta.title).toBe(TERMS_FALLBACK.title);
    expect(meta.description).toBe(TERMS_FALLBACK.description);
  });
});

describe("buildPlatformPageMetadata — an empty table", () => {
  it("serves the page's shipped metadata when there is no row", () => {
    const meta = buildPlatformPageMetadata({
      routePath: "/terms",
      fallback: TERMS_FALLBACK,
      setting: null,
    });

    expect(meta.title).toBe(TERMS_FALLBACK.title);
    expect(meta.description).toBe(TERMS_FALLBACK.description);
  });

  it("never resolves a blank title, even for a route that ships none", () => {
    // `/`, `/blog` and `/contact` have no metadata of their own — the homepage
    // and the blog index never exported any, and /contact cannot (it is a
    // client component). The root layout's block is what they served, and it is
    // what they must keep serving.
    for (const path of ["/", "/blog", "/contact"]) {
      const meta = buildPlatformPageMetadata({
        routePath: path,
        fallback: PLATFORM_ROUTE_FALLBACKS[path],
        setting: null,
      });

      expect(meta.title).toBe(PLATFORM_DEFAULT_TITLE);
      expect(meta.description).toBe(PLATFORM_DEFAULT_DESCRIPTION);
    }
  });

  it("resolves a title and a description for every static route with an empty table", () => {
    for (const route of PLATFORM_SEO_STATIC_ROUTES) {
      const meta = buildPlatformPageMetadata({
        routePath: route.path,
        fallback: PLATFORM_ROUTE_FALLBACKS[route.path],
        setting: null,
      });

      expect(String(meta.title).length).toBeGreaterThan(0);
      expect(String(meta.description).length).toBeGreaterThan(0);
    }
  });

  it("resolves the platform default for a path with no fallback entry at all", () => {
    const meta = buildPlatformPageMetadata({ routePath: "/documents/part-1" });

    expect(meta.title).toBe(PLATFORM_DEFAULT_TITLE);
    expect(meta.description).toBe(PLATFORM_DEFAULT_DESCRIPTION);
  });
});

describe("buildPlatformPageMetadata — robots", () => {
  it("emits a real noindex when the route is flagged", () => {
    const meta = buildPlatformPageMetadata({
      routePath: "/terms",
      setting: row({ noindex: true }),
    });

    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it("declares NO robots key when the route is indexable", () => {
    // Not `index: true`: Next replaces the key wholesale, so declaring it here
    // would drop the max-image-preview/max-snippet directives the root layout
    // carries for googleBot.
    expect(
      buildPlatformPageMetadata({ routePath: "/terms", setting: row() }).robots,
    ).toBeUndefined();

    expect(
      buildPlatformPageMetadata({ routePath: "/terms", setting: null }).robots,
    ).toBeUndefined();
  });
});

describe("buildPlatformPageMetadata — social card", () => {
  it("absolutises the authored image and uses it on both cards", () => {
    const meta = buildPlatformPageMetadata({
      routePath: "/terms",
      setting: row({ ogImage: "/social/terms.png" }),
    });

    expect(ogImageOf(meta)).toBe(`${platformBaseUrl()}/social/terms.png`);
    expect(meta.twitter?.images).toEqual([`${platformBaseUrl()}/social/terms.png`]);
  });

  it("passes an absolute URL through untouched", () => {
    const meta = buildPlatformPageMetadata({
      routePath: "/terms",
      setting: row({ ogImage: "https://cdn.example.com/card.png" }),
    });

    expect(ogImageOf(meta)).toBe("https://cdn.example.com/card.png");
  });

  it("falls back to the platform hero rather than emitting a broken tag", () => {
    // A bare filename is not a path this origin serves, so platformAbsoluteUrl
    // drops it. The card must not go out pointing at nothing.
    for (const setting of [null, row({ ogImage: "card.png" })]) {
      const meta = buildPlatformPageMetadata({ routePath: "/terms", setting });
      expect(ogImageOf(meta)).toBe(
        `${platformBaseUrl()}${PLATFORM_DEFAULT_OG_IMAGE}`,
      );
    }
  });

  it("points og:url at the route itself, not the apex", () => {
    // The root layout hardcodes url: https://budstacks.io, so /terms claimed to
    // be the homepage until this story.
    expect(
      buildPlatformPageMetadata({ routePath: "/terms" }).openGraph?.url,
    ).toBe(platformCanonical("/terms"));

    expect(buildPlatformPageMetadata({ routePath: "/" }).openGraph?.url).toBe(
      platformBaseUrl(),
    );
  });

  it("keeps the cards in step with the <title>", () => {
    const meta = buildPlatformPageMetadata({
      routePath: "/terms",
      fallback: TERMS_FALLBACK,
      setting: row({ title: "Authored" }),
    });

    expect(meta.openGraph?.title).toBe("Authored");
    expect(meta.twitter?.title).toBe("Authored");
    expect(meta.openGraph?.description).toBe(TERMS_FALLBACK.description);
    expect(meta.openGraph?.siteName).toBe(PLATFORM_SITE_NAME);
    expect(meta.openGraph?.locale).toBe(PLATFORM_OG_LOCALE);
  });
});

/**
 * US-017 — one canonical per marketing page, and it is the apex one.
 *
 * These pages declared none, so every address that answered 200 on them was a
 * candidate to be indexed in its own right. The www→apex 301 in middleware
 * (`wwwRedirectHost`, middleware.ts:155) handles one of those; nothing but a
 * canonical handles `?utm_source=…`, `?ref=…` or `?fbclid=…`, which is most of
 * what a marketing site is linked by.
 */
describe("buildPlatformPageMetadata — canonical", () => {
  it("declares the route's own absolute path on the platform origin", () => {
    const meta = buildPlatformPageMetadata({ routePath: "/terms" });

    expect(meta.alternates?.canonical).toBe(`${platformBaseUrl()}/terms`);
  });

  it("canonicals the homepage to the bare origin, with no trailing slash", () => {
    // `/` and `` are the same page; a canonical of `https://budstacks.io/` and
    // one of `https://budstacks.io` are two declarations of one page.
    expect(
      buildPlatformPageMetadata({ routePath: "/" }).alternates?.canonical,
    ).toBe(platformBaseUrl());
  });

  it("keeps the canonical and og:url as ONE url", () => {
    // Two URLs for one page is the defect this closes, not a second copy of it.
    for (const routePath of ["/", "/privacy", "/legal/changelog"]) {
      const meta = buildPlatformPageMetadata({ routePath });
      expect(meta.alternates?.canonical, routePath).toBe(meta.openGraph?.url);
    }
  });

  it("resolves a canonical for every authorable route, static and guide", () => {
    // Guides come from the registry, so an added guide is covered without this
    // list being edited — the drift the route table exists to prevent.
    for (const route of platformSeoRoutes()) {
      const canonical = buildPlatformPageMetadata({
        routePath: route.path,
        fallback: PLATFORM_ROUTE_FALLBACKS[route.path],
        setting: row(),
      }).alternates?.canonical;

      expect(canonical, route.path).toBe(
        route.path === "/"
          ? platformBaseUrl()
          : `${platformBaseUrl()}${route.path}`,
      );
    }
  });

  it("declares a canonical on a noindex route too", () => {
    // Independent signals: "do not list this page" is not "I have no opinion
    // about which URL it is", and a route can be flipped back to indexable.
    expect(
      buildPlatformPageMetadata({
        routePath: "/faq",
        setting: row({ noindex: true }),
      }).alternates?.canonical,
    ).toBe(`${platformBaseUrl()}/faq`);
  });

  it("takes its origin from the environment at call time, and never www", () => {
    // AC-3: the canonical host is the APEX. www is 301'd to it in middleware
    // before any of this runs, so a canonical pointing at www would name the
    // one host that redirects away.
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://budstacks.io/");

    const canonical = buildPlatformPageMetadata({ routePath: "/privacy" })
      .alternates?.canonical;

    expect(canonical).toBe("https://budstacks.io/privacy");
    expect(String(canonical)).not.toMatch(/^https?:\/\/www\./);
  });
});

describe("PLATFORM_ROUTE_FALLBACKS", () => {
  it("covers exactly the static routes the admin list offers", () => {
    // The drift guard. A route added to one list and not the other silently
    // serves the platform default — the duplicate-title defect this story
    // closes — and nothing else in the build would notice.
    expect(Object.keys(PLATFORM_ROUTE_FALLBACKS).sort()).toEqual(
      PLATFORM_SEO_STATIC_ROUTES.map((route) => route.path).sort(),
    );
  });

  it("holds no blank strings — an entry is either real copy or {}", () => {
    for (const [path, fallback] of Object.entries(PLATFORM_ROUTE_FALLBACKS)) {
      for (const value of [fallback.title, fallback.description]) {
        if (value !== undefined) expect(value.trim(), path).not.toBe("");
      }
    }
  });
});

describe("the marketing pages themselves", () => {
  const PAGES: ReadonlyArray<readonly [string, string[]]> = [
    ["/", ["app", "page.tsx"]],
    ["/marketplace", ["app", "marketplace", "page.tsx"]],
    ["/learn", ["app", "learn", "page.tsx"]],
    ["/blog", ["app", "blog", "page.tsx"]],
    ["/contact", ["app", "contact", "layout.tsx"]],
    ["/documents", ["app", "documents", "page.tsx"]],
    ["/faq", ["app", "faq", "page.tsx"]],
    ["/regulatory", ["app", "regulatory", "page.tsx"]],
    ["/terms", ["app", "terms", "page.tsx"]],
    ["/privacy", ["app", "privacy", "page.tsx"]],
    ["/cookies", ["app", "cookies", "page.tsx"]],
    ["/dpa", ["app", "dpa", "page.tsx"]],
    ["/aup", ["app", "aup", "page.tsx"]],
    ["/legal/changelog", ["app", "legal", "changelog", "page.tsx"]],
    ["/legal/subprocessors", ["app", "legal", "subprocessors", "page.tsx"]],
  ];

  it("wires every static route to its own path, and hardcodes none", () => {
    expect(PAGES.map(([path]) => path).sort()).toEqual(
      PLATFORM_SEO_STATIC_ROUTES.map((route) => route.path).sort(),
    );

    for (const [path, segments] of PAGES) {
      const source = readFileSync(join(process.cwd(), ...segments), "utf8");

      // Quote-agnostic: two of these files are single-quoted throughout.
      expect(source, path).toMatch(
        new RegExp(`generatePlatformRouteMetadata\\(["']${path}["']\\)`),
      );
      // A page that reintroduces `export const metadata` is a page the admin
      // editor can no longer change.
      expect(source, path).not.toMatch(/^export const metadata/m);
    }
  });

  it("keeps /contact's metadata in a layout, because its page is a client component", () => {
    const page = readFileSync(
      join(process.cwd(), "app", "contact", "page.tsx"),
      "utf8",
    );
    expect(page).toMatch(/^["']use client["']/);
  });

  it("reads each guide's own settings row, not the /documents index's", () => {
    const source = readFileSync(
      join(process.cwd(), "app", "documents", "[slug]", "page.tsx"),
      "utf8",
    );

    // Whitespace-tolerant: US-020 gave the call a second argument
    // (`platformGuideFallback`, shared with the audit), which wraps it over
    // three lines. What is being pinned is the slug reaching the per-guide
    // loader, not the formatter's opinion of where the newline goes.
    expect(source).toMatch(/generatePlatformGuideMetadata\(\s*params\.slug/);
    expect(source).not.toContain('generatePlatformRouteMetadata("/documents")');
  });

  it("US-017: the two database-backed content routes declare their own canonical", () => {
    // These are the only public marketing routes that do NOT go through
    // `buildPlatformPageMetadata` — they are rows, not settings-table routes
    // (lib/platform/seo-routes.ts), so each builds its canonical itself and
    // neither is covered by the block above. Source-level because there is no
    // component-test harness in this repo; the behaviour of the blog's builder
    // is asserted directly in platform-post-metadata.test.ts.
    const blog = readFileSync(
      join(process.cwd(), "app", "blog", "[slug]", "page.tsx"),
      "utf8",
    );
    // The blog post canonical is built inside buildPlatformPostMetadata
    // (US-009), so the page delegates rather than assembling a second one.
    expect(blog).toContain("buildPlatformPostMetadata");

    const learn = readFileSync(
      join(process.cwd(), "app", "learn", "[slug]", "page.tsx"),
      "utf8",
    );
    expect(learn).toContain("platformCanonical(");
    expect(learn).toContain("alternates: { canonical:");
    // Built from the resolved row, never from the raw route param.
    expect(learn).not.toContain("platformCanonical(`/learn/${params.slug}`)");
  });
});
