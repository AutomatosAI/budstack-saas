import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// SEO Supercharge US-023 — the audit engine.
//
// Every check is a pure function over already-fetched rows, so this file needs
// no database, no clock and no mocks: a case is rows in, findings out. That is
// the property the story's notes ask for, and it is what makes the score
// reproducible — the same store always produces the same number.
//
// The one thing deliberately NOT re-implemented here is the sitemap. The
// sitemap checks run `buildStoreSitemapEntries`, the same function the store's
// sitemap.xml route renders from, so a regression in the builder (US-006's
// slug-vs-strain-id defect coming back) fails these tests rather than shipping.

import {
  auditDuplicateTitles,
  auditEntityFields,
  auditNoindexInSitemap,
  auditRedirectTable,
  auditSitemapHealth,
} from "@/lib/seo/audit-checks";
import {
  buildAuditSitemap,
  collectAuditEntities,
  type SeoAuditEntity,
  type SeoAuditInput,
} from "@/lib/seo/audit-snapshot";
import {
  runSeoAudit,
  scoreSeoAudit,
  seoAuditGrade,
  SEO_AUDIT_CHECKS,
  SEO_AUDIT_MAX_FINDINGS_PER_CHECK,
  SEO_AUDIT_WEIGHTS,
  type SeoAuditCheckId,
  type SeoAuditFinding,
  type SeoAuditStats,
} from "@/lib/seo/audit";
import {
  cachedSeoAudit,
  invalidateSeoAudit,
  resetSeoAuditCache,
  SEO_AUDIT_TTL_MS,
} from "@/lib/seo/audit-cache";
import {
  fetchSeoAudit,
  parseSeoAuditSnapshot,
  SEO_AUDIT_API_PATH,
} from "@/components/admin/seo/audit-client";
import { UPGRADE_REQUIRED_CODE } from "@/lib/entitlements/plan";
import { storeCanonical } from "@/lib/seo/canonical";
import { productPath } from "@/lib/seo/product-paths";

const TENANT = { subdomain: "acme", customDomain: null };
const TENANT_ID = "tenant-a";

/** A 60-character title — exactly the maximum, so neither short nor long. */
const GOOD_TITLE = "Blue Dream Medical Cannabis Flower for Chronic Pain Relief!!";
/** 100 characters — comfortably inside 70..160. */
const GOOD_DESCRIPTION =
  "Blue Dream is a balanced hybrid our clinicians prescribe for daytime pain relief without sedation.";

function entity(overrides: Partial<SeoAuditEntity> = {}): SeoAuditEntity {
  return {
    tab: "products",
    entityId: "p1",
    label: "Blue Dream",
    noun: "product",
    seo: { title: GOOD_TITLE, description: GOOD_DESCRIPTION },
    titleFallback: "the strain name from Dr Green",
    descriptionFallback: "the strain description from Dr Green",
    hasOwnImage: false,
    expectsOwnImage: false,
    path: "/products/strain-1",
    inSitemap: true,
    ...overrides,
  };
}

function checkIds(findings: readonly SeoAuditFinding[]): string[] {
  return findings.map((finding) => finding.check);
}

function makeInput(overrides: Partial<SeoAuditInput> = {}): SeoAuditInput {
  return {
    tenant: TENANT,
    tenantId: TENANT_ID,
    plan: "pro",
    pageSeo: null,
    products: [],
    deletedProducts: [],
    posts: [],
    conditions: [],
    redirects: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Field checks — one table, one row per rule.
// ---------------------------------------------------------------------------

describe("auditEntityFields", () => {
  const cases: ReadonlyArray<{
    name: string;
    entity: Partial<SeoAuditEntity>;
    expect: SeoAuditCheckId[];
  }> = [
    {
      name: "a fully authored entity is clean",
      entity: {},
      expect: [],
    },
    {
      name: "no title at all",
      entity: { seo: { description: GOOD_DESCRIPTION } },
      expect: ["title-missing"],
    },
    {
      name: "a title under the readable floor",
      entity: { seo: { title: "Blue Dream", description: GOOD_DESCRIPTION } },
      expect: ["title-short"],
    },
    {
      name: "a title past the clip width",
      entity: {
        seo: { title: `${GOOD_TITLE} and more words`, description: GOOD_DESCRIPTION },
      },
      expect: ["title-long"],
    },
    {
      name: "no description at all, with a fallback",
      entity: { seo: { title: GOOD_TITLE } },
      expect: ["description-missing"],
    },
    {
      name: "a description under the floor",
      entity: { seo: { title: GOOD_TITLE, description: "A hybrid strain." } },
      expect: ["description-short"],
    },
    {
      name: "a description past the clip width",
      entity: {
        seo: { title: GOOD_TITLE, description: `${GOOD_DESCRIPTION} ${GOOD_DESCRIPTION}` },
      },
      expect: ["description-long"],
    },
    {
      name: "an entity that should have an image and has none",
      entity: { expectsOwnImage: true },
      expect: ["og-image-missing"],
    },
    {
      name: "an authored ogImage answers the image check",
      entity: {
        expectsOwnImage: true,
        seo: {
          title: GOOD_TITLE,
          description: GOOD_DESCRIPTION,
          ogImage: "uploads/card.png",
        },
      },
      expect: [],
    },
    {
      name: "an image with no alt text",
      entity: { hasOwnImage: true, expectsOwnImage: true },
      expect: ["image-alt-missing"],
    },
    {
      name: "an image with alt text is clean",
      entity: {
        hasOwnImage: true,
        expectsOwnImage: true,
        seo: {
          title: GOOD_TITLE,
          description: GOOD_DESCRIPTION,
          imageAlt: "A jar of Blue Dream flower",
        },
      },
      expect: [],
    },
    {
      name: "a static page is never asked for an image of its own",
      entity: { tab: "pages", expectsOwnImage: false, hasOwnImage: false },
      expect: [],
    },
  ];

  for (const testCase of cases) {
    it(testCase.name, () => {
      expect(checkIds(auditEntityFields([entity(testCase.entity)]))).toEqual(
        testCase.expect,
      );
    });
  }

  it("length findings are exclusive — a missing title is not also short", () => {
    const findings = auditEntityFields([entity({ seo: {} })]);
    expect(checkIds(findings)).toEqual([
      "title-missing",
      "description-missing",
    ]);
  });

  it("names what renders instead when nothing falls back", () => {
    const [finding] = auditEntityFields([
      entity({ seo: { title: GOOD_TITLE }, descriptionFallback: "" }),
    ]);
    expect(finding.message).toContain("nothing to fall back on");
  });

  it("every finding carries a deep link to the row that fixes it", () => {
    const findings = auditEntityFields([
      entity({ seo: {}, tab: "posts", entityId: "post-9" }),
    ]);
    expect(findings.length).toBeGreaterThan(0);
    for (const finding of findings) {
      expect(finding.target).toEqual({
        tab: "posts",
        entityId: "post-9",
        label: "Blue Dream",
      });
    }
  });
});

// ---------------------------------------------------------------------------

describe("auditDuplicateTitles", () => {
  it("flags every member of a duplicate group", () => {
    const findings = auditDuplicateTitles([
      entity({ entityId: "a", seo: { title: "Pain Relief" } }),
      entity({ entityId: "b", seo: { title: "pain relief" } }),
      entity({ entityId: "c", seo: { title: "  Pain   Relief " } }),
    ]);
    expect(findings).toHaveLength(3);
    expect(findings[0].message).toContain("2 other pages");
  });

  it("ignores entities with no authored title — that is its own finding", () => {
    expect(
      auditDuplicateTitles([
        entity({ entityId: "a", seo: {} }),
        entity({ entityId: "b", seo: {} }),
      ]),
    ).toEqual([]);
  });

  it("says 'page' rather than 'pages' for a pair", () => {
    const findings = auditDuplicateTitles([
      entity({ entityId: "a", seo: { title: "Pain Relief" } }),
      entity({ entityId: "b", seo: { title: "Pain Relief" } }),
    ]);
    expect(findings[0].message).toContain("1 other page in this store");
  });
});

// ---------------------------------------------------------------------------

describe("auditNoindexInSitemap", () => {
  it("flags a noindexed page the sitemap still advertises", () => {
    const findings = auditNoindexInSitemap([
      entity({ seo: { robots: { noindex: true } }, inSitemap: true }),
    ]);
    expect(checkIds(findings)).toEqual(["noindex-in-sitemap"]);
  });

  it("says nothing when the owner excluded it from the sitemap too", () => {
    expect(
      auditNoindexInSitemap([
        entity({
          seo: { robots: { noindex: true }, sitemapExclude: true },
          inSitemap: false,
        }),
      ]),
    ).toEqual([]);
  });

  it("ignores nofollow — it is not an indexing instruction", () => {
    expect(
      auditNoindexInSitemap([
        entity({ seo: { robots: { nofollow: true } }, inSitemap: true }),
      ]),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe("collectAuditEntities", () => {
  it("keys a product's URL on the Dr Green strain id, never the slug", () => {
    const input = makeInput({
      products: [
        {
          id: "p1",
          name: "Blue Dream",
          drGreenStrainId: "strain-1",
          images: ["https://cdn.example/a.jpg"],
          seo: null,
          updatedAt: new Date("2026-08-01"),
        },
      ],
    });
    const products = collectAuditEntities(
      input,
      buildAuditSitemap(input).locs,
    ).filter((item) => item.tab === "products");

    expect(products).toHaveLength(1);
    expect(products[0].path).toBe("/products/strain-1");
    expect(products[0].inSitemap).toBe(true);
    expect(products[0].hasOwnImage).toBe(true);
  });

  it("gives a never-synced product no path at all", () => {
    const input = makeInput({
      products: [
        {
          id: "p1",
          name: "Draft strain",
          drGreenStrainId: null,
          images: [],
          seo: null,
          updatedAt: new Date("2026-08-01"),
        },
      ],
    });
    const products = collectAuditEntities(
      input,
      buildAuditSitemap(input).locs,
    ).filter((item) => item.tab === "products");
    expect(products[0].path).toBeNull();
    expect(products[0].inSitemap).toBe(false);
  });

  it("refuses a strain id that would not survive being put in a path", () => {
    const input = makeInput({
      products: [
        {
          id: "p1",
          name: "Odd id",
          drGreenStrainId: "strain/../etc",
          images: [],
          seo: null,
          updatedAt: new Date("2026-08-01"),
        },
      ],
    });
    const products = collectAuditEntities(
      input,
      buildAuditSitemap(input).locs,
    ).filter((item) => item.tab === "products");
    expect(products[0].path).toBeNull();
  });

  it("always produces the five static pages", () => {
    const pages = collectAuditEntities(makeInput(), new Set()).filter(
      (item) => item.tab === "pages",
    );
    expect(pages).toHaveLength(5);
    expect(pages.every((page) => page.expectsOwnImage === false)).toBe(true);
  });

  it("reads a post's fallback description from its excerpt", () => {
    const input = makeInput({
      posts: [
        {
          id: "post-1",
          title: "Hello",
          slug: "hello",
          excerpt: "",
          coverImage: null,
          seo: null,
          updatedAt: new Date("2026-08-01"),
        },
        {
          id: "post-2",
          title: "World",
          slug: "world",
          excerpt: "A summary.",
          coverImage: "uploads/cover.png",
          seo: null,
          updatedAt: new Date("2026-08-01"),
        },
      ],
    });
    const posts = collectAuditEntities(
      input,
      buildAuditSitemap(input).locs,
    ).filter((item) => item.tab === "posts");
    expect(posts[0].descriptionFallback).toBe("");
    expect(posts[1].descriptionFallback).toBe("the post excerpt");
    expect(posts[1].hasOwnImage).toBe(true);
  });

  it("survives rows whose fields are not the types the schema claims", () => {
    const input = makeInput({
      products: [
        {
          id: 7,
          name: { nope: true },
          drGreenStrainId: [],
          images: "not-an-array",
          seo: "not-an-object",
          updatedAt: "nonsense",
        },
      ],
    });
    // The row has no usable id, so it is dropped rather than rendered as
    // "Untitled product" with a target nothing can open.
    expect(
      collectAuditEntities(input, buildAuditSitemap(input).locs).filter(
        (item) => item.tab === "products",
      ),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe("auditSitemapHealth", () => {
  function health(input: SeoAuditInput) {
    const sitemap = buildAuditSitemap(input);
    const entities = collectAuditEntities(input, sitemap.locs);
    return auditSitemapHealth(input, entities, sitemap);
  }

  it("is silent on a store whose content is all advertised", () => {
    const input = makeInput({
      products: [
        {
          id: "p1",
          name: "Blue Dream",
          drGreenStrainId: "strain-1",
          images: [],
          seo: null,
          updatedAt: new Date("2026-08-01"),
        },
      ],
    });
    expect(checkIds(health(input))).toEqual([]);
  });

  it("flags a store with content and an empty sitemap", () => {
    // Every product excluded by the owner is the one way to reach this state
    // without breaking the builder.
    const input = makeInput({
      products: [
        {
          id: "p1",
          name: "Blue Dream",
          drGreenStrainId: "strain-1",
          images: [],
          seo: { sitemapExclude: true },
          updatedAt: new Date("2026-08-01"),
        },
      ],
    });
    const findings = health(input);
    expect(checkIds(findings)).toEqual(["sitemap-empty"]);
    expect(findings[0].target).toEqual({ tab: "pages", label: "Sitemap" });
  });

  it("does not report an empty sitemap for a store with no content", () => {
    expect(checkIds(health(makeInput()))).toEqual([]);
  });

  it("flags a product that never synced from Dr Green", () => {
    const input = makeInput({
      products: [
        {
          id: "p1",
          name: "Blue Dream",
          drGreenStrainId: "strain-1",
          images: [],
          seo: null,
          updatedAt: new Date("2026-08-01"),
        },
        {
          id: "p2",
          name: "Unsynced",
          drGreenStrainId: null,
          images: [],
          seo: null,
          updatedAt: new Date("2026-08-01"),
        },
      ],
    });
    const findings = health(input);
    expect(checkIds(findings)).toEqual(["product-no-page"]);
    expect(findings[0].target.entityId).toBe("p2");
  });

  it("flags a deleted product whose URL is still in the sitemap", () => {
    // The leak: a live row and a deleted row sharing a strain id. The sitemap
    // query filters `deletedAt: null`, so this is the shape that gets past it.
    const input = makeInput({
      products: [
        {
          id: "p1",
          name: "Blue Dream",
          drGreenStrainId: "strain-1",
          images: [],
          seo: null,
          updatedAt: new Date("2026-08-01"),
        },
      ],
      deletedProducts: [{ drGreenStrainId: "strain-1", name: "Old Blue Dream" }],
    });
    const findings = health(input);
    expect(checkIds(findings)).toEqual(["sitemap-deleted-leak"]);
    expect(findings[0].message).toContain("Old Blue Dream");
  });

  it("says nothing about a deleted product the sitemap does not carry", () => {
    const input = makeInput({
      deletedProducts: [{ drGreenStrainId: "strain-9", name: "Gone" }],
    });
    expect(checkIds(health(input))).toEqual([]);
  });

  it("does not report a page the owner deliberately excluded as missing", () => {
    const input = makeInput({
      posts: [
        {
          id: "post-1",
          title: "Hidden",
          slug: "hidden",
          excerpt: "x",
          coverImage: null,
          seo: { sitemapExclude: true },
          updatedAt: new Date("2026-08-01"),
        },
        {
          id: "post-2",
          title: "Shown",
          slug: "shown",
          excerpt: "x",
          coverImage: null,
          seo: null,
          updatedAt: new Date("2026-08-01"),
        },
      ],
    });
    expect(checkIds(health(input))).toEqual([]);
  });

  it("the sitemap it audits is the one the store publishes", () => {
    const input = makeInput({
      products: [
        {
          id: "p1",
          name: "Blue Dream",
          drGreenStrainId: "strain-1",
          images: [],
          seo: null,
          updatedAt: new Date("2026-08-01"),
        },
      ],
    });
    // The pin on US-006: the URL is keyed by the strain id, and it is the
    // builder — not a re-derivation in the audit — that produced it.
    expect([...buildAuditSitemap(input).locs]).toContain(
      storeCanonical(TENANT, productPath("strain-1")),
    );
  });
});

// ---------------------------------------------------------------------------

describe("auditRedirectTable", () => {
  it("is silent on a table of independent rules", () => {
    expect(
      checkIds(
        auditRedirectTable([
          { id: "r1", fromPath: "/old", toPath: "/new" },
          { id: "r2", fromPath: "/gone", toPath: "/home" },
        ]),
      ),
    ).toEqual([]);
  });

  it("flags a rule that redirects to itself", () => {
    const findings = auditRedirectTable([
      { id: "r1", fromPath: "/loop", toPath: "/loop" },
    ]);
    expect(checkIds(findings)).toEqual(["redirect-loop"]);
    expect(findings[0].message).toContain("redirects to itself");
    expect(findings[0].target).toEqual({
      tab: "redirects",
      entityId: "r1",
      label: "/loop",
    });
  });

  it("flags a two-hop cycle on both of its rules", () => {
    const findings = auditRedirectTable([
      { id: "r1", fromPath: "/a", toPath: "/b" },
      { id: "r2", fromPath: "/b", toPath: "/a" },
    ]);
    expect(checkIds(findings)).toEqual(["redirect-loop", "redirect-loop"]);
  });

  it("flags a chain as a suggestion, not a loop", () => {
    const findings = auditRedirectTable([
      { id: "r1", fromPath: "/a", toPath: "/b" },
      { id: "r2", fromPath: "/b", toPath: "/c" },
    ]);
    expect(checkIds(findings)).toEqual(["redirect-chain"]);
    expect(findings[0].target.entityId).toBe("r1");
  });

  it("matches case-insensitively, the way the table is stored", () => {
    expect(
      checkIds(
        auditRedirectTable([
          { id: "r1", fromPath: "/A", toPath: "/B" },
          { id: "r2", fromPath: "/b", toPath: "/c" },
        ]),
      ),
    ).toEqual(["redirect-chain"]);
  });

  it("drops rows whose paths do not normalise rather than guessing", () => {
    expect(
      auditRedirectTable([
        { id: "r1", fromPath: "https://evil.example", toPath: "/x" },
        { id: "", fromPath: "/a", toPath: "/b" },
      ]),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe("scoreSeoAudit", () => {
  const stats: SeoAuditStats = {
    pages: 5,
    products: 0,
    posts: 0,
    conditions: 0,
    redirects: 0,
    sitemapEntries: 7,
    truncated: [],
  };

  function findings(check: SeoAuditCheckId, count: number): SeoAuditFinding[] {
    return Array.from({ length: count }, (_, index) => ({
      check,
      severity: SEO_AUDIT_WEIGHTS[check].severity,
      message: `finding ${index}`,
      target: { tab: "products" as const, entityId: `p${index}`, label: "x" },
    }));
  }

  it("a clean store scores 100 and reports every check as passed", () => {
    const result = scoreSeoAudit([], stats);
    expect(result.score).toBe(100);
    expect(result.grade).toBe("good");
    expect(result.checks).toHaveLength(SEO_AUDIT_CHECKS.length);
    expect(result.checks.every((check) => check.total === 0)).toBe(true);
  });

  it("subtracts per finding until the check's cap", () => {
    const weight = SEO_AUDIT_WEIGHTS["title-missing"];
    const two = scoreSeoAudit(findings("title-missing", 2), stats);
    expect(two.score).toBe(100 - weight.perFinding * 2);

    const many = scoreSeoAudit(findings("title-missing", 400), stats);
    expect(many.score).toBe(100 - weight.cap);
  });

  it("the cap is what keeps one check from hiding every other", () => {
    // 400 missing titles AND a redirect loop: the loop must still move the
    // score, which is the whole reason the penalty is capped per check.
    const titlesOnly = scoreSeoAudit(findings("title-missing", 400), stats);
    const both = scoreSeoAudit(
      [...findings("title-missing", 400), ...findings("redirect-loop", 1)],
      stats,
    );
    expect(both.score).toBe(
      titlesOnly.score - SEO_AUDIT_WEIGHTS["redirect-loop"].perFinding,
    );
  });

  it("never goes below zero", () => {
    const everything = SEO_AUDIT_CHECKS.flatMap((check) =>
      findings(check, 100),
    );
    expect(scoreSeoAudit(everything, stats).score).toBe(0);
  });

  it("reports the true total while shipping a capped list", () => {
    const result = scoreSeoAudit(findings("title-missing", 400), stats);
    const group = result.checks.find((check) => check.check === "title-missing");
    expect(group?.total).toBe(400);
    expect(group?.findings).toHaveLength(SEO_AUDIT_MAX_FINDINGS_PER_CHECK);
    expect(result.totalFindings).toBe(400);
  });

  it("sorts failing checks first, worst severity first", () => {
    const result = scoreSeoAudit(
      [...findings("redirect-chain", 1), ...findings("redirect-loop", 1)],
      stats,
    );
    const failing = result.checks.filter((check) => check.total > 0);
    expect(failing.map((check) => check.check)).toEqual([
      "redirect-loop",
      "redirect-chain",
    ]);
    expect(result.checks[0].check).toBe("redirect-loop");
  });

  it("counts findings by severity", () => {
    const result = scoreSeoAudit(
      [...findings("redirect-loop", 2), ...findings("title-short", 3)],
      stats,
    );
    expect(result.severityCounts).toEqual({
      critical: 2,
      warning: 0,
      info: 3,
    });
  });

  it("grades on the documented bands", () => {
    expect(seoAuditGrade(100)).toBe("good");
    expect(seoAuditGrade(90)).toBe("good");
    expect(seoAuditGrade(89)).toBe("needs-work");
    expect(seoAuditGrade(70)).toBe("needs-work");
    expect(seoAuditGrade(69)).toBe("poor");
    expect(seoAuditGrade(0)).toBe("poor");
  });
});

// ---------------------------------------------------------------------------

describe("runSeoAudit", () => {
  it("a brand-new store is scored on its unauthored static pages", () => {
    const result = runSeoAudit(makeInput());
    const titles = result.checks.find((check) => check.check === "title-missing");
    expect(titles?.total).toBe(5);
    expect(result.stats.pages).toBe(5);
    expect(result.stats.sitemapEntries).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
  });

  it("reports which entity types were truncated", () => {
    expect(runSeoAudit(makeInput(), ["products"]).stats.truncated).toEqual([
      "products",
    ]);
  });

  it("is deterministic — the same rows always produce the same score", () => {
    const input = makeInput({
      products: [
        {
          id: "p1",
          name: "Blue Dream",
          drGreenStrainId: "strain-1",
          images: ["a.jpg"],
          seo: { title: GOOD_TITLE, description: GOOD_DESCRIPTION },
          updatedAt: new Date("2026-08-01"),
        },
      ],
      redirects: [{ id: "r1", fromPath: "/a", toPath: "/a" }],
    });
    expect(runSeoAudit(input).score).toBe(runSeoAudit(input).score);
  });

  it("carries a redirect loop through to the result", () => {
    const result = runSeoAudit(
      makeInput({ redirects: [{ id: "r1", fromPath: "/a", toPath: "/a" }] }),
    );
    const loops = result.checks.find((check) => check.check === "redirect-loop");
    expect(loops?.total).toBe(1);
    expect(result.severityCounts.critical).toBe(1);
  });
});

// ---------------------------------------------------------------------------

describe("cachedSeoAudit", () => {
  beforeEach(() => {
    resetSeoAuditCache();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const result = () => runSeoAudit(makeInput());

  it("computes once and serves the cache afterwards", async () => {
    const run = vi.fn(async () => result());

    const first = await cachedSeoAudit("t1", run);
    const second = await cachedSeoAudit("t1", run);

    expect(run).toHaveBeenCalledTimes(1);
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.audit.score).toBe(first.audit.score);
  });

  it("keys on the tenant and nothing else", async () => {
    const run = vi.fn(async () => result());
    await cachedSeoAudit("t1", run);
    await cachedSeoAudit("t2", run);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("recomputes past the TTL", async () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => result());

    await cachedSeoAudit("t1", run);
    vi.advanceTimersByTime(SEO_AUDIT_TTL_MS + 1);
    const stale = await cachedSeoAudit("t1", run);

    expect(run).toHaveBeenCalledTimes(2);
    expect(stale.cached).toBe(false);
  });

  it("refresh bypasses a fresh entry", async () => {
    const run = vi.fn(async () => result());
    await cachedSeoAudit("t1", run);
    await cachedSeoAudit("t1", run, { refresh: true });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("concurrent callers for one tenant share a single run", async () => {
    const run = vi.fn(async () => result());
    const [a, b] = await Promise.all([
      cachedSeoAudit("t1", run),
      cachedSeoAudit("t1", run),
    ]);
    expect(run).toHaveBeenCalledTimes(1);
    expect(a.audit.score).toBe(b.audit.score);
  });

  it("does not cache a failure", async () => {
    const run = vi
      .fn(async () => result())
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce(result());

    await expect(cachedSeoAudit("t1", run)).rejects.toThrow("db down");
    const retry = await cachedSeoAudit("t1", run);

    expect(run).toHaveBeenCalledTimes(2);
    expect(retry.cached).toBe(false);
  });

  it("invalidate drops one tenant only", async () => {
    const run = vi.fn(async () => result());
    await cachedSeoAudit("t1", run);
    await cachedSeoAudit("t2", run);
    invalidateSeoAudit("t1");

    await cachedSeoAudit("t1", run);
    await cachedSeoAudit("t2", run);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("hands the client a STRING date, never a Date", async () => {
    const snapshot = await cachedSeoAudit("t1", async () => result());
    expect(typeof snapshot.generatedAt).toBe("string");
    expect(Number.isNaN(Date.parse(snapshot.generatedAt))).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("audit client", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function respond(body: unknown, init: ResponseInit = {}) {
    const fetchMock = vi.fn(
      async (url: string) =>
        new Response(typeof body === "string" ? body : JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json" },
          ...init,
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  async function validSnapshot() {
    return cachedSeoAudit("t-client", async () => runSeoAudit(makeInput()));
  }

  beforeEach(() => {
    resetSeoAuditCache();
  });

  it("parses a real snapshot end to end", async () => {
    const snapshot = await validSnapshot();
    respond(JSON.parse(JSON.stringify(snapshot)));

    const outcome = await fetchSeoAudit();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.snapshot.audit.score).toBe(snapshot.audit.score);
    expect(outcome.snapshot.audit.checks).toHaveLength(
      SEO_AUDIT_CHECKS.length,
    );
  });

  it("asks for a refresh only when told to", async () => {
    const snapshot = await validSnapshot();
    const plain = respond(JSON.parse(JSON.stringify(snapshot)));
    await fetchSeoAudit();
    expect(plain.mock.calls[0][0]).toBe(SEO_AUDIT_API_PATH);

    const refreshed = respond(JSON.parse(JSON.stringify(snapshot)));
    await fetchSeoAudit({ refresh: true });
    expect(refreshed.mock.calls[0][0]).toBe(`${SEO_AUDIT_API_PATH}?refresh=1`);
  });

  it("tells a plan refusal apart from a permission one", async () => {
    respond(
      { error: "This feature is not included in your plan.", code: UPGRADE_REQUIRED_CODE },
      { status: 403 },
    );
    const planned = await fetchSeoAudit();
    expect(planned).toMatchObject({ ok: false, upgradeRequired: true });

    respond({ error: "You do not have permission to do that." }, { status: 403 });
    const denied = await fetchSeoAudit();
    expect(denied).toMatchObject({ ok: false, upgradeRequired: false });
  });

  it("refuses a body it cannot read rather than rendering half a panel", async () => {
    respond("<html>502 Bad Gateway</html>");
    expect(await fetchSeoAudit()).toMatchObject({ ok: false });

    respond({ audit: { score: "eighty", checks: [] } });
    expect(await fetchSeoAudit()).toMatchObject({ ok: false });
  });

  it("survives a network error", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect(await fetchSeoAudit()).toMatchObject({ ok: false, upgradeRequired: false });
  });

  it("drops a check id it has never heard of", () => {
    const snapshot = parseSeoAuditSnapshot({
      audit: {
        score: 80,
        grade: "needs-work",
        checks: [
          { check: "from-the-future", severity: "critical", title: "?", total: 1, findings: [], penalty: 5 },
          { check: "redirect-loop", severity: "critical", title: "Redirect loops", total: 1, findings: [], penalty: 10 },
        ],
        totalFindings: 2,
        severityCounts: { critical: 2, warning: 0, info: 0 },
        stats: {},
      },
      generatedAt: "2026-08-14T00:00:00.000Z",
      cached: true,
      expiresIn: 600,
    });
    expect(snapshot?.audit.checks.map((check) => check.check)).toEqual([
      "redirect-loop",
    ]);
    expect(snapshot?.audit.stats.products).toBe(0);
  });

  it("drops a finding whose deep link is not a tab this page has", () => {
    const snapshot = parseSeoAuditSnapshot({
      audit: {
        score: 90,
        grade: "good",
        checks: [
          {
            check: "title-missing",
            severity: "warning",
            title: "Missing search titles",
            total: 2,
            findings: [
              { check: "title-missing", severity: "warning", message: "a", target: { tab: "billing", label: "x" } },
              { check: "title-missing", severity: "warning", message: "b", target: { tab: "products", entityId: "p1", label: "y" } },
            ],
            penalty: 6,
          },
        ],
        totalFindings: 2,
        severityCounts: { critical: 0, warning: 2, info: 0 },
        stats: {},
      },
      generatedAt: "2026-08-14T00:00:00.000Z",
      cached: false,
      expiresIn: 900,
    });
    expect(snapshot?.audit.checks[0].findings).toHaveLength(1);
    expect(snapshot?.audit.checks[0].findings[0].target.entityId).toBe("p1");
  });
});
