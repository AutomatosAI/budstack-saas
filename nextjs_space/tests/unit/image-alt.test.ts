import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// SEO Supercharge US-009 — alt-text authoring.
//
// The property this file holds: an owner can write alt text for the two images
// a storefront actually renders (a Wire post's cover, a product's strain shot),
// it survives every other write to the same row, and it degrades to something
// truthful when nobody has authored anything.
//
// WHERE IT LIVES, and why it is not what the story asked for. The story named
// `product_images.altText`; there is no `product_images` model in
// prisma/schema.prisma at all — `products.images` is a `String[]`, and the
// `altText` the detail gallery renders arrives on the Dr Green payload
// (`DoctorGreenProduct.strainImages[]`), which no store owner can edit. The
// authored value therefore goes in the one per-entity authored column that
// exists — `seo` — under a single `imageAlt` key shared by posts and products.
// No migration, and `products/sync` never writes `seo`, so a re-sync of the
// catalogue cannot erase it.
//
// The parser half is pure and is exercised directly. The route half is
// exercised through the real auth wrapper with prisma mocked at the module
// boundary, because the thing worth asserting is the SHAPE of the write.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { getTenantFromRequest } = vi.hoisted(() => ({
  getTenantFromRequest: vi.fn(),
}));
const prismaMock = vi.hoisted(() => ({
  users: { findFirst: vi.fn() },
  posts: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  products: { findFirst: vi.fn(), update: vi.fn() },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/tenant/tenant", () => ({ getTenantFromRequest }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  entityImageAlt,
  isEmptyEntitySeo,
  readEntitySeo,
  withEntityImageAlt,
} from "@/lib/seo/entity-seo";
import { PATCH as patchPost } from "@/app/api/tenant-admin/posts/[id]/route";
import { PUT as putPostSeo } from "@/app/api/tenant-admin/seo/posts/[id]/route";
import { PUT as putProductSeo } from "@/app/api/tenant-admin/seo/products/[id]/route";

const TENANT = "tenant-a";
const POST_UUID = "44444444-4444-4444-4444-444444444444";
const PRODUCT_UUID = "55555555-5555-5555-5555-555555555555";

/** What the SEO Manager has already written for this row. */
const AUTHORED_SEO = {
  title: "Terpenes, explained",
  description: "What the aroma compounds actually do.",
  ogImage: "tenants/t/og.png",
};

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue({
    id: "u_1",
    email: "owner@acme.dev",
    name: "Owner",
    image: "",
    role: "TENANT_ADMIN",
    tenantId: TENANT,
    clerkOrgId: null,
  });
  getTenantFromRequest.mockResolvedValue({ id: TENANT });
  prismaMock.users.findFirst.mockResolvedValue({ id: "u_1", tenantId: TENANT });
});

describe("readEntitySeo / entityImageAlt — the alt an image ends up carrying", () => {
  it("keeps an authored alt and trims it", () => {
    expect(readEntitySeo({ imageAlt: "  Dried flower in a jar  " })).toEqual({
      imageAlt: "Dried flower in a jar",
    });
  });

  it("fails closed on every non-string, exactly like the other fields", () => {
    // `generateMetadata` and the page body both read this column with no
    // error.tsx boundary above them, so a number alt must vanish rather than
    // render as `alt="7"` or throw.
    for (const blob of [{ imageAlt: 7 }, { imageAlt: {} }, { imageAlt: [] }]) {
      expect(readEntitySeo(blob)).toEqual({});
    }
  });

  it("counts an alt-only record as authored", () => {
    expect(isEmptyEntitySeo(readEntitySeo({ imageAlt: "A jar" }))).toBe(false);
    expect(isEmptyEntitySeo(readEntitySeo({ imageAlt: "   " }))).toBe(true);
  });

  it("falls back rather than returning nothing at all", () => {
    // A missing alt makes a screen reader read the file name aloud, so the
    // fallback is never skipped — only a caller passing "" gets "".
    expect(entityImageAlt({ imageAlt: "A jar" }, "Blue Dream")).toBe("A jar");
    expect(entityImageAlt(null, "Blue Dream")).toBe("Blue Dream");
    expect(entityImageAlt("corrupt", "Blue Dream")).toBe("Blue Dream");
    expect(entityImageAlt({ imageAlt: "" }, "Blue Dream")).toBe("Blue Dream");
  });
});

describe("withEntityImageAlt — one column, two editors, nothing lost", () => {
  it("keeps everything the SEO Manager authored", () => {
    expect(withEntityImageAlt(AUTHORED_SEO, "A greenhouse at dawn")).toEqual({
      ...AUTHORED_SEO,
      imageAlt: "A greenhouse at dawn",
    });
  });

  it("clears the alt without touching the rest", () => {
    expect(withEntityImageAlt({ ...AUTHORED_SEO, imageAlt: "old" }, "")).toEqual(
      AUTHORED_SEO,
    );
  });

  it("stores null when the row ends up with nothing authored", () => {
    // Matches what the SEO Manager's own write routes store for an empty
    // record, so "nothing authored" has ONE representation in the column.
    expect(withEntityImageAlt(null, "")).toBeNull();
    expect(withEntityImageAlt({}, "   ")).toBeNull();
  });

  it("cannot round-trip junk back into the column", () => {
    // The blob is re-read through the fail-closed parser before it is written,
    // so a hand-edited or legacy row is cleaned up by the next save.
    expect(
      withEntityImageAlt({ title: 7, description: "Real", extra: "drop me" }, "Alt"),
    ).toEqual({ description: "Real", imageAlt: "Alt" });
  });
});

describe("PATCH posts/[id] — the post editor writes seo.imageAlt", () => {
  beforeEach(() => {
    prismaMock.posts.findUnique.mockResolvedValue({
      id: POST_UUID,
      title: "Terpenes explained",
      tenantId: TENANT,
      seo: AUTHORED_SEO,
    });
    prismaMock.posts.findFirst.mockResolvedValue(null);
    prismaMock.posts.update.mockResolvedValue({ id: POST_UUID });
  });

  const patch = (body: Record<string, unknown>) =>
    patchPost(
      new NextRequest(`http://platform.dev/api/tenant-admin/posts/${POST_UUID}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
      { params: { id: POST_UUID } },
    );

  it("merges the alt into seo and never passes it as a column", async () => {
    // `posts` has no alt column; a `coverImageAlt` key reaching prisma is an
    // unknown-argument throw, which is why it is lifted out of the payload.
    await patch({ coverImageAlt: "A greenhouse at dawn" });

    const { data } = prismaMock.posts.update.mock.calls[0][0];
    expect(data.seo).toEqual({ ...AUTHORED_SEO, imageAlt: "A greenhouse at dawn" });
    expect(data).not.toHaveProperty("coverImageAlt");
  });

  it("leaves seo alone when the field is not in the body", async () => {
    // Every caller that predates this field — and the SEO Manager itself —
    // must not have its work nulled by an ordinary content edit.
    await patch({ excerpt: "A shorter summary" });

    expect(prismaMock.posts.update.mock.calls[0][0].data).not.toHaveProperty(
      "seo",
    );
  });

  it("clears the alt when the author empties the field", async () => {
    await patch({ coverImageAlt: "" });

    expect(prismaMock.posts.update.mock.calls[0][0].data.seo).toEqual(
      AUTHORED_SEO,
    );
  });

  it("writes DbNull — never a bare null — when nothing is left authored", async () => {
    // A bare `null` is not a legal value for a nullable Json column
    // (lib/email/email-template-content.ts:93-94): it throws rather than
    // clearing, which would 500 the save for a post whose only authored field
    // was the alt the writer just deleted.
    prismaMock.posts.findUnique.mockResolvedValue({
      id: POST_UUID,
      title: "Terpenes explained",
      tenantId: TENANT,
      seo: { imageAlt: "the only thing authored" },
    });

    await patch({ coverImageAlt: "" });

    expect(prismaMock.posts.update.mock.calls[0][0].data.seo).toBe(
      Prisma.DbNull,
    );
  });
});

describe("SEO Manager writes — the alt survives a metadata save", () => {
  const put = (
    handler: typeof putPostSeo,
    path: string,
    id: string,
    body: Record<string, unknown>,
  ) =>
    handler(
      new NextRequest(`http://platform.dev/api/tenant-admin/seo/${path}/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
      { params: { id } },
    );

  it("stores an alt authored against a post", async () => {
    prismaMock.posts.findFirst.mockResolvedValue({ id: POST_UUID });
    prismaMock.posts.update.mockResolvedValue({ id: POST_UUID });

    await put(putPostSeo, "posts", POST_UUID, {
      ...AUTHORED_SEO,
      imageAlt: "  A greenhouse at dawn  ",
    });

    expect(prismaMock.posts.update.mock.calls[0][0].data.seo).toEqual({
      ...AUTHORED_SEO,
      imageAlt: "A greenhouse at dawn",
    });
  });

  it("stores an alt authored against a product", async () => {
    // The product's ONLY authoring surface: the storefront reads the Dr Green
    // catalogue, which carries no field a store owner can write.
    prismaMock.products.findFirst.mockResolvedValue({ id: PRODUCT_UUID });
    prismaMock.products.update.mockResolvedValue({ id: PRODUCT_UUID });

    await put(putProductSeo, "products", PRODUCT_UUID, {
      title: "Blue Dream",
      imageAlt: "Dried Blue Dream flower in a glass jar",
    });

    expect(prismaMock.products.update.mock.calls[0][0].data.seo).toEqual({
      title: "Blue Dream",
      imageAlt: "Dried Blue Dream flower in a glass jar",
    });
  });

  it("clears the record with DbNull when every field is emptied", async () => {
    // The same nullable-Json trap, on the editor where all four fields live:
    // this route stored a bare `null` and threw. US-009's field makes it a
    // one-click path (type an alt on an otherwise-default post, delete it).
    prismaMock.posts.findFirst.mockResolvedValue({ id: POST_UUID });
    prismaMock.posts.update.mockResolvedValue({ id: POST_UUID });

    await put(putPostSeo, "posts", POST_UUID, {
      title: "",
      description: "",
      ogImage: "",
      imageAlt: "",
    });

    expect(prismaMock.posts.update.mock.calls[0][0].data.seo).toBe(
      Prisma.DbNull,
    );
  });

  it("rejects an alt longer than the column's cap", async () => {
    prismaMock.posts.findFirst.mockResolvedValue({ id: POST_UUID });

    const res = await put(putPostSeo, "posts", POST_UUID, {
      imageAlt: "x".repeat(301),
    });

    expect(res.status).toBe(400);
    expect(prismaMock.posts.update).not.toHaveBeenCalled();
  });
});
