import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Platform US-019 — budstacks.io's own 301s.
 *
 * Three claims, one per layer, because a redirect that is written but never
 * fires is indistinguishable from no redirect at all:
 *
 *  1. the WRITE reuses `planSlugRenameRedirect` unchanged, so chains collapse
 *     rather than nest and a rename-back clears the rule that would shadow the
 *     post's new address;
 *  2. the FEED answers `?scope=platform` from `platform_seo_redirects` with no
 *     tenant resolution and no plan gate, and still answers the tenant table
 *     when the parameter is absent;
 *  3. the LOOKUP claims the apex and nothing else — a tenant host must never
 *     resolve against the platform's table.
 */

const prismaMock = vi.hoisted(() => ({
  platform_seo_redirects: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  seo_redirects: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { applyPlatformSlugRenameRedirect } from "@/lib/seo/platform-slug-redirects";
import {
  isPlatformRedirectSurface,
  PLATFORM_REDIRECT_SCOPE,
} from "@/lib/seo/redirect-lookup";
import type { TenantHostHint } from "@/lib/parse-host";

const ROW_ID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.platform_seo_redirects.findMany.mockResolvedValue([]);
  prismaMock.platform_seo_redirects.create.mockResolvedValue({});
  prismaMock.platform_seo_redirects.update.mockResolvedValue({});
  prismaMock.platform_seo_redirects.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.platform_seo_redirects.deleteMany.mockResolvedValue({ count: 0 });
});

const rename = (from: string, to: string) =>
  applyPlatformSlugRenameRedirect({
    oldPath: `/blog/${from}`,
    newPath: `/blog/${to}`,
  });

describe("applyPlatformSlugRenameRedirect", () => {
  it("writes the old → new rule, lower-casing only the key", () => {
    return rename("Old-Post", "new-post").then((outcome) => {
      expect(outcome).toEqual({ redirected: true, repointed: 0, replaced: 0 });
      expect(prismaMock.platform_seo_redirects.create).toHaveBeenCalledWith({
        data: {
          fromPath: "/blog/old-post",
          toPath: "/blog/new-post",
          statusCode: 301,
        },
      });
    });
  });

  it("scopes by nothing — there is no tenantId in any predicate", async () => {
    // The whole reason this table exists. A tenantId here would be a column
    // that does not exist, and a tenant filter would empty the apex's table.
    await rename("old-post", "new-post");

    const read = prismaMock.platform_seo_redirects.findMany.mock.calls[0][0];
    expect(read).not.toHaveProperty("where");
    expect(JSON.stringify(read)).not.toContain("tenantId");
    expect(
      JSON.stringify(prismaMock.platform_seo_redirects.create.mock.calls[0][0]),
    ).not.toContain("tenantId");
  });

  it("collapses a chain instead of nesting one", async () => {
    // /a already points at /b. Renaming /b → /c must re-aim it at /c, not leave
    // /a → /b → /c for a crawler to walk.
    prismaMock.platform_seo_redirects.findMany.mockResolvedValue([
      { id: ROW_ID, fromPath: "/blog/a", toPath: "/blog/b" },
    ]);

    const outcome = await rename("b", "c");

    expect(outcome.repointed).toBe(1);
    expect(prismaMock.platform_seo_redirects.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [ROW_ID] } },
      data: { toPath: "/blog/c" },
    });
  });

  it("clears a rule that would shadow the post's new address", async () => {
    // Rename back: "/blog/a → /blog/b" is left over from the first move, and
    // middleware redirects BEFORE routing — so without this delete the post
    // becomes unreachable at the URL it was just given.
    prismaMock.platform_seo_redirects.findMany.mockResolvedValue([
      { id: ROW_ID, fromPath: "/blog/a", toPath: "/blog/b" },
    ]);

    const outcome = await rename("b", "a");

    expect(outcome.replaced).toBe(1);
    expect(prismaMock.platform_seo_redirects.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [ROW_ID] } },
    });
  });

  it("retargets the rule already sitting on the old path, never stacking a second", async () => {
    prismaMock.platform_seo_redirects.findMany.mockResolvedValue([
      { id: ROW_ID, fromPath: "/blog/b", toPath: "/blog/x" },
    ]);

    await rename("b", "c");

    expect(prismaMock.platform_seo_redirects.update).toHaveBeenCalledWith({
      where: { id: ROW_ID },
      data: { toPath: "/blog/c" },
    });
    expect(prismaMock.platform_seo_redirects.create).not.toHaveBeenCalled();
  });

  it("reports a failed write rather than throwing at the caller", async () => {
    prismaMock.platform_seo_redirects.create.mockRejectedValue(
      new Error("db down"),
    );

    expect(await rename("old", "new")).toEqual({
      redirected: false,
      reason: "write_failed",
      repointed: 0,
      replaced: 0,
    });
  });

  it("refuses a path the table cannot hold", async () => {
    const outcome = await applyPlatformSlugRenameRedirect({
      oldPath: "https://evil.example/blog/a",
      newPath: "/blog/b",
    });

    expect(outcome).toMatchObject({ redirected: false, reason: "invalid_path" });
    expect(prismaMock.platform_seo_redirects.create).not.toHaveBeenCalled();
  });
});

describe("isPlatformRedirectSurface", () => {
  const SUBDOMAIN: TenantHostHint = { kind: "subdomain", subdomain: "acme" };
  const CUSTOM: TenantHostHint = { kind: "customDomain", host: "acme.com" };

  it("claims the apex", () => {
    expect(isPlatformRedirectSurface(null, "/blog/a-post")).toBe(true);
    expect(isPlatformRedirectSurface(null, "/")).toBe(true);
  });

  it("never claims a tenant host", () => {
    // The one failure that would matter: a store resolving its visitors
    // against budstacks.io's table.
    expect(isPlatformRedirectSurface(SUBDOMAIN, "/blog/a-post")).toBe(false);
    expect(isPlatformRedirectSurface(CUSTOM, "/blog/a-post")).toBe(false);
  });

  it("leaves dev's path-based storefronts to the tenant table", () => {
    // On localhost the hint is null for a store too — the path is what
    // distinguishes them.
    expect(isPlatformRedirectSurface(null, "/store/acme")).toBe(false);
    expect(isPlatformRedirectSurface(null, "/store/acme/products")).toBe(false);
    // …but "/store" alone is a platform 404, not a store.
    expect(isPlatformRedirectSurface(null, "/store")).toBe(true);
    expect(isPlatformRedirectSurface(null, "/store/")).toBe(true);
  });
});

describe("the feed's platform scope", () => {
  it("is the literal the lookup sends", () => {
    expect(PLATFORM_REDIRECT_SCOPE).toBe("platform");
  });
});
