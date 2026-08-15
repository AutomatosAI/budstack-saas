import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_PLATFORM_AUTHOR_NAME,
  buildPlatformPostBody,
  deriveDraftSlug,
  isPublishedSlugLocked,
  type PlatformPostFormValues,
} from "@/lib/platform/post-editor";
import { BLOG_INDEX_PATH, blogPostPath } from "@/lib/seo/blog-paths";
import { POST_SLUG_MAX_LENGTH } from "@/lib/seo/post-slug";

/**
 * US-007 — the super-admin post editor.
 *
 * There is no component-test harness in this repo (nothing under tests/unit
 * renders React), so the decisions worth pinning were split out of the form
 * into `lib/platform/post-editor.ts` and are asserted here:
 *
 *  1. a new post's URL is derived by the SAME rule the POST route would apply,
 *     and is left blank rather than guessed when a title yields nothing usable;
 *  2. a PUBLISHED post's URL is locked, and the lock reads the SAVED state, not
 *     the form's publish toggle — the PATCH route compares against the database
 *     row, so unpublishing and renaming in one save is refused;
 *  3. a save on a locked post sends no slug at all, so fixing a typo in a live
 *     article cannot trip the rename refusal.
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

describe("isPublishedSlugLocked", () => {
  it("does not lock a new post, even one created as published", () => {
    // Nothing links to a post that does not exist yet — there is no old URL.
    expect(
      isPublishedSlugLocked({ isEditing: false, savedPublished: true }),
    ).toBe(false);
  });

  it("does not lock a saved draft", () => {
    expect(
      isPublishedSlugLocked({ isEditing: true, savedPublished: false }),
    ).toBe(false);
  });

  it("locks a post that is already live", () => {
    expect(
      isPublishedSlugLocked({ isEditing: true, savedPublished: true }),
    ).toBe(true);
  });
});

describe("buildPlatformPostBody", () => {
  it("sends the slug when the post is editable", () => {
    const body = buildPlatformPostBody(values(), { slugLocked: false });
    expect(body.slug).toBe("should-you-build-on-wordpress");
  });

  it("omits the slug entirely on a locked post", () => {
    // Not "sends the unchanged slug": an absent key means the PATCH route never
    // evaluates a rename, so a body-only edit to a live article cannot 409.
    const body = buildPlatformPostBody(
      values({ published: true }),
      { slugLocked: true },
    );
    expect("slug" in body).toBe(false);
    expect(body.published).toBe(true);
  });

  it("omits an empty slug so the create route derives it from the title", () => {
    // `""` would fail the server schema's min(1); an absent key is the ask.
    const body = buildPlatformPostBody(values({ slug: "   " }), {
      slugLocked: false,
    });
    expect("slug" in body).toBe(false);
  });

  it("trims what it sends, so a padded field is not stored padded", () => {
    const body = buildPlatformPostBody(
      values({ title: "  Spaced  ", authorName: " BudStacks ", slug: " abc " }),
      { slugLocked: false },
    );
    expect(body.title).toBe("Spaced");
    expect(body.authorName).toBe("BudStacks");
    expect(body.slug).toBe("abc");
  });

  it("leaves the article body untouched — HTML is whitespace-significant", () => {
    const content = "  <p>Leading space is the editor's.</p>  ";
    const body = buildPlatformPostBody(values({ content }), {
      slugLocked: false,
    });
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
    const body = buildPlatformPostBody(values(), { slugLocked: false });
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
