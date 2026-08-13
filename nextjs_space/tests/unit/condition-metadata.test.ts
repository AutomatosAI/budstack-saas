import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// SEO Supercharge US-005 — condition pages consume conditions.seo.
//
// The properties this file exists to hold:
//  1. `conditions.seo` was the most orphaned column in the feature — nothing
//     wrote it, nothing read it. What an owner types into the new Conditions tab
//     is what the condition page renders, and it is the STORE's metadata rather
//     than the platform's.
//  2. A condition URL is keyed by the SLUG. The route segment is named `[id]`,
//     which is exactly how the product previews came to point at 404s (US-004);
//     one helper serves the admin preview and the page canonical so they cannot
//     disagree.
//  3. An id on `conditions` is an opaque string, not a uuid — the model declares
//     `id String @id` with no default, so a uuid gate would 400 valid rows.
//
// The builder is pure by design (`generateMetadata` renders with no error.tsx
// boundary above it), so it is exercised directly. The route runs through the
// REAL zod schema and the REAL auth wrapper — only getCurrentUser and prisma are
// mocked, so what is asserted is the shipped behaviour.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const prismaMock = vi.hoisted(() => ({
  conditions: { findFirst: vi.fn(), update: vi.fn() },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  CONDITION_NOT_FOUND_TITLE,
  buildConditionMetadata,
} from "@/lib/seo/condition-metadata";
import {
  CONDITIONS_INDEX_PATH,
  conditionPath,
} from "@/lib/seo/condition-paths";
import { storeSeoPage } from "@/lib/seo/store-pages";
import { SEO_DESCRIPTION_MAX_LENGTH } from "@/lib/seo/store-identity";
import { PUBLIC_IMAGE_ROUTE_PREFIX } from "@/lib/storage/public-image-url";
import { parseEntityId } from "@/lib/validation/parse-uuid";
import {
  GET as getConditionSeo,
  PUT as putConditionSeo,
} from "@/app/api/tenant-admin/seo/conditions/[id]/route";

const BUSINESS_NAME = "Acme Cannabis Co";
const SUBDOMAIN = "acme";
const CUSTOM_DOMAIN = "acme-cannabis.example";
const CUSTOM_ORIGIN = `https://${CUSTOM_DOMAIN}`;
const CONDITION_SLUG = "chronic-pain";
const CONDITION_IMAGE = "https://cdn.budstacks.example/conditions/pain.jpg";
const TENANT_A = "tenant-a";
// A real seeded id: crypto.randomUUID() (scripts/seed-conditions.ts:497).
const CONDITION_ID = "3f2a1b4c-5d6e-4f70-8192-a3b4c5d6e7f8";

const baseSource = {
  businessName: BUSINESS_NAME,
  subdomain: SUBDOMAIN,
  customDomain: CUSTOM_DOMAIN as string | null,
  slug: CONDITION_SLUG as unknown,
  name: "Chronic Pain" as unknown,
  description: "How medical cannabis is used for chronic pain." as unknown,
  image: CONDITION_IMAGE as unknown,
  seo: null as unknown,
};

function metadata(overrides: Partial<typeof baseSource> = {}) {
  return buildConditionMetadata({ ...baseSource, ...overrides });
}

describe("conditionPath — the URL a condition page actually has", () => {
  it("keys the path on the slug, not the row id", () => {
    // The listing links `conditions/{condition.slug}` (conditions-client.tsx
    // :342) and the API resolves it on the `(tenantId, slug)` unique.
    expect(conditionPath(CONDITION_SLUG)).toBe(
      `${CONDITIONS_INDEX_PATH}/${CONDITION_SLUG}`,
    );
  });

  it("shares the index path with the authorable conditions page", () => {
    // One path for the list page (authorable since US-002) and its children —
    // three lists that disagreed is the defect US-002 removed.
    expect(CONDITIONS_INDEX_PATH).toBe(storeSeoPage("conditions").path);
  });

  it("falls back to the listing rather than emitting /conditions/null", () => {
    expect(conditionPath(null)).toBe(CONDITIONS_INDEX_PATH);
    expect(conditionPath(undefined)).toBe(CONDITIONS_INDEX_PATH);
    expect(conditionPath("   ")).toBe(CONDITIONS_INDEX_PATH);
    expect(conditionPath(42)).toBe(CONDITIONS_INDEX_PATH);
  });
});

describe("buildConditionMetadata — the authored value is what renders", () => {
  it("renders an authored title verbatim, never brand-suffixed", () => {
    // `absolute` bypasses the layout's "%s | {businessName}" template, so the
    // Google preview the SEO Manager shows is the string that ships.
    expect(
      metadata({ seo: { title: "Cannabis for Chronic Pain | 2026 Guide" } })
        .title,
    ).toEqual({ absolute: "Cannabis for Chronic Pain | 2026 Guide" });
  });

  it("hands the condition name over UNSUFFIXED for the layout template", () => {
    const title = metadata().title;

    expect(title).toBe("Chronic Pain");
    expect(String(title)).not.toContain(BUSINESS_NAME);
  });

  it("titles a nameless row rather than rendering an empty <title>", () => {
    expect(metadata({ name: null }).title).toBe(CONDITION_NOT_FOUND_TITLE);
    expect(metadata({ name: "   " }).title).toBe(CONDITION_NOT_FOUND_TITLE);
  });

  it("prefers the authored description, then the condition's own copy", () => {
    expect(
      metadata({ seo: { description: " Relief options explained " } })
        .description,
    ).toBe("Relief options explained");
    expect(metadata().description).toBe(
      "How medical cannabis is used for chronic pain.",
    );
  });

  it("does NOT truncate an authored description", () => {
    // The owner previewed that exact string; the write route already caps it.
    const authored = "x".repeat(SEO_DESCRIPTION_MAX_LENGTH + 40);

    expect(metadata({ seo: { description: authored } }).description).toBe(
      authored,
    );
  });

  it("truncates the page's own intro copy, which is prose not a snippet", () => {
    const built = metadata({ description: "cannabis therapy ".repeat(30) });

    expect(String(built.description).length).toBeLessThanOrEqual(
      SEO_DESCRIPTION_MAX_LENGTH,
    );
    expect(String(built.description).endsWith("…")).toBe(true);
  });

  it("OMITS description when there is none, so the layout's is inherited", () => {
    // mergeMetadata assigns `target[key] = source[key] || null` for description
    // (resolve-metadata.js:194-205), so a present-but-undefined key would NULL
    // the store description instead of falling through to it.
    const built = metadata({ description: null, seo: null });

    expect("description" in built).toBe(false);
  });

  it("survives a conditions.seo blob of the wrong shape", () => {
    // The column is Prisma `Json?` with no DB-level shape. A throw inside
    // generateMetadata is a blank page, not a missing tag.
    for (const seo of [42, "a string", [], { title: 7, description: {} }]) {
      const built = metadata({ seo });

      expect(built.title).toBe("Chronic Pain");
      expect(built.description).toBe(
        "How medical cannabis is used for chronic pain.",
      );
    }
  });

  it("never falls through to the platform brand", () => {
    // The serialise-and-scan from US-001: this is the guarantee the whole
    // workstream exists for, asserted on the whole object so no nested field
    // can hide a platform string.
    const serialised = JSON.stringify(metadata({ seo: null, name: null }));

    for (const platformString of [
      "BudStacks",
      "Medical Cannabis SaaS",
      "budstacks.io",
    ]) {
      expect(serialised).not.toContain(platformString);
    }
  });
});

describe("buildConditionMetadata — canonical on the primary host", () => {
  it("points at the slug route on the custom domain when there is one", () => {
    const built = metadata();

    expect(built.alternates?.canonical).toBe(
      `${CUSTOM_ORIGIN}${CONDITIONS_INDEX_PATH}/${CONDITION_SLUG}`,
    );
    // og:url and the canonical are the same string — a page that disagrees with
    // itself is worse than a page with neither.
    expect(built.openGraph?.url).toBe(built.alternates?.canonical);
  });

  it("falls back to the subdomain host with no custom domain", () => {
    const canonical = String(
      metadata({ customDomain: null }).alternates?.canonical,
    );

    expect(canonical).toContain(SUBDOMAIN);
    expect(canonical).toContain(`${CONDITIONS_INDEX_PATH}/${CONDITION_SLUG}`);
    expect(canonical).not.toContain(CUSTOM_DOMAIN);
  });

  it("percent-encodes a slug that is not URL-safe", () => {
    const canonical = String(
      metadata({ slug: "chronic pain/100%" }).alternates?.canonical,
    );

    expect(canonical.startsWith(CUSTOM_ORIGIN)).toBe(true);
    expect(canonical).not.toContain(" ");
  });

  it("canonicalises to the listing when the row has no slug", () => {
    expect(metadata({ slug: null }).alternates?.canonical).toBe(
      `${CUSTOM_ORIGIN}${CONDITIONS_INDEX_PATH}`,
    );
  });
});

describe("buildConditionMetadata — og:image cascade", () => {
  it("prefers an authored ogImage over the condition image", () => {
    const key = "development/tenants/t1/uploads/og/chronic-pain.png";
    const built = metadata({ seo: { ogImage: key } });

    expect(built.openGraph?.images).toEqual([
      expect.stringContaining(PUBLIC_IMAGE_ROUTE_PREFIX),
    ]);
  });

  it("falls back to the condition's own image", () => {
    expect(metadata().openGraph?.images).toEqual([CONDITION_IMAGE]);
  });

  it("DROPS a presigned S3 URL rather than emitting a tag that expires", () => {
    const presigned = `${CONDITION_IMAGE}?X-Amz-Signature=deadbeef&X-Amz-Expires=3600`;
    const built = metadata({ image: presigned, seo: null });

    expect(built.openGraph?.images).toBeUndefined();
  });

  it("emits no images key at all when there is no usable image", () => {
    expect(metadata({ image: null }).openGraph?.images).toBeUndefined();
    expect(metadata({ image: 12345 }).openGraph?.images).toBeUndefined();
  });
});

describe("buildConditionMetadata — the tags the store layout must not lose", () => {
  it("re-declares og:site_name, because openGraph is replaced not merged", () => {
    // resolve-metadata.js:145 — the deepest segment that declares openGraph
    // REPLACES the parent's wholesale.
    expect(metadata().openGraph?.siteName).toBe(BUSINESS_NAME);
  });

  it("names the store by subdomain when the business name is blank", () => {
    expect(metadata({ businessName: "" }).openGraph?.siteName).toBe(SUBDOMAIN);
  });

  it("declares the large-image twitter card, and nothing else", () => {
    // Card type only: Next's postProcessMetadata fills twitter's title,
    // description and images from the resolved openGraph.
    expect(metadata().twitter).toEqual({ card: "summary_large_image" });
  });

  it("uses og:type website — the condition signal is FAQPage JSON-LD (US-017)", () => {
    expect(metadata().openGraph).toMatchObject({ type: "website" });
  });
});

describe("parseEntityId — conditions ids are opaque strings, not uuids", () => {
  it("accepts a uuid, a cuid and a nanoid alike", () => {
    // `conditions.id` has no DB default (prisma/schema.prisma), so `parseUuid`
    // would 400 any row whose id was not minted by crypto.randomUUID().
    for (const id of [CONDITION_ID, "clx7k2p9a0000abcd1234efgh", "V1StGXR8_Z5j"]) {
      expect(parseEntityId(id)).toBe(id);
    }
  });

  it("rejects anything that could reach a where clause as more than an id", () => {
    for (const id of ["", "   ", "a b", "../etc/passwd", "id'--", "%", "x".repeat(65)]) {
      expect(() => parseEntityId(id)).toThrow();
    }
  });
});

describe("/api/tenant-admin/seo/conditions/[id] — authoring the orphaned column", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({
      id: "admin_1",
      role: "TENANT_ADMIN",
      tenantId: TENANT_A,
      clerkOrgId: null,
    });
  });

  function put(id: string, body: unknown) {
    return putConditionSeo(
      new NextRequest(`http://store.dev/api/tenant-admin/seo/conditions/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
      }),
      { params: { id } },
    );
  }

  it("saves the three authored fields, trimmed", async () => {
    prismaMock.conditions.findFirst.mockResolvedValue({ id: CONDITION_ID });
    prismaMock.conditions.update.mockResolvedValue({ id: CONDITION_ID, seo: {} });

    const response = await put(CONDITION_ID, {
      title: " Chronic Pain Relief ",
      description: " What to expect ",
      ogImage: " https://cdn.example/og.png ",
    });

    expect(response.status).toBe(200);
    expect(prismaMock.conditions.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CONDITION_ID },
        data: expect.objectContaining({
          seo: {
            title: "Chronic Pain Relief",
            description: "What to expect",
            ogImage: "https://cdn.example/og.png",
          },
        }),
      }),
    );
  });

  it("scopes the ownership check to the caller's tenant", async () => {
    prismaMock.conditions.findFirst.mockResolvedValue({ id: CONDITION_ID });
    prismaMock.conditions.update.mockResolvedValue({ id: CONDITION_ID, seo: {} });

    await put(CONDITION_ID, { title: "T" });

    expect(prismaMock.conditions.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: CONDITION_ID, tenantId: TENANT_A } }),
    );
  });

  it("404s another tenant's condition WITHOUT writing", async () => {
    // The master tenant's shared conditions render on every store; editing one
    // would rewrite the metadata of every other store's page for it.
    prismaMock.conditions.findFirst.mockResolvedValue(null);

    const response = await put(CONDITION_ID, { title: "T" });

    expect(response.status).toBe(404);
    expect(prismaMock.conditions.update).not.toHaveBeenCalled();
  });

  it("clears the column when every field is emptied", async () => {
    prismaMock.conditions.findFirst.mockResolvedValue({ id: CONDITION_ID });
    prismaMock.conditions.update.mockResolvedValue({ id: CONDITION_ID, seo: null });

    await put(CONDITION_ID, { title: "", description: "  ", ogImage: "" });

    expect(prismaMock.conditions.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ seo: null }),
      }),
    );
  });

  it("rejects a malformed id before it reaches a query", async () => {
    const response = await put("../../etc/passwd", { title: "T" });

    expect(response.status).toBe(400);
    expect(prismaMock.conditions.findFirst).not.toHaveBeenCalled();
  });

  it("rejects an unknown field — the schema is strict", async () => {
    prismaMock.conditions.findFirst.mockResolvedValue({ id: CONDITION_ID });

    const response = await put(CONDITION_ID, { title: "T", robots: "noindex" });

    expect(response.status).toBe(400);
    expect(prismaMock.conditions.update).not.toHaveBeenCalled();
  });

  it("refuses a caller with no admin role", async () => {
    getCurrentUser.mockResolvedValue({
      id: "shopper_1",
      role: "CUSTOMER",
      tenantId: TENANT_A,
    });

    const response = await put(CONDITION_ID, { title: "T" });

    expect(response.status).toBe(401);
    expect(prismaMock.conditions.update).not.toHaveBeenCalled();
  });

  it("reads back only the tenant's own condition", async () => {
    prismaMock.conditions.findFirst.mockResolvedValue({
      id: CONDITION_ID,
      name: "Chronic Pain",
      slug: CONDITION_SLUG,
      seo: { title: "T" },
    });

    const response = await getConditionSeo(
      new NextRequest(
        `http://store.dev/api/tenant-admin/seo/conditions/${CONDITION_ID}`,
      ),
      { params: { id: CONDITION_ID } },
    );

    expect(response.status).toBe(200);
    expect(prismaMock.conditions.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: CONDITION_ID, tenantId: TENANT_A } }),
    );
  });
});
