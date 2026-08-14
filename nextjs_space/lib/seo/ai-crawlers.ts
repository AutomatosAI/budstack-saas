/**
 * LLM Visibility US-001 — the AI crawler registry and the store's policy over it.
 *
 * THE FACT THIS MODULE EXISTS TO ENCODE: search and training are SEPARATE bots
 * per provider, and they are not interchangeable. Blocking `GPTBot` does not
 * remove a store from ChatGPT's answers — `OAI-SearchBot` does. Blocking
 * `ClaudeBot` does not remove it from Claude's web search — `Claude-SearchBot`
 * does. An owner who blocks "the AI bots" without that distinction usually
 * deletes their own visibility while believing they protected their content, so
 * the registry carries the class on every row and the policy is expressed in
 * those terms rather than as a per-bot checklist.
 *
 * ONE SOURCE, TWO CONSUMERS: `lib/seo/robots-txt.ts` renders these rows into
 * the store's robots.txt, and the LLM-readiness audit (US-004) reads the same
 * rows to tell an owner which search crawlers their own policy is turning away.
 * Neither keeps its own list.
 *
 * ROBOTS.TXT IS A REQUEST, NOT A LOCK. Every operator below publishes that it
 * honours robots.txt; a crawler that ignores it is not stopped by anything here.
 * The UI copy says so — see {@link AI_CRAWLER_POLICY_NOTE}.
 *
 * Pure module: no I/O, no next/server, no prisma. It is imported by a client
 * component and by `generateMetadata`-adjacent render paths.
 *
 * SOURCES for the tokens below, all checked 2026-08-14:
 *  - OpenAI:      developers.openai.com/api/docs/bots
 *  - Anthropic:   privacy.claude.com article 8896518
 *  - Perplexity:  docs.perplexity.ai/guides/bots
 *  - Cloudflare's AI Crawl Control bot reference (cross-check of all of them)
 *
 * NO xAI ROW SHIPS, deliberately. xAI publishes no crawler user-agent token:
 * x.ai's own robots.txt names other operators' bots and not its own, and
 * Cloudflare's bot reference lists no xAI crawler. Third-party directories
 * disagree with each other about whether it is `GrokBot`, `xAI-Grok` or
 * `xAI-Crawler`. Emitting a guessed token would tell an owner they had blocked
 * something they had not, which is the one failure this feature cannot have.
 * Adding the row is a one-line change the day xAI documents it.
 */

/** What a store publishes to the AI crawlers. */
export const AI_CRAWLER_POLICIES = ["open", "search-only", "blocked"] as const;

export type AiCrawlerPolicy = (typeof AI_CRAWLER_POLICIES)[number];

/**
 * Maximum visibility, and the value a store that has never opened this screen
 * gets. Absent settings, an unrecognised value and a plan downgrade all resolve
 * here: the default must never be the one that quietly deletes a store from AI
 * answers.
 */
export const DEFAULT_AI_CRAWLER_POLICY: AiCrawlerPolicy = "open";

/**
 * Length bound for the `tenants.settings.aiCrawlerPolicy` key. The exact enum is
 * enforced by the write route on the way in and re-applied by
 * {@link parseAiCrawlerPolicy} on the way out — the same split as the
 * verification tokens, and for the same reason: the shared settings schema fails
 * as a unit, so one out-of-enum value must not take the tenant's whole blob down.
 */
export const AI_CRAWLER_POLICY_MAX_LENGTH = 16;

const KNOWN_POLICIES: ReadonlySet<string> = new Set(AI_CRAWLER_POLICIES);

/** Type guard for the write route, which refuses anything else. */
export function isAiCrawlerPolicy(value: unknown): value is AiCrawlerPolicy {
  return typeof value === "string" && KNOWN_POLICIES.has(value);
}

/**
 * Parse a stored policy value. Fails to {@link DEFAULT_AI_CRAWLER_POLICY} —
 * "open" — on every unhappy path, which is the opposite direction from the plan
 * parser and is correct here: a settings blob we cannot read must not be
 * interpreted as "this store asked to be hidden".
 */
export function parseAiCrawlerPolicy(value: unknown): AiCrawlerPolicy {
  return isAiCrawlerPolicy(value) ? value : DEFAULT_AI_CRAWLER_POLICY;
}

/**
 * `search` fetches pages to answer a question a person is asking right now, and
 * is what produces a citation. `training` collects pages for a future model and
 * produces nothing today.
 */
export type AiCrawlerClass = "search" | "training";

export interface AiCrawler {
  /** The robots.txt `User-agent` token, exactly as the operator publishes it. */
  readonly userAgent: string;
  readonly crawlerClass: AiCrawlerClass;
  /** The company, for the UI list. */
  readonly owner: string;
  /** One line an owner can act on — what this bot does with the pages it takes. */
  readonly purpose: string;
}

export const AI_CRAWLERS: readonly AiCrawler[] = [
  {
    userAgent: "OAI-SearchBot",
    crawlerClass: "search",
    owner: "OpenAI",
    purpose:
      "Indexes pages so they can be surfaced and linked in ChatGPT's search answers.",
  },
  {
    userAgent: "Claude-SearchBot",
    crawlerClass: "search",
    owner: "Anthropic",
    purpose: "Indexes pages to be found and cited by Claude's web search.",
  },
  {
    userAgent: "PerplexityBot",
    crawlerClass: "search",
    owner: "Perplexity",
    purpose:
      "Indexes pages to be surfaced and linked in Perplexity answers. Perplexity states it is not used to train models.",
  },
  {
    userAgent: "GPTBot",
    crawlerClass: "training",
    owner: "OpenAI",
    purpose: "Collects pages that may be used to train OpenAI's models.",
  },
  {
    userAgent: "ClaudeBot",
    crawlerClass: "training",
    owner: "Anthropic",
    purpose: "Collects pages that may be used to train Anthropic's models.",
  },
  {
    // Anthropic's current documentation names ClaudeBot, Claude-User and
    // Claude-SearchBot only. `anthropic-ai` is the older token and is kept
    // because it costs one line and is still carried by most published
    // robots.txt files — dropping it would silently narrow an existing block.
    userAgent: "anthropic-ai",
    crawlerClass: "training",
    owner: "Anthropic (legacy token)",
    purpose:
      "Anthropic's earlier crawler name, kept so an existing block is not silently narrowed.",
  },
  {
    userAgent: "Google-Extended",
    crawlerClass: "training",
    owner: "Google",
    purpose:
      "Controls whether Google may use pages it has already crawled for Gemini and Vertex AI. Blocking it does not affect Google Search or Googlebot.",
  },
  {
    userAgent: "CCBot",
    crawlerClass: "training",
    owner: "Common Crawl",
    purpose:
      "Builds the public Common Crawl archive, which many model builders train on.",
  },
  {
    userAgent: "meta-externalagent",
    crawlerClass: "training",
    owner: "Meta",
    purpose: "Collects pages that may be used to train Meta's models.",
  },
] as const;

/**
 * User-triggered fetchers (`ChatGPT-User`, `Claude-User`, `Perplexity-User`) are
 * a third class and are deliberately absent. They fetch one page because a
 * person pasted a link or asked about it, and several operators publish that
 * they do not apply robots.txt to those requests — listing them under a policy
 * switch would offer control this file does not have.
 */
export const AI_CRAWLER_USER_TRIGGERED_NOTE =
  "Bots that fetch a single page because a person asked about it (ChatGPT-User, Claude-User, Perplexity-User) are not covered: their operators publish that robots.txt does not apply to a request a person made directly.";

/** The published-request caveat. Shown with the policy control, not buried. */
export const AI_CRAWLER_POLICY_NOTE =
  "robots.txt is a published request, not a lock. Every operator listed here states that it honours it, but a crawler that ignores it is not stopped by this setting.";

export function aiCrawlersInClass(
  crawlerClass: AiCrawlerClass,
): readonly AiCrawler[] {
  return AI_CRAWLERS.filter((crawler) => crawler.crawlerClass === crawlerClass);
}

/** Which classes a policy turns away. The ONE place the mapping is decided. */
export function blockedAiCrawlerClasses(
  policy: AiCrawlerPolicy,
): readonly AiCrawlerClass[] {
  switch (policy) {
    case "open":
      return [];
    case "search-only":
      return ["training"];
    case "blocked":
      return ["search", "training"];
  }
}

export function isAiCrawlerClassBlocked(
  policy: AiCrawlerPolicy,
  crawlerClass: AiCrawlerClass,
): boolean {
  return blockedAiCrawlerClasses(policy).includes(crawlerClass);
}

/**
 * The bots this policy turns away, in registry order — what robots.txt renders
 * and what the audit counts.
 */
export function blockedAiCrawlers(
  policy: AiCrawlerPolicy,
): readonly AiCrawler[] {
  const classes = blockedAiCrawlerClasses(policy);
  return AI_CRAWLERS.filter((crawler) =>
    classes.includes(crawler.crawlerClass),
  );
}

/** Per-class copy — shared by the settings card and the audit findings. */
export interface AiCrawlerClassCopy {
  readonly crawlerClass: AiCrawlerClass;
  readonly label: string;
  /** What this class does for the store. */
  readonly benefit: string;
  /** What blocking it costs, stated plainly. This is the load-bearing line. */
  readonly cost: string;
}

export const AI_CRAWLER_CLASS_COPY: readonly AiCrawlerClassCopy[] = [
  {
    crawlerClass: "search",
    label: "AI search crawlers",
    benefit:
      "These fetch your pages to answer a question someone is asking right now, and they link back to you when they do.",
    cost: "Block them and your store is absent from AI answers: ChatGPT, Claude and Perplexity cannot cite a page they are not allowed to read.",
  },
  {
    crawlerClass: "training",
    label: "AI training crawlers",
    benefit:
      "These collect pages that may go into a future model, which is how a brand ends up known to an assistant without being searched for.",
    cost: "Block them and your content stays out of future model knowledge. It does not remove you from AI answers today — that is the search class — and it does not recall what has already been collected.",
  },
] as const;

/** One radio option in the settings card, and the audit's name for the policy. */
export interface AiCrawlerPolicyOption {
  readonly value: AiCrawlerPolicy;
  readonly label: string;
  readonly summary: string;
}

export const AI_CRAWLER_POLICY_OPTIONS: readonly AiCrawlerPolicyOption[] = [
  {
    value: "open",
    label: "Allow every AI crawler",
    summary:
      "Maximum visibility. AI search can cite your store, and training crawlers may use your content in future models.",
  },
  {
    value: "search-only",
    label: "Allow AI search, refuse AI training",
    summary:
      "Your store can still be found and cited in AI answers, while your content is kept out of future model training.",
  },
  {
    value: "blocked",
    label: "Refuse every AI crawler",
    summary:
      "Your store is absent from AI answers as well as from training. Google and Bing search are unaffected — this changes nothing outside the bots listed below.",
  },
] as const;
