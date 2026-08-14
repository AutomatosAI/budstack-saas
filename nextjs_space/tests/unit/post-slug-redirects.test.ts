import { describe, it, expect } from "vitest";

import {
  normalizePostSlug,
  POST_SLUG_PATTERN,
  slugifyPostTitle,
} from "@/lib/seo/post-slug";
import { SEO_REDIRECT_MAX_PER_TENANT } from "@/lib/seo/redirects";
import {
  planSlugRenameRedirect,
  type ExistingRedirectRow,
} from "@/lib/seo/slug-redirects";
import { wirePostPath } from "@/lib/seo/wire-paths";

/**
 * SEO Supercharge US-021 — the pure half: what a rename decides to do to the
 * redirect table, and the slug rule the editor and both write routes share.
 *
 * The applier's I/O is exercised through the PATCH route in
 * tests/unit/posts-slug-rename.test.ts; everything asserted here is decided
 * before a query runs.
 */

const OLD = wirePostPath("old-slug");
const NEW = wirePostPath("new-slug");

const row = (
  id: string,
  fromPath: string,
  toPath: string,
): ExistingRedirectRow => ({ id, fromPath, toPath });

describe("slugifyPostTitle / normalizePostSlug", () => {
  it("derives the slug the create route has always derived", () => {
    expect(slugifyPostTitle("Hello World")).toBe("hello-world");
    expect(slugifyPostTitle("  CBD & THC: what's the difference?  ")).toBe(
      "cbd-thc-whats-the-difference",
    );
  });

  it("canonicalises what an owner types instead of refusing it", () => {
    expect(normalizePostSlug("My New Post")).toBe("my-new-post");
    expect(normalizePostSlug("  Spaced Out  ")).toBe("spaced-out");
    expect(normalizePostSlug("MiXeD-CaSe")).toBe("mixed-case");
  });

  it("returns null when nothing usable survives", () => {
    expect(normalizePostSlug("!!!")).toBeNull();
    expect(normalizePostSlug("   ")).toBeNull();
    expect(normalizePostSlug("")).toBeNull();
    expect(normalizePostSlug(undefined)).toBeNull();
    expect(normalizePostSlug("a".repeat(201))).toBeNull();
  });

  it("is a NO-OP on anything slugifyPostTitle has produced", () => {
    // Load-bearing: the editor posts the slug back on every save, so a
    // normaliser that tidied legacy shapes would rename the post — and write a
    // 301 — for someone who only fixed a typo in the body.
    for (const legacy of [
      "hello-world",
      "under_scored",
      "-leading-hyphen",
      "digits-123",
    ]) {
      expect(normalizePostSlug(legacy)).toBe(legacy);
      expect(POST_SLUG_PATTERN.test(legacy)).toBe(true);
    }
  });

  it("rejects, in the editor, what the server would have rewritten", () => {
    expect(POST_SLUG_PATTERN.test("My New Post")).toBe(false);
    expect(POST_SLUG_PATTERN.test("Uppercase")).toBe(false);
    expect(POST_SLUG_PATTERN.test("slash/es")).toBe(false);
  });
});

describe("planSlugRenameRedirect", () => {
  it("writes the old path → new path rule when the table is empty", () => {
    const decision = planSlugRenameRedirect([], { oldPath: OLD, newPath: NEW });

    expect(decision).toEqual({
      ok: true,
      plan: {
        fromPath: OLD,
        toPath: NEW,
        deleteIds: [],
        repointIds: [],
        retargetId: null,
      },
    });
  });

  it("re-aims rules that pointed at the old path — no chains", () => {
    const rows = [
      row("ancient", wirePostPath("ancient"), OLD),
      row("unrelated", "/sale", "/products"),
    ];

    const decision = planSlugRenameRedirect(rows, {
      oldPath: OLD,
      newPath: NEW,
    });

    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.plan.repointIds).toEqual(["ancient"]);
    expect(decision.plan.deleteIds).toEqual([]);
  });

  it("deletes a rule that CLAIMS the new path — the rename-back case", () => {
    // /new-slug → /old-slug is what renaming new→old left behind. Renaming
    // back must clear it, or middleware redirects the post away from the URL it
    // was just given and the article is unreachable.
    const rows = [row("stale", NEW, OLD)];

    const decision = planSlugRenameRedirect(rows, {
      oldPath: OLD,
      newPath: NEW,
    });

    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.plan.deleteIds).toEqual(["stale"]);
    // Deleted, therefore not also re-aimed — it is gone, not pointed at itself.
    expect(decision.plan.repointIds).toEqual([]);
  });

  it("retargets an existing rule on the old path instead of stacking one", () => {
    const rows = [row("existing", OLD, "/somewhere-else")];

    const decision = planSlugRenameRedirect(rows, {
      oldPath: OLD,
      newPath: NEW,
    });

    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.plan.retargetId).toBe("existing");
  });

  it("is idempotent — the same rename twice adds nothing the second time", () => {
    const first = planSlugRenameRedirect([], { oldPath: OLD, newPath: NEW });
    expect(first.ok).toBe(true);

    const afterFirst = [row("written", OLD, NEW)];
    const second = planSlugRenameRedirect(afterFirst, {
      oldPath: OLD,
      newPath: NEW,
    });

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.plan.retargetId).toBe("written");
    expect(second.plan.deleteIds).toEqual([]);
    expect(second.plan.repointIds).toEqual([]);
  });

  it("matches case-insensitively on the key side", () => {
    const rows = [row("cased", NEW.toUpperCase(), OLD.toUpperCase())];

    const decision = planSlugRenameRedirect(rows, {
      oldPath: OLD,
      newPath: NEW,
    });

    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.plan.deleteIds).toEqual(["cased"]);
  });

  it("refuses a rename to the same path, or to an unusable one", () => {
    expect(planSlugRenameRedirect([], { oldPath: OLD, newPath: OLD })).toEqual({
      ok: false,
      reason: "invalid_path",
    });
    expect(
      planSlugRenameRedirect([], { oldPath: OLD, newPath: "" }),
    ).toEqual({ ok: false, reason: "invalid_path" });
  });

  it("refuses to exceed the per-tenant cap, and counts deletions as room", () => {
    const full: ExistingRedirectRow[] = Array.from(
      { length: SEO_REDIRECT_MAX_PER_TENANT },
      (_, index) => row(`r${index}`, `/p${index}`, "/somewhere"),
    );

    expect(planSlugRenameRedirect(full, { oldPath: OLD, newPath: NEW })).toEqual(
      { ok: false, reason: "limit_reached" },
    );

    // One of them claims the new path: deleting it makes room for the rename.
    const withShadow = [...full.slice(1), row("shadow", NEW, "/elsewhere")];
    const decision = planSlugRenameRedirect(withShadow, {
      oldPath: OLD,
      newPath: NEW,
    });
    expect(decision.ok).toBe(true);
  });

  it("never reports a loop for the shapes a rename can actually produce", () => {
    // The ordering is what makes this true: every rule FROM the new path is
    // deleted first, so the new rule's destination is the end of its chain.
    const rows = [
      row("back", NEW, OLD),
      row("chain", "/a", OLD),
      row("further", "/b", NEW),
    ];

    const decision = planSlugRenameRedirect(rows, {
      oldPath: OLD,
      newPath: NEW,
    });

    expect(decision.ok).toBe(true);
  });
});
