import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * LLM Visibility US-001 — the AI crawler policy.
 *
 * The properties this file exists to hold:
 *
 *  1. A BASIC TENANT'S robots.txt IS BYTE-IDENTICAL to the pre-story file. The
 *     expected text below is frozen as a literal, not derived from the renderer,
 *     so a change to the shared builder cannot quietly move it.
 *  2. AN ALLOWED BOT NEVER GETS A GROUP OF ITS OWN. A crawler that matches its
 *     own `User-agent` group ignores the `*` group entirely, so publishing
 *     `User-agent: OAI-SearchBot` / `Allow: /` would hand that bot `/api/` and
 *     `/tenant-admin/`. 'open' therefore renders comments and nothing else.
 *  3. THE TWO CLASSES ARE NOT INTERCHANGEABLE — 'search-only' blocks every
 *     training token and no search token, which is the entire point of the
 *     feature.
 *  4. FAIL-CLOSED ON PLAN, FAIL-OPEN ON POLICY. An unreadable plan degrades to
 *     Basic (no policy rendered); an unreadable policy resolves to 'open'.
 *     Neither may be read as "this store asked to be hidden".
 *  5. GATING IN THE UI IS NOT GATING — a Basic tenant PUTting by hand gets 403
 *     `upgrade_required` and writes nothing.
 *
 * Module-boundary mocks only (getCurrentUser, prisma, tenant + permission
 * resolution). The real route, the real permission wrapper, the real plan gate
 * and the real renderer all execute.
 */
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { getCurrentTenant } = vi.hoisted(() => ({ getCurrentTenant: vi.fn() }));
const { resolveUserPermissions } = vi.hoisted(() => ({
  resolveUserPermissions: vi.fn(),
}));
const prismaMock = vi.hoisted(() => ({
  tenants: { findFirst: vi.fn(), update: vi.fn() },
  audit_logs: { create: vi.fn() },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/tenant/tenant", () => ({ getCurrentTenant }));
vi.mock("@/lib/permissions/current-user-permissions", () => ({
  resolveUserPermissions,
}));

import { AUDIT_ACTIONS } from "@/lib/audit-log";
import { PLANS } from "@/lib/entitlements/plan";
import { UPGRADE_REQUIRED_CODE } from "@/lib/entitlements/require-feature";
import {
  AI_CRAWLERS,
  AI_CRAWLER_CLASS_COPY,
  AI_CRAWLER_POLICIES,
  AI_CRAWLER_POLICY_MAX_LENGTH,
  AI_CRAWLER_POLICY_NOTE,
  AI_CRAWLER_POLICY_OPTIONS,
  DEFAULT_AI_CRAWLER_POLICY,
  aiCrawlersInClass,
  blockedAiCrawlerClasses,
  blockedAiCrawlers,
  isAiCrawlerClassBlocked,
  isAiCrawlerPolicy,
  parseAiCrawlerPolicy,
  type AiCrawlerPolicy,
} from "@/lib/seo/ai-crawlers";
import { renderStoreRobotsTxt } from "@/lib/seo/robots-txt";
import { tenantSettingsLenientSchema } from "@/lib/validation/tenant-settings";
import { parseTenantSettings } from "@/lib/tenant/tenant-settings";
import { GET as storeRobots } from "@/app/store/[slug]/robots.txt/route";
import { PUT as saveAiCrawlers } from "@/app/api/tenant-admin/seo/ai-crawlers/route";

const TENANT_A = "tenant-a";
const SUBDOMAIN = "acme";

/**
 * The EXACT file the store published before this story. Frozen as a literal on
 * purpose: deriving it from the renderer would make this assertion tautological.
 */
const LEGACY_ROBOTS_TXT = `# Robots.txt for ${SUBDOMAIN}
# Generated dynamically by BudStacks

User-agent: *
Allow: /

# Disallow admin and API paths
Disallow: /api/
Disallow: /tenant-admin/
Disallow: /super-admin/
Disallow: /auth/

# Sitemap location
Sitemap: https://${SUBDOMAIN}.budstacks.io/sitemap.xml
`;

function storeTenant(overrides: Record<string, unknown> = {}) {
  return {
    id: TENANT_A,
    subdomain: SUBDOMAIN,
    customDomain: null,
    isActive: true,
    plan: "pro",
    settings: {},
    ...overrides,
  };
}

/** The store's published robots.txt for a given plan + stored settings value. */
async function robotsFor(
  plan: unknown,
  aiCrawlerPolicy?: unknown,
  extra: Record<string, unknown> = {},
): Promise<string> {
  getCurrentTenant.mockResolvedValue(
    storeTenant({
      plan,
      settings:
        aiCrawlerPolicy === undefined ? {} : { aiCrawlerPolicy },
      ...extra,
    }),
  );
  return (await storeRobots()).text();
}

/** Every `User-agent:` token the file names, in order. */
function userAgents(robotsTxt: string): string[] {
  return [...robotsTxt.matchAll(/^User-agent:\s*(.+)$/gm)].map((m) =>
    m[1].trim(),
  );
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
  return new NextRequest("http://localhost/api/tenant-admin/seo/ai-crawlers", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** The row `getTenantPlan` and the settings read both see on the admin route. */
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

describe("the bot registry", () => {
  it("carries the search class the PRD names, and only search bots in it", () => {
    expect(aiCrawlersInClass("search").map((c) => c.userAgent)).toEqual([
      "OAI-SearchBot",
      "Claude-SearchBot",
      "PerplexityBot",
    ]);
  });

  it("carries the training class the PRD names", () => {
    expect(aiCrawlersInClass("training").map((c) => c.userAgent)).toEqual([
      "GPTBot",
      "ClaudeBot",
      "anthropic-ai",
      "Google-Extended",
      "CCBot",
      "meta-externalagent",
    ]);
  });

  it("keeps every token unique, trimmed and free of robots.txt separators", () => {
    const tokens = AI_CRAWLERS.map((c) => c.userAgent);
    expect(new Set(tokens).size).toBe(tokens.length);
    for (const token of tokens) {
      expect(token).toBe(token.trim());
      // A `:` or newline inside a token would forge a directive line.
      expect(token).not.toMatch(/[:\r\n]/);
      expect(token.length).toBeGreaterThan(0);
    }
  });

  it("pairs the two provider families that prove the split is real", () => {
    // The load-bearing 2026 fact: blocking GPTBot does NOT remove a store from
    // ChatGPT's answers, because that is a different bot.
    const byToken = new Map(AI_CRAWLERS.map((c) => [c.userAgent, c]));
    expect(byToken.get("GPTBot")?.crawlerClass).toBe("training");
    expect(byToken.get("OAI-SearchBot")?.crawlerClass).toBe("search");
    expect(byToken.get("ClaudeBot")?.crawlerClass).toBe("training");
    expect(byToken.get("Claude-SearchBot")?.crawlerClass).toBe("search");
  });

  it("gives every bot an owner and a purpose for the settings list", () => {
    for (const crawler of AI_CRAWLERS) {
      expect(crawler.owner.trim()).not.toBe("");
      expect(crawler.purpose.trim()).not.toBe("");
    }
  });
});

describe("policy parsing", () => {
  it("accepts exactly the three values", () => {
    for (const policy of AI_CRAWLER_POLICIES) {
      expect(isAiCrawlerPolicy(policy)).toBe(true);
      expect(parseAiCrawlerPolicy(policy)).toBe(policy);
    }
  });

  it("fails OPEN — an unreadable value is never read as 'hide me'", () => {
    const junk = [
      undefined,
      null,
      "",
      "OPEN",
      " open",
      "search_only",
      "none",
      42,
      {},
      [],
      true,
    ];
    for (const value of junk) {
      expect(isAiCrawlerPolicy(value)).toBe(false);
      expect(parseAiCrawlerPolicy(value)).toBe(DEFAULT_AI_CRAWLER_POLICY);
    }
    expect(DEFAULT_AI_CRAWLER_POLICY).toBe("open");
  });

  it("bounds every policy value inside the settings-schema length cap", () => {
    for (const policy of AI_CRAWLER_POLICIES) {
      expect(policy.length).toBeLessThanOrEqual(AI_CRAWLER_POLICY_MAX_LENGTH);
    }
  });
});

describe("which classes each policy refuses", () => {
  it("maps the three policies onto the two classes", () => {
    expect(blockedAiCrawlerClasses("open")).toEqual([]);
    expect(blockedAiCrawlerClasses("search-only")).toEqual(["training"]);
    expect(blockedAiCrawlerClasses("blocked")).toEqual(["search", "training"]);
  });

  it("agrees with the per-class predicate the UI renders from", () => {
    for (const policy of AI_CRAWLER_POLICIES) {
      for (const crawlerClass of ["search", "training"] as const) {
        expect(isAiCrawlerClassBlocked(policy, crawlerClass)).toBe(
          blockedAiCrawlerClasses(policy).includes(crawlerClass),
        );
      }
    }
  });

  it("refuses no bot under 'open' and every bot under 'blocked'", () => {
    expect(blockedAiCrawlers("open")).toEqual([]);
    expect(blockedAiCrawlers("blocked").length).toBe(AI_CRAWLERS.length);
    expect(blockedAiCrawlers("search-only").length).toBe(
      aiCrawlersInClass("training").length,
    );
  });
});

describe("store robots.txt — the plan x policy matrix", () => {
  it("renders the pre-US-001 file byte-for-byte for a Basic tenant", async () => {
    // Even one that stored 'blocked' while on Pro and then downgraded: the
    // setting stays in the column, dormant.
    expect(await robotsFor("basic", "blocked")).toBe(LEGACY_ROBOTS_TXT);
  });

  it("treats an unreadable plan as Basic, so a DB blip cannot leak Pro output", async () => {
    for (const plan of [undefined, null, "PRO", "enterprise", 7]) {
      expect(await robotsFor(plan, "blocked")).toBe(LEGACY_ROBOTS_TXT);
    }
  });

  it("keeps the whole legacy file intact for a Pro tenant and appends to it", async () => {
    for (const plan of PLANS.filter((p) => p !== "basic")) {
      const txt = await robotsFor(plan, "open");
      expect(txt.startsWith(LEGACY_ROBOTS_TXT)).toBe(true);
    }
  });

  it("publishes NO per-bot group under 'open' — an allowed bot must stay in the wildcard group", async () => {
    const txt = await robotsFor("pro", "open");

    // The whole point: a group of its own would exempt the bot from the
    // Disallow rules the wildcard group carries.
    expect(userAgents(txt)).toEqual(["*"]);
    for (const crawler of AI_CRAWLERS) {
      expect(txt).not.toContain(`User-agent: ${crawler.userAgent}`);
    }
    expect(txt).toContain("# AI crawler policy: open");
  });

  it("refuses every training bot and no search bot under 'search-only'", async () => {
    const txt = await robotsFor("pro", "search-only");
    const agents = userAgents(txt);

    for (const crawler of aiCrawlersInClass("training")) {
      expect(agents).toContain(crawler.userAgent);
    }
    for (const crawler of aiCrawlersInClass("search")) {
      expect(agents).not.toContain(crawler.userAgent);
    }
    expect(txt).toContain("# AI crawler policy: search-only");
  });

  it("refuses every bot under 'blocked', in two labelled groups", async () => {
    const txt = await robotsFor("pro", "blocked");
    const agents = userAgents(txt);

    for (const crawler of AI_CRAWLERS) {
      expect(agents).toContain(crawler.userAgent);
    }
    // One `Disallow: /` per class, and `Disallow: /` alone is complete — the
    // admin paths need no repeating inside a fully-refused group.
    expect(txt.match(/^Disallow: \/$/gm)?.length).toBe(2);
    for (const copy of AI_CRAWLER_CLASS_COPY) {
      expect(txt).toContain(`# ${copy.label}`);
    }
  });

  it("falls back to 'open' when a Pro tenant's stored policy is unreadable", async () => {
    for (const stored of [undefined, null, "", "blocked ", "ALL", 3]) {
      const txt = await robotsFor("pro", stored);
      expect(userAgents(txt)).toEqual(["*"]);
      expect(txt).toContain("# AI crawler policy: open");
    }
  });

  it("names the custom domain and its sitemap when one is configured", async () => {
    const txt = await robotsFor("pro", "blocked", {
      customDomain: "shop.acme.example",
    });
    expect(txt).toContain("# Robots.txt for shop.acme.example");
    expect(txt).toContain("Sitemap: https://shop.acme.example/sitemap.xml");
  });

  it("404s for an unresolved or inactive tenant", async () => {
    getCurrentTenant.mockResolvedValue(null);
    expect((await storeRobots()).status).toBe(404);

    getCurrentTenant.mockResolvedValue(storeTenant({ isActive: false }));
    expect((await storeRobots()).status).toBe(404);
  });
});

describe("the renderer, directly", () => {
  it("emits nothing AI-related when no policy applies", () => {
    const txt = renderStoreRobotsTxt({
      host: SUBDOMAIN,
      baseUrl: `https://${SUBDOMAIN}.budstacks.io`,
      aiCrawlerPolicy: null,
    });
    expect(txt).toBe(LEGACY_ROBOTS_TXT);
    expect(txt).not.toContain("AI crawler policy");
  });

  it("ends every rendering with a newline, as a robots.txt file must", () => {
    for (const policy of [null, ...AI_CRAWLER_POLICIES] as Array<
      AiCrawlerPolicy | null
    >) {
      const txt = renderStoreRobotsTxt({
        host: SUBDOMAIN,
        baseUrl: `https://${SUBDOMAIN}.budstacks.io`,
        aiCrawlerPolicy: policy,
      });
      expect(txt.endsWith("\n")).toBe(true);
    }
  });
});

describe("the stored settings key", () => {
  it("round-trips through the shared settings schema", () => {
    for (const policy of AI_CRAWLER_POLICIES) {
      const parsed = tenantSettingsLenientSchema.safeParse({
        aiCrawlerPolicy: policy,
      });
      expect(parsed.success).toBe(true);
    }
  });

  it("does not take the rest of the blob down when the value is out of enum", () => {
    // The reason the schema bounds LENGTH and not the enum: `parseTenantSettings`
    // fails as a unit, and a store's tagline must not disappear because someone
    // hand-edited this key.
    const settings = parseTenantSettings({
      businessName: "Acme Cannabis Co",
      aiCrawlerPolicy: "nonsense",
    });
    expect(settings.businessName).toBe("Acme Cannabis Co");
    expect(parseAiCrawlerPolicy(settings.aiCrawlerPolicy)).toBe("open");
  });
});

describe("PUT /api/tenant-admin/seo/ai-crawlers — the two gates", () => {
  it("saves for an entitled member and answers with what was stored", async () => {
    const response = await saveAiCrawlers(
      put({ aiCrawlerPolicy: "search-only" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ aiCrawlerPolicy: "search-only" });
  });

  it("refuses a Basic tenant with upgrade_required, and writes nothing", async () => {
    onPlan("basic");
    const response = await saveAiCrawlers(put({ aiCrawlerPolicy: "blocked" }));

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe(UPGRADE_REQUIRED_CODE);
    expect(prismaMock.tenants.update).not.toHaveBeenCalled();
  });

  it("refuses a member without canEditSeo before the plan is ever looked up", async () => {
    resolveUserPermissions.mockResolvedValue({
      permissions: { canViewSeo: true, canEditSeo: false },
      teamRole: "STAFF",
    });
    const response = await saveAiCrawlers(put({ aiCrawlerPolicy: "blocked" }));

    expect(response.status).toBe(403);
    expect(prismaMock.tenants.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.tenants.update).not.toHaveBeenCalled();
  });

  it("refuses a value outside the enum, and any extra key", async () => {
    for (const body of [
      { aiCrawlerPolicy: "OPEN" },
      { aiCrawlerPolicy: "" },
      { aiCrawlerPolicy: null },
      {},
      { aiCrawlerPolicy: "open", allowGoogle: false },
    ]) {
      const response = await saveAiCrawlers(put(body));
      expect(response.status).toBe(400);
    }
    expect(prismaMock.tenants.update).not.toHaveBeenCalled();
  });

  it("merges into the settings blob without dropping keys it has never heard of", async () => {
    onPlan("pro", {
      businessName: "Acme Cannabis Co",
      smtp: { host: "smtp.example.dev" },
      aKeyThisVersionHasNeverHeardOf: { nested: true },
    });

    await saveAiCrawlers(put({ aiCrawlerPolicy: "blocked" }));

    const written = prismaMock.tenants.update.mock.calls[0][0].data.settings;
    expect(written).toEqual({
      businessName: "Acme Cannabis Co",
      smtp: { host: "smtp.example.dev" },
      aKeyThisVersionHasNeverHeardOf: { nested: true },
      aiCrawlerPolicy: "blocked",
    });
  });

  it("records the transition in the audit log", async () => {
    onPlan("pro", { aiCrawlerPolicy: "search-only" });
    await saveAiCrawlers(put({ aiCrawlerPolicy: "blocked" }));

    expect(prismaMock.audit_logs.create).toHaveBeenCalledTimes(1);
    const row = prismaMock.audit_logs.create.mock.calls[0][0].data;
    expect(row.action).toBe(AUDIT_ACTIONS.SEO_AI_CRAWLERS_UPDATED);
    expect(row.tenantId).toBe(TENANT_A);
    expect(row.metadata).toEqual({ from: "search-only", to: "blocked" });
  });

  it("reports the previous value as 'open' when the store never set one", async () => {
    onPlan("pro", { businessName: "Acme Cannabis Co" });
    await saveAiCrawlers(put({ aiCrawlerPolicy: "search-only" }));

    const row = prismaMock.audit_logs.create.mock.calls[0][0].data;
    expect(row.metadata).toEqual({ from: "open", to: "search-only" });
  });

  it("404s a tenant row that is gone, without writing", async () => {
    prismaMock.tenants.findFirst
      .mockResolvedValueOnce({ id: TENANT_A, plan: "pro" }) // the plan gate's read
      .mockResolvedValueOnce(null); // the settings read

    const response = await saveAiCrawlers(put({ aiCrawlerPolicy: "blocked" }));
    expect(response.status).toBe(404);
    expect(prismaMock.tenants.update).not.toHaveBeenCalled();
  });
});

describe("the copy, which is the feature", () => {
  it("states what each class COSTS, not only what it gives", () => {
    expect(AI_CRAWLER_CLASS_COPY.map((c) => c.crawlerClass)).toEqual([
      "search",
      "training",
    ]);
    for (const copy of AI_CRAWLER_CLASS_COPY) {
      expect(copy.benefit.trim()).not.toBe("");
      expect(copy.cost.trim()).not.toBe("");
      expect(copy.cost.toLowerCase()).toContain("block");
    }
  });

  it("tells an owner that blocking search removes them from AI answers", () => {
    const search = AI_CRAWLER_CLASS_COPY.find(
      (c) => c.crawlerClass === "search",
    );
    expect(search?.cost.toLowerCase()).toContain("absent from ai answers");
  });

  it("tells an owner that blocking training does NOT do that", () => {
    const training = AI_CRAWLER_CLASS_COPY.find(
      (c) => c.crawlerClass === "training",
    );
    expect(training?.cost.toLowerCase()).toContain(
      "does not remove you from ai answers",
    );
  });

  it("offers one option per policy, and never promises a citation", () => {
    expect(AI_CRAWLER_POLICY_OPTIONS.map((o) => o.value)).toEqual([
      ...AI_CRAWLER_POLICIES,
    ]);
    for (const option of AI_CRAWLER_POLICY_OPTIONS) {
      expect(option.label.trim()).not.toBe("");
      expect(option.summary.trim()).not.toBe("");
      // Honesty is an acceptance criterion for this run: allowing a crawler is
      // a precondition for being cited, never a guarantee of it.
      expect(option.summary.toLowerCase()).not.toMatch(
        /will be cited|guarantee|rank higher|boost/,
      );
    }
  });

  it("says plainly that robots.txt is a request, not enforcement", () => {
    expect(AI_CRAWLER_POLICY_NOTE.toLowerCase()).toContain("not a lock");
    expect(AI_CRAWLER_POLICY_NOTE.toLowerCase()).toContain("ignores it");
  });
});
