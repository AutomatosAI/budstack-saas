import { describe, it, expect } from "vitest";

/**
 * LLM Visibility US-004 — the LLM-readiness category of the SEO audit.
 *
 * TABLE-DRIVEN OVER FIXTURE ROWS, per the story's acceptance criteria: every
 * check is a pure function over an already-collected snapshot, so a case here is
 * rows in and findings out — no database, no clock, no mocks.
 *
 * The one thing deliberately NOT re-implemented is the exclusion rule behind
 * `inLlmsTxt`: `collectAuditEntities` computes it with `isLlmsTxtExcluded`, the
 * predicate `renderStoreLlmsTxt` filters on, so a store the audit says publishes
 * an empty llms.txt is a store whose llms.txt route publishes an empty file.
 */

import {
  auditAiCrawlerAccess,
  auditHeadingStructure,
  auditLlmsTxtContent,
  auditQaCoverage,
  auditWireVisibility,
} from "@/lib/seo/audit-llm-checks";
import {
  collectAuditEntities,
  type SeoAuditEntity,
  type SeoAuditInput,
} from "@/lib/seo/audit-snapshot";
import {
  runSeoAudit,
  SEO_AUDIT_CHECKS,
  SEO_AUDIT_LLM_CHECK_IDS,
  SEO_AUDIT_WEIGHTS,
  type SeoAuditFinding,
} from "@/lib/seo/audit";
import {
  SEO_AUDIT_HEADING_MIN_BODY_LENGTH,
  SEO_AUDIT_LLM_CHECKS,
  SEO_AUDIT_WIRE_ADMIN_PATH,
} from "@/lib/seo/audit-llm-types";
import { parseSeoAuditSnapshot } from "@/components/admin/seo/audit-client";
import { readHeadingStructure } from "@/lib/seo/heading-structure";
import { LLMS_TXT_PATH } from "@/lib/seo/llms-txt-copy";

const TENANT = { subdomain: "acme", customDomain: null };
const TENANT_ID = "tenant-a";

function input(overrides: Partial<SeoAuditInput> = {}): SeoAuditInput {
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

function entity(overrides: Partial<SeoAuditEntity> = {}): SeoAuditEntity {
  return {
    tab: "products",
    entityId: "p1",
    label: "Blue Dream",
    noun: "product",
    seo: {},
    titleFallback: "the strain name from Dr Green",
    descriptionFallback: "the strain description from Dr Green",
    hasOwnImage: false,
    expectsOwnImage: false,
    path: "/products/strain-1",
    inSitemap: true,
    qaPairs: 1,
    expectsQa: false,
    headings: null,
    inLlmsTxt: true,
    ...overrides,
  };
}

function checkIds(findings: readonly SeoAuditFinding[]): string[] {
  return findings.map((f) => f.check);
}

/** An HTML body of a given visible length, with the headings you ask for. */
function body(headings: string, textLength: number): string {
  return `${headings}<p>${"word ".repeat(Math.ceil(textLength / 5))}</p>`;
}

describe("US-004 (a) — AI search crawler access", () => {
  const cases: ReadonlyArray<[string, unknown, boolean]> = [
    ["open allows everything", "open", false],
    ["search-only keeps the citation crawlers", "search-only", false],
    ["blocked turns the citation crawlers away", "blocked", true],
    ["an absent policy is open", undefined, false],
    ["a malformed policy fails OPEN, never to a false alarm", 42, false],
    ["an unknown string fails open too", "paranoid", false],
  ];

  for (const [name, policy, expected] of cases) {
    it(name, () => {
      const findings = auditAiCrawlerAccess(input({ aiCrawlerPolicy: policy }));
      expect(findings.length > 0).toBe(expected);
    });
  }

  it("is one finding for the store, not one per bot, and names them all", () => {
    const findings = auditAiCrawlerAccess(input({ aiCrawlerPolicy: "blocked" }));
    expect(findings).toHaveLength(1);
    expect(findings[0].check).toBe("ai-search-blocked");
    expect(findings[0].severity).toBe("critical");
    for (const bot of ["OAI-SearchBot", "Claude-SearchBot", "PerplexityBot"]) {
      expect(findings[0].message).toContain(bot);
    }
    // Never a training bot: blocking those is a legitimate choice, not a fault.
    expect(findings[0].message).not.toContain("GPTBot");
    expect(findings[0].message).not.toContain("CCBot");
  });

  it("sends the owner to the tab that holds the policy control", () => {
    const [found] = auditAiCrawlerAccess(input({ aiCrawlerPolicy: "blocked" }));
    expect(found.target.tab).toBe("ai-crawlers");
    expect(found.target.href).toBeUndefined();
  });

  it("is silent on a plan whose robots.txt does not publish the block", () => {
    // A Basic store's stored `blocked` is dormant: the AI section is omitted
    // from robots.txt entirely, so nothing is being turned away.
    expect(
      auditAiCrawlerAccess(
        input({ aiCrawlerPolicy: "blocked", plan: "basic" }),
      ),
    ).toHaveLength(0);
    // Trial and custom hold seo.pro, so the block is live and reported.
    for (const plan of ["trial", "pro", "custom"]) {
      expect(
        auditAiCrawlerAccess(input({ aiCrawlerPolicy: "blocked", plan })),
      ).toHaveLength(1);
    }
  });

  it("is the heaviest check in the audit and outranks every other critical", () => {
    const weights = Object.values(SEO_AUDIT_WEIGHTS).map((w) => w.perFinding);
    expect(SEO_AUDIT_WEIGHTS["ai-search-blocked"].perFinding).toBe(
      Math.max(...weights),
    );
    expect(SEO_AUDIT_CHECKS[0]).toBe("ai-search-blocked");
  });
});

describe("US-004 (b) — Q&A coverage", () => {
  it("reports a product with no pairs and a condition with no pairs", () => {
    const findings = auditQaCoverage([
      entity({ expectsQa: true, qaPairs: 0 }),
      entity({
        tab: "conditions",
        entityId: "c1",
        label: "Anxiety",
        noun: "condition page",
        expectsQa: true,
        qaPairs: 0,
      }),
    ]);

    expect(checkIds(findings)).toEqual(["qa-missing", "qa-missing"]);
    expect(findings[0].target).toMatchObject({ tab: "products", entityId: "p1" });
    expect(findings[1].target).toMatchObject({
      tab: "conditions",
      entityId: "c1",
    });
  });

  const cases: ReadonlyArray<[string, Partial<SeoAuditEntity>, number]> = [
    ["a product with pairs is clean", { expectsQa: true, qaPairs: 3 }, 0],
    ["a product with none is a finding", { expectsQa: true, qaPairs: 0 }, 1],
    ["a post is never asked", { tab: "posts", expectsQa: false, qaPairs: 0 }, 0],
    ["a static page is never asked", { tab: "pages", expectsQa: false }, 0],
  ];

  for (const [name, overrides, expected] of cases) {
    it(name, () => {
      expect(auditQaCoverage([entity(overrides)])).toHaveLength(expected);
    });
  }

  it("costs a point, not the three a missing title costs", () => {
    expect(SEO_AUDIT_WEIGHTS["qa-missing"].perFinding).toBe(1);
    expect(SEO_AUDIT_WEIGHTS["qa-missing"].severity).toBe("info");
    expect(SEO_AUDIT_WEIGHTS["qa-missing"].perFinding).toBeLessThan(
      SEO_AUDIT_WEIGHTS["title-missing"].perFinding,
    );
  });
});

describe("US-004 (c) — llms.txt content", () => {
  it("fires when a store's whole catalogue is kept out of the document", () => {
    const findings = auditLlmsTxtContent([
      entity({ inLlmsTxt: false }),
      entity({ entityId: "p2", tab: "posts", inLlmsTxt: false }),
      // A static page is not listable, so it cannot rescue the count.
      entity({ entityId: "home", tab: "pages", inLlmsTxt: false }),
    ]);

    expect(checkIds(findings)).toEqual(["llms-txt-empty"]);
    expect(findings[0].message).toContain(LLMS_TXT_PATH);
    expect(findings[0].message).toContain("2 products, posts or condition");
    expect(findings[0].target.tab).toBe("ai-crawlers");
  });

  it("is silent when one row still reaches the file", () => {
    expect(
      auditLlmsTxtContent([
        entity({ inLlmsTxt: false }),
        entity({ entityId: "p2", inLlmsTxt: true }),
      ]),
    ).toHaveLength(0);
  });

  it("is silent for a store with nothing to publish yet", () => {
    // Nothing listed because nothing exists is an empty store, not a defect —
    // the sitemap checks own that conversation.
    expect(
      auditLlmsTxtContent([entity({ tab: "pages", inLlmsTxt: false })]),
    ).toHaveLength(0);
  });

  it("reads the same exclusion rule the document itself filters on", () => {
    const rows = {
      products: [
        {
          id: "p1",
          name: "Blue Dream",
          drGreenStrainId: "strain-1",
          images: [],
          updatedAt: new Date("2026-08-01T00:00:00.000Z"),
          seo: { robots: { noindex: true } },
        },
      ],
    };

    // Pro: the noindex is honoured, so the row is out of llms.txt.
    const pro = collectAuditEntities(input({ ...rows, plan: "pro" }), new Set());
    expect(pro.find((e) => e.tab === "products")?.inLlmsTxt).toBe(false);

    // Basic: the stored rule goes dormant, so the row is listed again.
    const basic = collectAuditEntities(
      input({ ...rows, plan: "basic" }),
      new Set(),
    );
    expect(basic.find((e) => e.tab === "products")?.inLlmsTxt).toBe(true);
  });
});

describe("US-004 (d) — Wire content no crawler can reach", () => {
  const cases: ReadonlyArray<[string, number | undefined, number]> = [
    ["no drafts, no finding", 0, 0],
    ["an absent count is no finding", undefined, 0],
    ["one draft is a finding", 1, 1],
    ["forty drafts are still one finding", 40, 1],
  ];

  for (const [name, count, expected] of cases) {
    it(name, () => {
      expect(
        auditWireVisibility(input({ unpublishedPostCount: count })),
      ).toHaveLength(expected);
    });
  }

  it("counts the drafts and links The Wire, not a tab of this panel", () => {
    const [found] = auditWireVisibility(
      input({ unpublishedPostCount: 7, wireMode: "MANUAL" }),
    );
    expect(found.check).toBe("wire-drafts-unpublished");
    expect(found.message).toContain("7 Wire posts are still unpublished");
    expect(found.target.href).toBe(SEO_AUDIT_WIRE_ADMIN_PATH);
    expect(found.target.label).toBe("The Wire");
  });

  it("explains an assisted queue without calling the mode the fault", () => {
    const [assisted] = auditWireVisibility(
      input({ unpublishedPostCount: 3, wireMode: "ASSISTED" }),
    );
    expect(assisted.message).toContain("Automatos");

    const [manual] = auditWireVisibility(
      input({ unpublishedPostCount: 3, wireMode: "MANUAL" }),
    );
    expect(manual.message).not.toContain("Automatos");
    // The finding is the drafts, so the mode never changes whether it fires.
    expect(assisted.check).toBe(manual.check);
  });

  it("reads a singular draft as one post", () => {
    const [found] = auditWireVisibility(input({ unpublishedPostCount: 1 }));
    expect(found.message).toContain("1 Wire post is still unpublished");
  });
});

describe("US-004 (e) — heading structure", () => {
  const parses: ReadonlyArray<[string, unknown, number, number]> = [
    ["no body at all", null, 0, 0],
    ["an empty string", "   ", 0, 0],
    ["a tidy article", "<h2>One</h2><h3>Two</h3><h2>Three</h2>", 3, 0],
    ["a body h1", "<h1>Title again</h1>", 1, 1],
    ["two body h1s", "<h1>A</h1><h1>B</h1>", 2, 2],
    ["attributes on the tag", '<h2 class="x" id="y">One</h2>', 1, 0],
    ["uppercase tags", "<H2>One</H2>", 1, 0],
    ["<hr> is not a heading", "<hr><h2>One</h2>", 1, 0],
  ];

  for (const [name, html, levels, h1s] of parses) {
    it(`parses ${name}`, () => {
      const parsed = readHeadingStructure(html);
      if (levels === 0 && h1s === 0 && typeof html !== "string") {
        expect(parsed).toBeNull();
        return;
      }
      expect(parsed?.levels ?? []).toHaveLength(levels);
      expect(parsed?.h1Count ?? 0).toBe(h1s);
    });
  }

  const skips: ReadonlyArray<[string, string, boolean]> = [
    ["h2 then h3 is fine", "<h2>a</h2><h3>b</h3>", false],
    ["opening at h2 is fine — the page owns the h1", "<h2>a</h2>", false],
    ["opening at h3 skips h2", "<h3>a</h3>", true],
    ["h2 then h4 skips h3", "<h2>a</h2><h4>b</h4>", true],
    ["going back up is not a skip", "<h2>a</h2><h3>b</h3><h2>c</h2>", false],
    ["a body h1 is not a skip", "<h1>a</h1><h2>b</h2>", false],
  ];

  for (const [name, html, expected] of skips) {
    it(name, () => {
      expect(readHeadingStructure(html)?.firstSkip !== null).toBe(expected);
    });
  }

  it("flags a second top-level heading — the case this editor invites", () => {
    const findings = auditHeadingStructure([
      entity({
        tab: "posts",
        label: "Sleep and CBD",
        headings: readHeadingStructure("<h1>Sleep and CBD</h1><p>x</p>"),
      }),
    ]);

    expect(checkIds(findings)).toEqual(["heading-duplicate-h1"]);
    expect(findings[0].severity).toBe("warning");
    expect(findings[0].message).toContain("2 subjects");
    expect(findings[0].target).toMatchObject({ tab: "posts" });
  });

  it("flags a skipped level once, not once per heading", () => {
    const findings = auditHeadingStructure([
      entity({
        tab: "posts",
        headings: readHeadingStructure("<h4>a</h4><h6>b</h6>"),
      }),
    ]);
    expect(checkIds(findings)).toEqual(["heading-level-skip"]);
    expect(findings[0].message).toContain("Heading 1 to Heading 4");
  });

  const lengths: ReadonlyArray<[string, number, number]> = [
    ["a short post needs no subheadings", 200, 0],
    ["just under the floor is clean", SEO_AUDIT_HEADING_MIN_BODY_LENGTH - 50, 0],
    ["a long wall of prose is a finding", SEO_AUDIT_HEADING_MIN_BODY_LENGTH + 500, 1],
  ];

  for (const [name, length, expected] of lengths) {
    it(name, () => {
      const findings = auditHeadingStructure([
        entity({ tab: "posts", headings: readHeadingStructure(body("", length)) }),
      ]);
      expect(findings.filter((f) => f.check === "heading-missing")).toHaveLength(
        expected,
      );
    });
  }

  it("measures visible text, not markup", () => {
    const markup = `<div class="${"x".repeat(3000)}"></div><p>short</p>`;
    expect(readHeadingStructure(markup)!.textLength).toBeLessThan(20);
    expect(auditHeadingStructure([entity({ tab: "posts", headings: readHeadingStructure(markup) })]))
      .toHaveLength(0);
  });

  it("never judges an entity with no authored body", () => {
    expect(
      auditHeadingStructure([
        entity({ tab: "conditions", headings: null }),
        entity({ tab: "pages", headings: null }),
        entity({ tab: "products", headings: null }),
      ]),
    ).toHaveLength(0);
  });

  it("reports both faults when one article has both", () => {
    const findings = auditHeadingStructure([
      entity({
        tab: "posts",
        headings: readHeadingStructure("<h1>a</h1><h3>b</h3>"),
      }),
    ]);
    expect(checkIds(findings).sort()).toEqual([
      "heading-duplicate-h1",
      "heading-level-skip",
    ]);
  });
});

describe("US-004 — the category inside the whole audit", () => {
  it("declares every LLM check in the one scored list", () => {
    for (const check of SEO_AUDIT_LLM_CHECKS) {
      expect(SEO_AUDIT_CHECKS).toContain(check);
      expect(SEO_AUDIT_WEIGHTS[check]).toBeDefined();
    }
    expect(SEO_AUDIT_LLM_CHECK_IDS).toHaveLength(SEO_AUDIT_LLM_CHECKS.length);
  });

  it("runs end to end over rows and scores what it finds", () => {
    const result = runSeoAudit(
      input({
        aiCrawlerPolicy: "blocked",
        wireMode: "ASSISTED",
        unpublishedPostCount: 4,
        posts: [
          {
            id: "post-1",
            title: "Sleep and CBD",
            slug: "sleep-and-cbd",
            excerpt: "About sleep.",
            coverImage: null,
            seo: null,
            updatedAt: new Date("2026-08-01T00:00:00.000Z"),
            content: "<h1>Sleep and CBD</h1><p>Body copy.</p>",
          },
        ],
        conditions: [
          {
            id: "c1",
            name: "Anxiety",
            slug: "anxiety",
            description: "A guide.",
            image: null,
            seo: null,
            updatedAt: new Date("2026-08-01T00:00:00.000Z"),
            faqs: [],
          },
        ],
      }),
    );

    const found = result.checks.filter((c) => c.total > 0).map((c) => c.check);
    expect(found).toContain("ai-search-blocked");
    expect(found).toContain("wire-drafts-unpublished");
    expect(found).toContain("heading-duplicate-h1");
    expect(found).toContain("qa-missing");
    // The blocked-crawler finding sorts above every other critical.
    expect(result.checks[0].check).toBe("ai-search-blocked");
    expect(result.score).toBeLessThan(100);
  });

  it("leaves a clean store's LLM checks reporting zero", () => {
    const result = runSeoAudit(
      input({
        aiCrawlerPolicy: "search-only",
        unpublishedPostCount: 0,
        conditions: [
          {
            id: "c1",
            name: "Anxiety",
            slug: "anxiety",
            description: "A guide.",
            image: null,
            seo: null,
            updatedAt: new Date("2026-08-01T00:00:00.000Z"),
            faqs: [{ question: "Does it help?", answer: "For some people." }],
          },
        ],
      }),
    );

    for (const check of SEO_AUDIT_LLM_CHECKS) {
      const group = result.checks.find((c) => c.check === check);
      expect(group?.total, `${check} should be clean`).toBe(0);
    }
  });
});

/**
 * The `href` a finding may carry to an admin page outside the SEO Manager. It
 * is rendered straight into a link, so the browser-side parser keeps only a
 * path inside this admin — the finding degrades to its tab rather than becoming
 * an off-site link inside the panel.
 */
describe("US-004 — the deep link that leaves the panel", () => {
  const cases: ReadonlyArray<[string, unknown, string | undefined]> = [
    ["an admin path survives", SEO_AUDIT_WIRE_ADMIN_PATH, SEO_AUDIT_WIRE_ADMIN_PATH],
    ["a protocol-relative URL is dropped", "//evil.example/x", undefined],
    ["an absolute URL is dropped", "https://evil.example/x", undefined],
    ["a relative path is dropped", "the-wire", undefined],
    ["a javascript: URL is dropped", "javascript:alert(1)", undefined],
    ["a non-string is dropped", { path: "/x" }, undefined],
    ["an absent href stays absent", undefined, undefined],
  ];

  for (const [name, href, expected] of cases) {
    it(name, () => {
      const snapshot = parseSeoAuditSnapshot({
        audit: {
          score: 90,
          grade: "good",
          checks: [
            {
              check: "wire-drafts-unpublished",
              severity: "warning",
              title: "Wire drafts nobody can read",
              total: 1,
              findings: [
                {
                  check: "wire-drafts-unpublished",
                  severity: "warning",
                  message: "a",
                  target: { tab: "posts", label: "The Wire", href },
                },
              ],
              penalty: 4,
            },
          ],
          totalFindings: 1,
          severityCounts: { critical: 0, warning: 1, info: 0 },
          stats: {},
        },
        generatedAt: "2026-08-14T00:00:00.000Z",
        cached: false,
        expiresIn: 900,
      });

      const found = snapshot?.audit.checks[0].findings[0];
      expect(found?.target.href).toBe(expected);
      // The finding itself always survives — only the destination is refused.
      expect(found?.target.tab).toBe("posts");
    });
  }
});
