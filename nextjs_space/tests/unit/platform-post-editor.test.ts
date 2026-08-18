import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_PLATFORM_AUTHOR_NAME,
  buildPlatformPostBody,
  deriveDraftSlug,
  isPublishedSlugMove,
  type PlatformPostFormValues,
} from "@/lib/platform/post-editor";
import { BLOG_INDEX_PATH, blogPostPath } from "@/lib/seo/blog-paths";
import { POST_SLUG_MAX_LENGTH } from "@/lib/seo/post-slug";

/**
 * US-007 — the super-admin post editor, as US-019 left it.
 *
 * There is no component-test harness in this repo (nothing under tests/unit
 * renders React), so the decisions worth pinning were split out of the form
 * into `lib/platform/post-editor.ts` and are asserted here:
 *
 *  1. a new post's URL is derived by the SAME rule the POST route would apply,
 *     and is left blank rather than guessed when a title yields nothing usable;
 *  2. changing a LIVE post's URL is flagged as a move — US-019 removed the
 *     read-only lock this field used to carry, because the save now writes a
 *     301 from the old path. The flag reads the SAVED state, not the form's
 *     publish toggle, because that is what the PATCH route compares against;
 *  3. a save always sends the slug it has, and only an EMPTY one is dropped so
 *     the create route can derive it.
 *
 * The last block reads the form as text, guarding the removals the story asks
 * for: the tenant editor's entitlement gating and its AI assist button must not
 * come back with the next copy-paste from `app/tenant-admin/the-wire`.
 */

const root = process.cwd(); // vitest runs from nextjs_space/

function values(over: Partial<PlatformPostFormValues> = {}): PlatformPostFormValues {
  return {
    title: "Should You Build on WordPress?",
    slug: "should-you-build-on-wordpress",
    content: "<p>Body.</p>",
    excerpt: "An excerpt.",
    coverImage: "/api/public-image/platform/uploads/cover.png",
    coverImageAlt: "A cover",
    authorName: DEFAULT_PLATFORM_AUTHOR_NAME,
    authorRole: "Platform Team",
    published: false,
    ...over,
  };
}

describe("deriveDraftSlug", () => {
  it("derives the URL a title implies", () => {
    expect(deriveDraftSlug("Should You Build on WordPress?")).toBe(
      "should-you-build-on-wordpress",
    );
  });

  it("returns empty — not a guess — when a title yields no usable segment", () => {
    // Slugifies to "-", which passes POST_SLUG_PATTERN and is nobody's URL.
    expect(deriveDraftSlug("!!! ???")).toBe("");
  });

  it("returns empty when the derived slug would overrun the column", () => {
    expect(deriveDraftSlug("a".repeat(POST_SLUG_MAX_LENGTH + 1))).toBe("");
  });

  it("is empty for an empty title, so the field starts blank", () => {
    expect(deriveDraftSlug("")).toBe("");
  });
});

describe("isPublishedSlugMove (US-019)", () => {
  const move = (over: Partial<Parameters<typeof isPublishedSlugMove>[0]> = {}) =>
    isPublishedSlugMove({
      isEditing: true,
      savedPublished: true,
      savedSlug: "old-url",
      slug: "new-url",
      ...over,
    });

  it("flags a changed URL on a live post", () => {
    expect(move()).toBe(true);
  });

  it("says nothing when the live post's URL is untouched", () => {
    // A warning next to a field nobody edited is noise, and noise is what an
    // author learns to click past on the one save that mattered.
    expect(move({ slug: "old-url" })).toBe(false);
  });

  it("says nothing for a draft — no public URL exists to move", () => {
    expect(move({ savedPublished: false })).toBe(false);
  });

  it("says nothing on create, even when the post is published immediately", () => {
    // Nothing links to a post that does not exist yet: there is no old URL.
    expect(move({ isEditing: false })).toBe(false);
  });

  it("ignores whitespace-only edits", () => {
    expect(move({ slug: "  old-url  " })).toBe(false);
    expect(move({ slug: "   " })).toBe(false);
  });
});

describe("buildPlatformPostBody", () => {
  it("sends the slug it has", () => {
    const body = buildPlatformPostBody(values());
    expect(body.slug).toBe("should-you-build-on-wordpress");
  });

  it("still sends a live post's unchanged slug (US-019)", () => {
    // Before US-019 this key was withheld on a published post to dodge the
    // rename refusal. There is no refusal now, and the PATCH route treats a
    // slug equal to the stored one as no rename at all — so nothing is written
    // and no redirect is minted for a body-only edit.
    const body = buildPlatformPostBody(values({ published: true }));
    expect(body.slug).toBe("should-you-build-on-wordpress");
    expect(body.published).toBe(true);
  });

  it("omits an empty slug so the create route derives it from the title", () => {
    // `""` would fail the server schema's min(1); an absent key is the ask.
    const body = buildPlatformPostBody(values({ slug: "   " }));
    expect("slug" in body).toBe(false);
  });

  it("trims what it sends, so a padded field is not stored padded", () => {
    const body = buildPlatformPostBody(
      values({ title: "  Spaced  ", authorName: " BudStacks ", slug: " abc " }),
    );
    expect(body.title).toBe("Spaced");
    expect(body.authorName).toBe("BudStacks");
    expect(body.slug).toBe("abc");
  });

  it("leaves the article body untouched — HTML is whitespace-significant", () => {
    const content = "  <p>Leading space is the editor's.</p>  ";
    const body = buildPlatformPostBody(values({ content }));
    expect(body.content).toBe(content);
  });

  it("sends only keys the strict server schema declares", () => {
    const allowed = [
      "title",
      "slug",
      "content",
      "excerpt",
      "coverImage",
      "coverImageAlt",
      "authorName",
      "authorRole",
      "published",
    ];
    const body = buildPlatformPostBody(values());
    expect(Object.keys(body).every((key) => allowed.includes(key))).toBe(true);
  });
});

describe("blog paths", () => {
  it("matches the path the sitemap already publishes", () => {
    const sitemap = readFileSync(join(root, "app", "sitemap.ts"), "utf8");
    expect(sitemap).toContain(`"${BLOG_INDEX_PATH}"`);
  });

  it("builds a post path from the index", () => {
    expect(blogPostPath("a-post")).toBe(`${BLOG_INDEX_PATH}/a-post`);
  });
});

describe("the platform editor is not the tenant editor (US-007)", () => {
  /**
   * Comments stripped before asserting. These files EXPLAIN what they left
   * behind — naming the tenant route and the entitlement gating is the point of
   * those paragraphs — so the claim under test is about the code that runs, not
   * about the prose. Block comments (including `{/* … *\/}` in JSX) and
   * whole-line `//` comments only; a trailing `//` is left alone so URLs inside
   * string literals survive intact.
   */
  const withoutComments = (source: string): string =>
    source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("//"))
      .join("\n");

  const read = (file: string) =>
    withoutComments(
      readFileSync(join(root, "app", "super-admin", "the-wire", file), "utf8"),
    );

  const form = () => read("post-form.tsx");

  it.each(["AiAssistButton", "entitlements", "seoProUnlocked", "getTenantPlan"])(
    "has no %s — entitlements and per-tenant AI credentials are tenant concepts",
    (symbol) => {
      expect(form()).not.toContain(`${symbol}`);
    },
  );

  it("posts to the platform routes, never the tenant ones", () => {
    const source = form();
    expect(source).toContain("/api/platform/posts");
    expect(source).not.toContain("/api/tenant-admin/");
  });

  it("uploads covers to the platform route, which has no tenant to scope to", () => {
    const cover = read("cover-image-field.tsx");
    expect(cover).toContain('"/api/platform/upload"');
    expect(cover).not.toContain("/api/tenant-admin/upload");
  });
});
