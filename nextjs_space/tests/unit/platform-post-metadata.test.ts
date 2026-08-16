import { describe, it, expect, afterEach, vi } from "vitest";

/**
 * Platform US-009 — every article on budstacks.io/blog gets its OWN metadata.
 *
 * The claims worth pinning are the ones that decide what a crawler and a share
 * card actually see:
 *
 *  1. Title, description, canonical and og:image DIFFER PER POST. Before this
 *     story the page exported no metadata at all, so eight posts shared the
 *     root layout's one title — duplicate content by construction.
 *  2. Every post resolves an og:image. Neither the editor nor the migration
 *     makes a cover mandatory, so the cascade has to end in a default.
 *  3. Images and canonicals are ABSOLUTE. The platform root layout declares no
 *     `metadataBase`, so Next would absolutise a relative one against localhost.
 *  4. The builder is TOTAL. `generateMetadata` has no error boundary above it,
 *     so a malformed `seo` blob or a date that arrived as a string degrades to a
 *     default rather than throwing a blank page.
 */

import {
  PLATFORM_DEFAULT_OG_IMAGE,
  PLATFORM_POST_NOT_FOUND_TITLE,
  PLATFORM_SITE_NAME,
  buildPlatformPostMetadata,
  type PlatformPostMetadataSource,
} from "@/lib/seo/platform-post-metadata";
import {
  platformAbsoluteUrl,
  platformBaseUrl,
  platformCanonical,
} from "@/lib/seo/platform-url";

function source(
  over: Partial<PlatformPostMetadataSource> = {},
): PlatformPostMetadataSource {
  return {
    slug: "wordpress-or-budstacks-cannabis-storefront",
    title: "Should You Build Your Cannabis Storefront on WordPress?",
    excerpt: "The honest comparison, including the parts that do not flatter us.",
    coverImage: "/images/blog/post-01-franchise.svg",
    authorName: "BudStacks",
    publishedAt: new Date("2026-08-15T09:00:00Z"),
    seo: null,
    ...over,
  };
}

/** og:image entries are typed as a union; every case here writes one string. */
function ogImage(meta: ReturnType<typeof buildPlatformPostMetadata>): string {
  const images = meta.openGraph?.images;
  expect(Array.isArray(images)).toBe(true);
  return String((images as unknown[])[0]);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("platformCanonical", () => {
  it("builds an absolute URL on the platform origin", () => {
    expect(platformCanonical("/blog/a-post")).toBe(
      `${platformBaseUrl()}/blog/a-post`,
    );
  });

  it("takes its origin from the environment at call time", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.budstacks.io/");

    expect(platformCanonical("/blog/a-post")).toBe(
      "https://staging.budstacks.io/blog/a-post",
    );
  });

  it("returns the bare origin for an empty path or a lone slash", () => {
    expect(platformCanonical("")).toBe(platformBaseUrl());
    expect(platformCanonical("/")).toBe(platformBaseUrl());
  });

  it("declares ONE canonical for /blog and /blog/", () => {
    expect(platformCanonical("/blog/")).toBe(platformCanonical("/blog"));
  });

  // The defence that matters: `//evil.example/x` is a protocol-relative URL to
  // `new URL`, not a path — left alone it would declare one of our pages
  // canonical at somebody else's address.
  it("cannot be walked off the platform origin", () => {
    for (const hostile of [
      "//evil.example/x",
      "///evil.example/x",
      "\t//evil.example/x",
    ]) {
      expect(platformCanonical(hostile).startsWith(platformBaseUrl())).toBe(
        true,
      );
    }
  });

  it("percent-encodes whatever an authored slug carried", () => {
    expect(platformCanonical("/blog/a post")).toBe(
      `${platformBaseUrl()}/blog/a%20post`,
    );
  });
});

describe("platformAbsoluteUrl", () => {
  it("absolutises an origin-relative path", () => {
    expect(platformAbsoluteUrl("/x.png")).toBe(`${platformBaseUrl()}/x.png`);
  });

  it("leaves an absolute URL on another host untouched", () => {
    expect(platformAbsoluteUrl("https://cdn.example/x.png")).toBe(
      "https://cdn.example/x.png",
    );
  });

  it("refuses anything it cannot resolve rather than guessing", () => {
    expect(platformAbsoluteUrl("//cdn.example/x.png")).toBeNull();
    expect(platformAbsoluteUrl("x.png")).toBeNull();
    expect(platformAbsoluteUrl("   ")).toBeNull();
    expect(platformAbsoluteUrl(null)).toBeNull();
    expect(platformAbsoluteUrl(undefined)).toBeNull();
  });
});

describe("buildPlatformPostMetadata — titles", () => {
  it("uses the post's own title with the house brand suffix", () => {
    expect(buildPlatformPostMetadata(source()).title).toBe(
      `Should You Build Your Cannabis Storefront on WordPress? | ${PLATFORM_SITE_NAME}`,
    );
  });

  it("renders an AUTHORED title exactly as typed, with no suffix", () => {
    const meta = buildPlatformPostMetadata(
      source({ seo: { title: "WordPress vs BudStacks" } }),
    );

    expect(meta.title).toEqual({ absolute: "WordPress vs BudStacks" });
  });

  it("differs per post — the defect this story closes", () => {
    const a = buildPlatformPostMetadata(source({ title: "First" }));
    const b = buildPlatformPostMetadata(source({ title: "Second" }));

    expect(a.title).not.toEqual(b.title);
  });

  it("falls back to the not-found title when there is no title at all", () => {
    expect(buildPlatformPostMetadata(source({ title: "   " })).title).toBe(
      PLATFORM_POST_NOT_FOUND_TITLE,
    );
  });
});

describe("buildPlatformPostMetadata — description", () => {
  it("prefers the authored description over the excerpt", () => {
    const meta = buildPlatformPostMetadata(
      source({ seo: { description: "Authored." }, excerpt: "Excerpt." }),
    );

    expect(meta.description).toBe("Authored.");
  });

  it("falls back to the excerpt", () => {
    expect(buildPlatformPostMetadata(source()).description).toBe(
      "The honest comparison, including the parts that do not flatter us.",
    );
  });

  // A present-but-undefined key NULLs the layout's description in Next's
  // mergeMetadata; an ABSENT key inherits it.
  it("omits the key entirely when there is nothing to say", () => {
    const meta = buildPlatformPostMetadata(
      source({ excerpt: null, seo: null }),
    );

    expect(meta).not.toHaveProperty("description");
  });
});

describe("buildPlatformPostMetadata — canonical", () => {
  it("is this post's own absolute URL", () => {
    const meta = buildPlatformPostMetadata(source());

    expect(meta.alternates?.canonical).toBe(
      `${platformBaseUrl()}/blog/wordpress-or-budstacks-cannabis-storefront`,
    );
  });

  it("matches og:url — the two must not disagree", () => {
    const meta = buildPlatformPostMetadata(source());

    expect(meta.openGraph?.url).toBe(meta.alternates?.canonical);
  });
});

describe("buildPlatformPostMetadata — og:image", () => {
  it("prefers the authored ogImage over the cover", () => {
    const meta = buildPlatformPostMetadata(
      source({ seo: { ogImage: "/authored.png" } }),
    );

    expect(ogImage(meta)).toBe(`${platformBaseUrl()}/authored.png`);
  });

  it("uses the cover image next", () => {
    expect(ogImage(buildPlatformPostMetadata(source()))).toBe(
      `${platformBaseUrl()}/images/blog/post-01-franchise.svg`,
    );
  });

  it("falls back to the platform default when a post has no cover", () => {
    const meta = buildPlatformPostMetadata(source({ coverImage: null }));

    expect(ogImage(meta)).toBe(
      `${platformBaseUrl()}${PLATFORM_DEFAULT_OG_IMAGE}`,
    );
  });

  // The tag looks correct and breaks silently an hour later, which is worse
  // than the default — storedPublicImagePath fails closed on the signature.
  it("drops a presigned S3 URL rather than shipping one that expires", () => {
    const meta = buildPlatformPostMetadata(
      source({
        coverImage:
          "https://bucket.s3.amazonaws.com/platform/uploads/a.png?X-Amz-Signature=abc",
      }),
    );

    expect(ogImage(meta)).toBe(
      `${platformBaseUrl()}${PLATFORM_DEFAULT_OG_IMAGE}`,
    );
  });

  it("is always ABSOLUTE — the platform layout sets no metadataBase", () => {
    for (const cover of [
      "/images/blog/post-01-franchise.svg",
      null,
      "platform/uploads/cover.png",
      "https://cdn.example/x.png",
    ]) {
      expect(ogImage(buildPlatformPostMetadata(source({ coverImage: cover }))))
        .toMatch(/^https?:\/\//);
    }
  });

  it("resolves a bare platform upload key through the durable image route", () => {
    const meta = buildPlatformPostMetadata(
      source({ coverImage: "platform/uploads/cover.png" }),
    );

    expect(ogImage(meta)).toBe(
      `${platformBaseUrl()}/api/public/images/platform/uploads/cover.png`,
    );
  });
});

describe("buildPlatformPostMetadata — article facts", () => {
  // `OpenGraph` and `Twitter` are unions in next's types, so `type` and `card`
  // — the discriminants — are read through the narrowed shape.
  it("declares the article type, the platform site name and the locale", () => {
    const meta = buildPlatformPostMetadata(source());

    expect((meta.openGraph as { type?: string }).type).toBe("article");
    expect(meta.openGraph?.siteName).toBe(PLATFORM_SITE_NAME);
    expect(meta.openGraph?.locale).toBe("en_US");
    expect((meta.twitter as { card?: string }).card).toBe(
      "summary_large_image",
    );
  });

  it("publishes the byline as the author, not the platform", () => {
    const meta = buildPlatformPostMetadata(source({ authorName: "Jane Roe" }));

    expect(meta.authors).toEqual([{ name: "Jane Roe" }]);
  });

  it("stamps article:published_time from publishedAt", () => {
    const meta = buildPlatformPostMetadata(source());

    expect(
      (meta.openGraph as { publishedTime?: string }).publishedTime,
    ).toBe("2026-08-15T09:00:00.000Z");
  });

  it("accepts a publishedAt that arrived as a string", () => {
    const meta = buildPlatformPostMetadata(
      source({ publishedAt: "2026-08-15T09:00:00Z" }),
    );

    expect(
      (meta.openGraph as { publishedTime?: string }).publishedTime,
    ).toBe("2026-08-15T09:00:00.000Z");
  });

  // An Invalid Date reaching toISOString() throws a RangeError, and a throw
  // inside generateMetadata is a blank page.
  it("omits the time rather than throwing on an unreadable date", () => {
    for (const bad of [null, undefined, "not a date", 17, {}]) {
      const meta = buildPlatformPostMetadata(source({ publishedAt: bad }));
      expect(
        (meta.openGraph as { publishedTime?: string }).publishedTime,
      ).toBeUndefined();
    }
  });
});

describe("buildPlatformPostMetadata — totality", () => {
  it("survives any shape of seo blob", () => {
    for (const seo of [
      null,
      undefined,
      "a string",
      42,
      [],
      { title: 7, description: [], ogImage: {} },
      { robots: "nonsense" },
    ]) {
      expect(() => buildPlatformPostMetadata(source({ seo }))).not.toThrow();
    }
  });

  it("still resolves a title, a canonical and an image for an empty post", () => {
    const meta = buildPlatformPostMetadata({
      slug: "x",
      title: "",
      excerpt: null,
      coverImage: null,
      authorName: "",
      publishedAt: null,
      seo: undefined,
    });

    expect(meta.title).toBe(PLATFORM_POST_NOT_FOUND_TITLE);
    expect(meta.alternates?.canonical).toBe(`${platformBaseUrl()}/blog/x`);
    expect(ogImage(meta)).toMatch(/^https?:\/\//);
    expect(meta.authors).toEqual([{ name: PLATFORM_SITE_NAME }]);
  });
});
