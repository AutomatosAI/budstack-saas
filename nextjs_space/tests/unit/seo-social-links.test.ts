import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * LLM Visibility US-006 — entity grounding, as `sameAs` on the store's
 * Organization node.
 *
 * The properties this file exists to hold:
 *
 *  1. `sameAs` IS ABSENT, NOT EMPTY, when a store has listed nothing. An empty
 *     array is a positive assertion that this business has no presence anywhere
 *     else — a worse statement than saying nothing at all, and free to avoid.
 *  2. THE TWO PAGES THAT STATE THE ORGANIZATION AGREE. The homepage and every
 *     Wire article emit the same `@id`; if one carried the profiles and the
 *     other did not, they would be two contradictory descriptions of one entity.
 *  3. AN http PROFILE NEVER PUBLISHES, AND NEVER TAKES THE BLOB DOWN WITH IT.
 *     The settings schema bounds size only, so a hand-edited http entry is
 *     dropped on READ rather than failing `parseTenantSettings` as a unit and
 *     erasing the tenant's tagline and colours.
 *  4. NOTHING TYPED INTO THE FIELD CAN BREAK OUT OF THE SCRIPT ELEMENT — a URL
 *     is a string an owner controls, and it reaches the DOM through the same
 *     serializer every other node does.
 *  5. GATING IN THE UI IS NOT GATING — a Basic tenant PUTting by hand gets 403
 *     `upgrade_required` and writes nothing.
 *
 * Module-boundary mocks only (getCurrentUser, prisma, permission resolution).
 * The real route, the real permission wrapper, the real plan gate and the real
 * builders all execute.
 */
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { resolveUserPermissions } = vi.hoisted(() => ({
  resolveUserPermissions: vi.fn(),
}));
const prismaMock = vi.hoisted(() => ({
  tenants: { findFirst: vi.fn(), update: vi.fn() },
  audit_logs: { create: vi.fn() },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/permissions/current-user-permissions", () => ({
  resolveUserPermissions,
}));

import { AUDIT_ACTIONS } from "@/lib/audit-log";
import { UPGRADE_REQUIRED_CODE } from "@/lib/entitlements/require-feature";
import {
  buildArticleJsonLd,
  type ArticleJsonLdSource,
} from "@/lib/seo/article-json-ld";
import {
  buildOrganizationNode,
  buildStoreJsonLd,
  serializeJsonLd,
  type JsonLdNode,
  type StoreJsonLdSource,
} from "@/lib/seo/json-ld";
import {
  SOCIAL_LINKS_MAX,
  SOCIAL_LINK_MAX_LENGTH,
  checkSocialLinks,
  isSocialProfileUrl,
  normalizeSocialLinks,
  readSocialLinks,
} from "@/lib/seo/social-links";
import { parseTenantSettings } from "@/lib/tenant/tenant-settings";
import { tenantSettingsLenientSchema } from "@/lib/validation/tenant-settings";
import { PUT as saveSocialLinks } from "@/app/api/tenant-admin/seo/social-links/route";

const TENANT_A = "tenant-a";
const CUSTOM_DOMAIN = "acme-cannabis.example";
const STORE_URL = `https://${CUSTOM_DOMAIN}`;
const BUSINESS_NAME = "Acme Cannabis Co";

const INSTAGRAM = "https://www.instagram.com/acmecannabis";
const LINKEDIN = "https://www.linkedin.com/company/acmecannabis";
const REGISTER = "https://find-and-update.company-information.service.gov.uk/company/12345678";

function storeSource(
  overrides: Partial<StoreJsonLdSource> = {},
): StoreJsonLdSource {
  return {
    id: TENANT_A,
    plan: "pro",
    businessName: BUSINESS_NAME,
    subdomain: "acme",
    customDomain: CUSTOM_DOMAIN,
    logoRef: null,
    socialLinks: [],
    businessAddress1: null,
    businessAddress2: null,
    businessCity: null,
    businessState: null,
    businessPostalCode: null,
    businessCountry: null,
    ...overrides,
  };
}

function articleSource(
  overrides: Partial<ArticleJsonLdSource> = {},
): ArticleJsonLdSource {
  return {
    tenantId: TENANT_A,
    plan: "pro",
    businessName: BUSINESS_NAME,
    subdomain: "acme",
    customDomain: CUSTOM_DOMAIN,
    logoRef: null,
    socialLinks: [],
    slug: "cannabis-and-chronic-pain",
    title: "Cannabis and chronic pain",
    excerpt: "What the evidence says.",
    coverImage: null,
    createdAt: new Date("2026-03-04T09:30:00.000Z"),
    updatedAt: new Date("2026-05-19T14:05:00.000Z"),
    seo: null,
    authorName: null,
    ...overrides,
  };
}

function nodeOfType(nodes: readonly JsonLdNode[], type: string): JsonLdNode {
  const found = nodes.find((node) => node["@type"] === type);
  expect(found, `expected a ${type} node`).toBeDefined();
  return found as JsonLdNode;
}

function adminUser() {
  return {
    id: "admin_1",
    email: "admin@store.dev",
    name: "Admin",
    image: "",
    role: "TENANT_ADMIN",
    tenantId: TENANT_A,
    clerkOrgId: null,
  };
}

function put(body: unknown) {
  return new NextRequest("http://localhost/api/tenant-admin/seo/social-links", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** The row the plan gate and the settings read both see on the admin route. */
function onPlan(plan: string, settings: unknown = {}) {
  prismaMock.tenants.findFirst.mockResolvedValue({
    id: TENANT_A,
    plan,
    settings,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue(adminUser());
  resolveUserPermissions.mockResolvedValue({
    permissions: { canViewSeo: true, canEditSeo: true },
    teamRole: "OWNER",
  });
  onPlan("pro");
  prismaMock.tenants.update.mockResolvedValue({});
  prismaMock.audit_logs.create.mockResolvedValue({});
});

describe("isSocialProfileUrl — what may be published as the store's identity", () => {
  it("accepts an absolute https profile URL", () => {
    for (const url of [INSTAGRAM, LINKEDIN, REGISTER]) {
      expect(isSocialProfileUrl(url), url).toBe(true);
    }
  });

  it("refuses every scheme but https", () => {
    for (const url of [
      "http://www.instagram.com/acmecannabis",
      "ftp://files.example.com/profile",
      // eslint-disable-next-line no-script-url
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "mailto:hello@acme.example",
    ]) {
      expect(isSocialProfileUrl(url), url).toBe(false);
    }
  });

  it("refuses anything that is not an absolute URL", () => {
    for (const value of [
      "www.instagram.com/acmecannabis",
      "/instagram",
      "instagram",
      "",
      "   ",
      "https://",
    ]) {
      expect(isSocialProfileUrl(value), JSON.stringify(value)).toBe(false);
    }
  });

  it("refuses a non-string, whatever it is", () => {
    for (const value of [null, undefined, 42, true, {}, [], new Date()]) {
      expect(isSocialProfileUrl(value), String(value)).toBe(false);
    }
  });

  it("refuses a URL longer than the cap", () => {
    const long = `https://example.com/${"a".repeat(SOCIAL_LINK_MAX_LENGTH)}`;
    expect(long.length).toBeGreaterThan(SOCIAL_LINK_MAX_LENGTH);
    expect(isSocialProfileUrl(long)).toBe(false);
    // …and one exactly at the cap is fine, so the boundary is not off by one.
    expect(isSocialProfileUrl(long.slice(0, SOCIAL_LINK_MAX_LENGTH))).toBe(true);
  });
});

describe("normalizeSocialLinks — the fail-closed read", () => {
  it("keeps the https entries in the order they were listed", () => {
    expect(normalizeSocialLinks([INSTAGRAM, LINKEDIN, REGISTER])).toEqual([
      INSTAGRAM,
      LINKEDIN,
      REGISTER,
    ]);
  });

  it("drops what it cannot publish instead of throwing", () => {
    expect(
      normalizeSocialLinks([
        INSTAGRAM,
        "http://www.linkedin.com/company/acmecannabis",
        null,
        42,
        { url: REGISTER },
        "not a url",
      ]),
    ).toEqual([INSTAGRAM]);
  });

  it("returns an empty list for anything that is not an array", () => {
    for (const value of [null, undefined, INSTAGRAM, 7, {}, { 0: INSTAGRAM }]) {
      expect(normalizeSocialLinks(value), String(value)).toEqual([]);
    }
  });

  it("trims surrounding whitespace before judging an entry", () => {
    expect(normalizeSocialLinks([`  ${INSTAGRAM}\n`])).toEqual([INSTAGRAM]);
  });

  it("states one profile once", () => {
    expect(
      normalizeSocialLinks([INSTAGRAM, ` ${INSTAGRAM} `, LINKEDIN]),
    ).toEqual([INSTAGRAM, LINKEDIN]);
  });

  it("stops at the cap rather than publishing an unbounded list", () => {
    const many = Array.from(
      { length: SOCIAL_LINKS_MAX + 5 },
      (_, index) => `https://example.com/profile-${index}`,
    );
    expect(normalizeSocialLinks(many)).toHaveLength(SOCIAL_LINKS_MAX);
  });
});

describe("checkSocialLinks — the write path refuses rather than filters", () => {
  it("accepts a well-formed list and returns it trimmed and deduped", () => {
    const checked = checkSocialLinks([` ${INSTAGRAM}`, LINKEDIN, INSTAGRAM]);
    expect(checked).toEqual({ ok: true, value: [INSTAGRAM, LINKEDIN] });
  });

  it("accepts an empty list — that is how an owner removes every profile", () => {
    expect(checkSocialLinks([])).toEqual({ ok: true, value: [] });
  });

  it("names the offending entry rather than silently dropping it", () => {
    const bad = "http://www.instagram.com/acmecannabis";
    const checked = checkSocialLinks([INSTAGRAM, bad]);

    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect(checked.message).toContain("https://");
      expect(checked.message).toContain(bad);
    }
  });

  it("refuses more than the cap, and says what the cap is", () => {
    const many = Array.from(
      { length: SOCIAL_LINKS_MAX + 1 },
      (_, index) => `https://example.com/profile-${index}`,
    );
    const checked = checkSocialLinks(many);

    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.message).toContain(String(SOCIAL_LINKS_MAX));
  });

  it("refuses a body that is not a list at all", () => {
    expect(checkSocialLinks(INSTAGRAM).ok).toBe(false);
    expect(checkSocialLinks(null).ok).toBe(false);
  });

  it("does not quote back an entire pasted document in the rejection", () => {
    const checked = checkSocialLinks(["x".repeat(SOCIAL_LINK_MAX_LENGTH)]);
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.message.length).toBeLessThan(400);
  });
});

describe("the stored settings key", () => {
  it("round-trips a saved list through the shared settings schema", () => {
    const parsed = tenantSettingsLenientSchema.safeParse({
      socialLinks: [INSTAGRAM, LINKEDIN],
    });
    expect(parsed.success).toBe(true);
  });

  it("does not take the rest of the blob down when an entry is http", () => {
    // The reason the schema bounds SIZE and not the scheme: `parseTenantSettings`
    // fails as a unit, and a store's tagline must not disappear because someone
    // hand-edited this key.
    const settings = parseTenantSettings({
      businessName: BUSINESS_NAME,
      tagline: "Wellness, delivered",
      socialLinks: [INSTAGRAM, "http://www.linkedin.com/company/acmecannabis"],
    });

    expect(settings.tagline).toBe("Wellness, delivered");
    expect(readSocialLinks(settings)).toEqual([INSTAGRAM]);
  });

  it("reads an absent key as no profiles rather than as undefined", () => {
    expect(readSocialLinks(parseTenantSettings({ tagline: "x" }))).toEqual([]);
    expect(readSocialLinks(parseTenantSettings(null))).toEqual([]);
    expect(readSocialLinks(null)).toEqual([]);
    expect(readSocialLinks(undefined)).toEqual([]);
  });
});

describe("the Organization node — sameAs renders, and is omitted when empty", () => {
  it("carries the store's profiles as sameAs", () => {
    const nodes = buildStoreJsonLd(
      storeSource({ socialLinks: [INSTAGRAM, LINKEDIN] }),
    );
    const organization = nodeOfType(nodes, "Organization");

    expect(organization.sameAs).toEqual([INSTAGRAM, LINKEDIN]);
  });

  it("omits the property ENTIRELY when the store has listed nothing", () => {
    const organization = nodeOfType(
      buildStoreJsonLd(storeSource({ socialLinks: [] })),
      "Organization",
    );

    expect("sameAs" in organization).toBe(false);
    expect(JSON.stringify(organization)).not.toContain("sameAs");
  });

  it("omits it when every listed profile fails the scheme rule", () => {
    const organization = nodeOfType(
      buildStoreJsonLd(
        storeSource({ socialLinks: ["http://insecure.example/profile"] }),
      ),
      "Organization",
    );

    expect("sameAs" in organization).toBe(false);
  });

  it("re-checks the list the caller handed it, in case that caller built it another way", () => {
    const organization = buildOrganizationNode(STORE_URL, BUSINESS_NAME, null, [
      INSTAGRAM,
      "http://insecure.example/profile",
      "javascript:alert(1)",
    ]);

    expect(organization.sameAs).toEqual([INSTAGRAM]);
  });

  it("emits nothing at all for a Basic tenant, profiles or not", () => {
    expect(
      buildStoreJsonLd(
        storeSource({ plan: "basic", socialLinks: [INSTAGRAM, LINKEDIN] }),
      ),
    ).toEqual([]);
  });

  it("keeps the address-bearing LocalBusiness alongside it", () => {
    const nodes = buildStoreJsonLd(
      storeSource({
        socialLinks: [INSTAGRAM],
        businessAddress1: "12 Rua da Prata",
        businessCity: "Lisbon",
        businessCountry: "Portugal",
      }),
    );

    expect(nodeOfType(nodes, "Organization").sameAs).toEqual([INSTAGRAM]);
    expect(nodeOfType(nodes, "LocalBusiness")).toBeDefined();
  });
});

describe("one entity, one description — the article publisher agrees with the homepage", () => {
  it("states the same sameAs under the same @id on both pages", () => {
    const socialLinks = [INSTAGRAM, LINKEDIN];

    const home = nodeOfType(
      buildStoreJsonLd(storeSource({ socialLinks })),
      "Organization",
    );
    const article = nodeOfType(
      buildArticleJsonLd(articleSource({ socialLinks })),
      "Organization",
    );

    expect(article["@id"]).toBe(home["@id"]);
    expect(article.sameAs).toEqual(home.sameAs);
  });

  it("omits the property on the article publisher too when there is nothing to say", () => {
    const article = nodeOfType(
      buildArticleJsonLd(articleSource({ socialLinks: [] })),
      "Organization",
    );

    expect("sameAs" in article).toBe(false);
  });
});

describe("nothing an owner types can terminate the script element", () => {
  it("escapes a </script> smuggled into a profile URL's path", () => {
    const hostile = `${STORE_URL}/</script><script>alert(1)</script>`;
    // The URL parser accepts it (the characters are legal in a path), so the
    // serializer is what has to hold — the same rule US-014 wrote down.
    expect(isSocialProfileUrl(hostile)).toBe(true);

    const serialized = serializeJsonLd(
      buildStoreJsonLd(storeSource({ socialLinks: [hostile] })),
    );

    expect(serialized).not.toBeNull();
    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c");
    // And the VALUE survives the escaping unchanged.
    expect(JSON.parse(serialized as string).sameAs).toEqual([hostile]);
  });
});

describe("PUT /api/tenant-admin/seo/social-links — the two gates", () => {
  it("saves for an entitled member and answers with what was stored", async () => {
    const response = await saveSocialLinks(
      put({ socialLinks: [` ${INSTAGRAM} `, LINKEDIN, INSTAGRAM] }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      socialLinks: [INSTAGRAM, LINKEDIN],
    });
  });

  it("stores an empty list, which is how a store removes every profile", async () => {
    onPlan("pro", { socialLinks: [INSTAGRAM] });
    const response = await saveSocialLinks(put({ socialLinks: [] }));

    expect(response.status).toBe(200);
    expect(
      prismaMock.tenants.update.mock.calls[0][0].data.settings.socialLinks,
    ).toEqual([]);
  });

  it("refuses a Basic tenant with upgrade_required, and writes nothing", async () => {
    onPlan("basic");
    const response = await saveSocialLinks(put({ socialLinks: [INSTAGRAM] }));

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe(UPGRADE_REQUIRED_CODE);
    expect(prismaMock.tenants.update).not.toHaveBeenCalled();
  });

  it("refuses a member without canEditSeo before the plan is ever looked up", async () => {
    resolveUserPermissions.mockResolvedValue({
      permissions: { canViewSeo: true, canEditSeo: false },
      teamRole: "STAFF",
    });
    const response = await saveSocialLinks(put({ socialLinks: [INSTAGRAM] }));

    expect(response.status).toBe(403);
    expect(prismaMock.tenants.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.tenants.update).not.toHaveBeenCalled();
  });

  it("401s an unauthenticated caller, without resolving permissions", async () => {
    getCurrentUser.mockResolvedValue(null);
    const response = await saveSocialLinks(put({ socialLinks: [INSTAGRAM] }));

    expect(response.status).toBe(401);
    expect(resolveUserPermissions).not.toHaveBeenCalled();
    expect(prismaMock.tenants.update).not.toHaveBeenCalled();
  });

  it("refuses an http entry with the message the field shows, and writes nothing", async () => {
    const response = await saveSocialLinks(
      put({ socialLinks: ["http://www.instagram.com/acmecannabis"] }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("https://");
    expect(prismaMock.tenants.update).not.toHaveBeenCalled();
  });

  it("refuses a malformed body, an over-long entry, an over-long list and any extra key", async () => {
    const tooMany = Array.from(
      { length: SOCIAL_LINKS_MAX + 1 },
      (_, index) => `https://example.com/profile-${index}`,
    );

    for (const body of [
      {},
      { socialLinks: INSTAGRAM },
      { socialLinks: null },
      { socialLinks: [42] },
      { socialLinks: [`https://example.com/${"a".repeat(SOCIAL_LINK_MAX_LENGTH)}`] },
      { socialLinks: tooMany },
      { socialLinks: [INSTAGRAM], socialMedia: { facebook: "x" } },
    ]) {
      const response = await saveSocialLinks(put(body));
      expect(response.status, JSON.stringify(body).slice(0, 60)).toBe(400);
    }
    expect(prismaMock.tenants.update).not.toHaveBeenCalled();
  });

  it("merges into the settings blob without dropping keys it has never heard of", async () => {
    onPlan("pro", {
      businessName: BUSINESS_NAME,
      smtp: { host: "smtp.example.dev" },
      aKeyThisVersionHasNeverHeardOf: { nested: true },
    });

    await saveSocialLinks(put({ socialLinks: [INSTAGRAM] }));

    expect(prismaMock.tenants.update.mock.calls[0][0].data.settings).toEqual({
      businessName: BUSINESS_NAME,
      smtp: { host: "smtp.example.dev" },
      aKeyThisVersionHasNeverHeardOf: { nested: true },
      socialLinks: [INSTAGRAM],
    });
  });

  it("names its own tenant on the read and the write", async () => {
    await saveSocialLinks(put({ socialLinks: [INSTAGRAM] }));

    expect(prismaMock.tenants.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TENANT_A } }),
    );
    expect(prismaMock.tenants.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TENANT_A } }),
    );
  });

  it("records the transition in the audit log", async () => {
    onPlan("pro", { socialLinks: [LINKEDIN] });
    await saveSocialLinks(put({ socialLinks: [INSTAGRAM] }));

    expect(prismaMock.audit_logs.create).toHaveBeenCalledTimes(1);
    const row = prismaMock.audit_logs.create.mock.calls[0][0].data;
    expect(row.action).toBe(AUDIT_ACTIONS.SEO_SOCIAL_LINKS_UPDATED);
    expect(row.tenantId).toBe(TENANT_A);
    expect(row.metadata).toEqual({ from: [LINKEDIN], to: [INSTAGRAM] });
  });

  it("reports the previous list as what was PUBLISHED, not what was stored", async () => {
    // A hand-edited http entry was never in anyone's structured data, so the
    // audit row must not claim the store just removed it.
    onPlan("pro", { socialLinks: ["http://insecure.example/profile"] });
    await saveSocialLinks(put({ socialLinks: [INSTAGRAM] }));

    const row = prismaMock.audit_logs.create.mock.calls[0][0].data;
    expect(row.metadata).toEqual({ from: [], to: [INSTAGRAM] });
  });

  it("404s a tenant row that is gone, without writing", async () => {
    prismaMock.tenants.findFirst
      .mockResolvedValueOnce({ id: TENANT_A, plan: "pro" }) // the plan gate's read
      .mockResolvedValueOnce(null); // the settings read

    const response = await saveSocialLinks(put({ socialLinks: [INSTAGRAM] }));

    expect(response.status).toBe(404);
    expect(prismaMock.tenants.update).not.toHaveBeenCalled();
  });
});
