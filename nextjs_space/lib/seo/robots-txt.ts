/**
 * LLM Visibility US-001 — the store's robots.txt body.
 *
 * Lifted out of `app/store/[slug]/robots.txt/route.ts` unchanged so the file a
 * Basic tenant publishes stays BYTE-IDENTICAL to what it published before this
 * story, and so that property is assertable in a unit test rather than trusted.
 * The route keeps the tenant resolution, the plan read and the caching headers;
 * everything that ends up in the response text is here.
 *
 * THE ONE RULE THAT SHAPES THIS FILE: a crawler that matches its own
 * `User-agent` group uses THAT group and ignores the `*` group entirely
 * (RFC 9309 §2.2.1). So:
 *
 *  - a BLOCKED bot gets its own group with `Disallow: /`, which is complete on
 *    its own — the admin paths in the wildcard group need no repeating;
 *  - an ALLOWED bot gets NO group at all. Publishing `User-agent: GPTBot` /
 *    `Allow: /` to "be explicit" would take GPTBot out of the wildcard group and
 *    hand it `/api/`, `/tenant-admin/` and `/auth/` — the opposite of what the
 *    author of that line intended. Hence `open` renders comments and nothing
 *    functional.
 *
 * Pure module — string in, string out.
 */

import {
  AI_CRAWLER_CLASS_COPY,
  aiCrawlersInClass,
  blockedAiCrawlerClasses,
  type AiCrawlerClass,
  type AiCrawlerPolicy,
} from "@/lib/seo/ai-crawlers";

export interface StoreRobotsSource {
  /** What the file names itself after — the custom domain, else the subdomain. */
  readonly host: string;
  /** Primary origin for the `Sitemap:` line (custom domain aware). */
  readonly baseUrl: string;
  /**
   * The store's policy, or NULL when the tenant does not hold `seo.pro`. Null
   * omits the whole AI section: a Basic tenant's stored policy stays stored and
   * stops rendering, per the storefront-degrades contract in
   * `lib/entitlements/require-feature.ts`. The storefront never blocks on plan.
   */
  readonly aiCrawlerPolicy: AiCrawlerPolicy | null;
}

/** Paths no crawler should spend budget on. Unchanged wording and order. */
function baseRobotsTxt(host: string, baseUrl: string): string {
  return `# Robots.txt for ${host}
# Generated dynamically by BudStacks

User-agent: *
Allow: /

# Disallow admin and API paths
Disallow: /api/
Disallow: /tenant-admin/
Disallow: /super-admin/
Disallow: /auth/

# Sitemap location
Sitemap: ${baseUrl}/sitemap.xml
`;
}

function classLabel(crawlerClass: AiCrawlerClass): string {
  return (
    AI_CRAWLER_CLASS_COPY.find((copy) => copy.crawlerClass === crawlerClass)
      ?.label ?? crawlerClass
  );
}

/**
 * One group per blocked class: every user-agent in the class, then a single
 * `Disallow: /`. Multiple `User-agent` lines sharing one rule block is the
 * documented grouping form (RFC 9309 §2.2.1) and keeps the file readable by the
 * owner who chose the policy.
 */
function blockedClassGroup(crawlerClass: AiCrawlerClass): string {
  const agents = aiCrawlersInClass(crawlerClass)
    .map((crawler) => `User-agent: ${crawler.userAgent}`)
    .join("\n");

  return `# ${classLabel(crawlerClass)} — asked not to crawl this store.
${agents}
Disallow: /
`;
}

/**
 * The AI section, appended after the base file. Appended rather than woven in so
 * the base string above is provably untouched; `Sitemap:` is a group-independent
 * directive, so its position relative to these groups does not matter.
 */
function aiCrawlerSection(policy: AiCrawlerPolicy): string {
  const blocked = blockedAiCrawlerClasses(policy);

  if (blocked.length === 0) {
    return `
# AI crawler policy: open — every AI search and AI training crawler is welcome.
# No per-bot group is published on purpose: a bot with a group of its own stops
# obeying the Disallow rules above.
`;
  }

  return `
# AI crawler policy: ${policy}
${blocked.map(blockedClassGroup).join("\n")}`;
}

/** The complete robots.txt body for a store, trailing newline included. */
export function renderStoreRobotsTxt(source: StoreRobotsSource): string {
  const base = baseRobotsTxt(source.host, source.baseUrl);
  if (source.aiCrawlerPolicy === null) return base;
  return base + aiCrawlerSection(source.aiCrawlerPolicy);
}
