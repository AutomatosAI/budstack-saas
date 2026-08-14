import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// SEO Supercharge US-002 — the static store pages consume tenants.pageSeo.
//
// The property this file exists to hold: what an owner types into the SEO
// Manager is what the storefront renders, and the three lists that used to
// disagree (admin tab, write route enum, the pages that read the column) are
// now one constant. Before this story only `home` was ever read back — About,
// Contact and FAQ were saveable and invisible.
//
// The route is exercised through the REAL zod schema, the REAL auth wrapper and
// (since US-010) the REAL permission gate; only getCurrentUser and prisma are
// mocked, so what is asserted is the shipped behaviour rather than a
// re-implementation of it. The mocked `users` row resolves to a null teamRole —
// a legacy pre-teams admin, which resolvePermissions grants everything.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const prismaMock = vi.hoisted(() => ({
  tenants: { findUnique: vi.fn(), update: vi.fn() },
  users: { findFirst: vi.fn() },
  // US-010 replaced the read-modify-write with ONE statement.
  $queryRaw: vi.fn(),
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { buildStorePageMetadata } from "@/lib/seo/page-metadata";
import { storeCanonical } from "@/lib/seo/canonical";
import {
  STORE_SEO_PAGES,
  STORE_SEO_PAGE_KEYS,
  dropLegacyStorePageSeoKeys,
  readStorePageSeo,
} from "@/lib/seo/store-pages";
import { PUBLIC_IMAGE_ROUTE_PREFIX } from "@/lib/storage/public-image-url";
import { PUT as putPageSeo } from "@/app/api/tenant-admin/seo/pages/route";

const BUSINESS_NAME = "Acme Cannabis Co";
const CUSTOM_DOMAIN = "acme-cannabis.example";
const CUSTOM_ORIGIN = `https://${CUSTOM_DOMAIN}`;
const TENANT_A = "tenant-a";

const tenant = { subdomain: "acme", customDomain: CUSTOM_DOMAIN };

function metadata(pageSeo: unknown, pageKey: "about" | "support" | "conditions" | "contact" = "about") {
  return buildStorePageMetadata({
    pageKey,
    businessName: BUSINESS_NAME,
    subdomain: "acme",
    customDomain: CUSTOM_DOMAIN,
    pageSeo,
  });
}

describe("buildStorePageMetadata — the authored value is what renders", () => {
  it("renders an authored title verbatim, never brand-suffixed", () => {
    // `absolute` is what bypasses the layout's "%s | {businessName}" template.
    // The SEO Manager shows the owner a Google preview of the exact string they
    // typed; appending the business name would make that preview a lie.
    expect(metadata({ about: { title: "Meet the growers" } }).title).toEqual({
      absolute: "Meet the growers",
    });
  });

  it("falls back to a page-specific default the layout template can suffix", () => {
    // A plain string (not `absolute`) is what the layout wraps into
    // "About Us | Acme Cannabis Co" on every segment deeper than the homepage.
    expect(metadata(null).title).toBe("About Us");
  });

  it("prefers the authored description, then a tenant-branded default", () => {
    expect(metadata({ about: { description: " Since 2019 " } }).description).toBe(
      "Since 2019",
    );
    expect(metadata(null).description).toBe(
      `Learn about ${BUSINESS_NAME} and how our medical cannabis service works.`,
    );
  });

  it("gives every authorable page its own default title and description", () => {
    const seen = new Map<string, string>();

    for (const page of STORE_SEO_PAGES) {
      if (page.key === "home") continue; // home builds its own metadata today
      const built = metadata(null, page.key as "about");

      expect(typeof built.title).toBe("string");
      expect(built.description).toContain(BUSINESS_NAME);
      // No two pages may share a title — duplicate titles across a site are the
      // exact defect this story is fixing, just one level up.
      expect(seen.has(built.title as string)).toBe(false);
      seen.set(built.title as string, page.key);
    }
  });
});

describe("buildStorePageMetadata — composing with the US-001 layout metadata", () => {
  it("re-declares og siteName/type/locale, which Next would otherwise drop", () => {
    // openGraph is REPLACED wholesale by the deepest segment that declares it
    // (resolve-metadata.js:146), so omitting these would strip og:site_name from
    // exactly the pages this story is fixing.
    expect(metadata(null).openGraph).toMatchObject({
      siteName: BUSINESS_NAME,
      type: "website",
      locale: "en_US",
      url: `${CUSTOM_ORIGIN}/about`,
    });
  });

  it("leaves og/twitter titles to Next so they match the resolved <title>", () => {
    // postProcessMetadata fills them from the RESOLVED title/description, i.e.
    // after the layout template is applied. Setting them here would emit an
    // og:title without the brand suffix that <title> carries.
    const built = metadata({ about: { title: "Meet the growers" } });

    expect(built.openGraph).not.toHaveProperty("title");
    expect(built.openGraph).not.toHaveProperty("description");
    expect(built.twitter).toBeUndefined();
  });

  it("carries no platform string anywhere in the resolved object", () => {
    const serialised = JSON.stringify(metadata(null));

    for (const platformString of [
      "BudStacks",
      "Medical Cannabis SaaS Platform",
      "Multi-tenant SaaS platform for medical cannabis dispensaries",
    ]) {
      expect(serialised).not.toContain(platformString);
    }
  });
});

describe("buildStorePageMetadata — og:image fails closed", () => {
  it("serves an uploaded image through the durable public image route", () => {
    const key = "development/tenants/tenant-a/uploads/og-about.png";

    expect(metadata({ about: { ogImage: key } }).openGraph).toMatchObject({
      images: [`${PUBLIC_IMAGE_ROUTE_PREFIX}${key}`],
    });
  });

  it("keeps an absolute URL an owner pasted", () => {
    expect(
      metadata({ about: { ogImage: "https://cdn.example/og.png" } }).openGraph,
    ).toMatchObject({ images: ["https://cdn.example/og.png"] });
  });

  it("drops a presigned S3 URL rather than rendering a tag that expires", () => {
    const presigned =
      "https://bucket.s3.eu-west-1.amazonaws.com/development/tenants/tenant-a/uploads/og.png?X-Amz-Signature=deadbeef";

    expect(
      metadata({ about: { ogImage: presigned } }).openGraph,
    ).not.toHaveProperty("images");
  });

  it("never throws on a malformed pageSeo blob", () => {
    // generateMetadata renders with no error.tsx boundary above it: a throw is
    // a blank page, not a missing tag.
    for (const pageSeo of ["nonsense", 42, [], { about: "nope" }, { about: { title: 7 } }]) {
      expect(metadata(pageSeo).title).toBe("About Us");
    }
  });
});

describe("readStorePageSeo — the retired faq key", () => {
  it("renders the old FAQ entry on /support, the page /faq redirects to", () => {
    expect(readStorePageSeo({ faq: { title: "Your questions" } }, "support")).toEqual(
      { title: "Your questions" },
    );
    expect(metadata({ faq: { title: "Your questions" } }, "support").title).toEqual({
      absolute: "Your questions",
    });
  });

  it("prefers the current key, whole entry, never a blend of the two", () => {
    const pageSeo = {
      support: { title: "Support" },
      faq: { title: "FAQ", description: "Old copy" },
    };

    expect(readStorePageSeo(pageSeo, "support")).toEqual({ title: "Support" });
  });

  it("does not leak a legacy entry onto an unrelated page", () => {
    expect(readStorePageSeo({ faq: { title: "FAQ" } }, "about")).toEqual({});
  });

  it("retires the legacy key on write so it cannot resurface", () => {
    expect(
      dropLegacyStorePageSeoKeys(
        { home: { title: "Home" }, faq: { title: "FAQ" } },
        "support",
      ),
    ).toEqual({ home: { title: "Home" } });
  });
});

describe("storeCanonical", () => {
  it("prefers the custom domain and preserves the path", () => {
    expect(storeCanonical(tenant, "/about")).toBe(`${CUSTOM_ORIGIN}/about`);
  });

  it("uses the subdomain host when there is no custom domain", () => {
    const canonical = storeCanonical(
      { subdomain: "acme", customDomain: null },
      "/about",
    );

    expect(canonical.startsWith("https://acme.")).toBe(true);
    expect(canonical.endsWith("/about")).toBe(true);
  });

  it("emits the bare origin for the store root — no trailing-slash drift", () => {
    // The homepage's existing canonical (app/store/[slug]/page.tsx) is the bare
    // origin; `https://host` and `https://host/` are different URLs to a crawler.
    for (const path of ["", "/"]) {
      expect(storeCanonical(tenant, path)).toBe(CUSTOM_ORIGIN);
    }
    expect(storeCanonical(tenant, "/about/")).toBe(`${CUSTOM_ORIGIN}/about`);
  });

  it("drops query and fragment — a canonical points at one page", () => {
    expect(storeCanonical(tenant, "/products?page=2#top")).toBe(
      `${CUSTOM_ORIGIN}/products`,
    );
  });

  it("degrades to the subdomain host when the custom domain does not parse", () => {
    const canonical = storeCanonical(
      { subdomain: "acme", customDomain: "not a domain" },
      "/about",
    );

    expect(canonical.startsWith("https://acme.")).toBe(true);
  });

  it("takes an absolute override verbatim (US-022 slots in here)", () => {
    expect(
      storeCanonical(tenant, "/about", {
        override: "https://elsewhere.example/canonical",
      }),
    ).toBe("https://elsewhere.example/canonical");
  });

  it("treats a relative override as a path on the primary host", () => {
    expect(storeCanonical(tenant, "/about", { override: "/about-us" })).toBe(
      `${CUSTOM_ORIGIN}/about-us`,
    );
  });
});

describe("PUT /api/tenant-admin/seo/pages — the enum is the storefront's page list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({
      id: "admin_1",
      email: "admin@store.dev",
      role: "TENANT_ADMIN",
      tenantId: TENANT_A,
      clerkOrgId: null,
    });
    prismaMock.users.findFirst.mockResolvedValue({ teamRole: null });
    prismaMock.$queryRaw.mockResolvedValue([{ pageSeo: {} }]);
  });

  function put(body: unknown) {
    return putPageSeo(
      new NextRequest("http://store.dev/api/tenant-admin/seo/pages", {
        method: "PUT",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
      }),
    );
  }

  /** The values US-010's single statement bound as parameters. */
  function boundValues(): unknown[] {
    const [sql] = prismaMock.$queryRaw.mock.calls.at(-1) ?? [];
    return sql?.values ?? [];
  }

  it("accepts every key the admin tab offers", async () => {
    expect(STORE_SEO_PAGES.map((page) => page.key)).toEqual([
      ...STORE_SEO_PAGE_KEYS,
    ]);

    for (const key of STORE_SEO_PAGE_KEYS) {
      const response = await put({ pageKey: key, seo: { title: "T" } });
      expect(response.status).toBe(200);
    }
  });

  it("rejects the retired faq key", async () => {
    const response = await put({ pageKey: "faq", seo: { title: "T" } });

    expect(response.status).toBe(400);
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("retires the legacy entry when the replacing page is saved", async () => {
    // US-010 moved the merge from JS into the statement, so what is asserted
    // here is the instruction the database receives: drop `support` AND the
    // legacy `faq`, then merge the new support entry. The resulting blob is
    // covered in tests/unit/page-seo-write.test.ts.
    await put({ pageKey: "support", seo: { title: "Support" } });

    expect(boundValues()).toEqual(
      expect.arrayContaining([
        "support",
        "faq",
        JSON.stringify({ support: { title: "Support" } }),
      ]),
    );
  });

  it("scopes the write to the caller's tenant", async () => {
    await put({ pageKey: "about", seo: { title: "About" } });

    expect(boundValues()).toContain(TENANT_A);
  });

  it("never reads the blob back before writing it — the lost-update race is gone", async () => {
    await put({ pageKey: "about", seo: { title: "About" } });

    expect(prismaMock.tenants.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.tenants.update).not.toHaveBeenCalled();
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
