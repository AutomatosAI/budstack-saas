/**
 * LLM Visibility US-004 — the LLM-readiness checks: what an answer engine can
 * and cannot see of this store.
 *
 * THE QUESTION THIS CATEGORY ASKS is different from the one the rest of the
 * audit asks. `audit-checks.ts` judges whether a page is DISCOVERABLE and
 * described well enough to rank; these five judge whether a model that has
 * already found the page can READ it, EXTRACT an answer from it, and be allowed
 * to cite it at all. A store can score well on every search check and still be
 * absent from every AI answer, because the one control that decides that —
 * robots.txt — is invisible from the editor.
 *
 * Same contract as its sibling: pure, total, no I/O, and every finding carries a
 * {@link SeoAuditTarget} naming where it is fixed. Three of the five are
 * STORE-LEVEL and produce at most one finding each — a crawler policy, a
 * document and a draft queue are single causes, and one finding per affected row
 * would report the same fact fifty times.
 *
 * WHAT AC (d) ASKED FOR AND WHAT THE CODE ACTUALLY SUPPORTS — read this before
 * changing {@link auditWireVisibility}. The story specifies "a tenant whose blog
 * surface is the Automatos Shadow-DOM widget (wireMode column)". Verified
 * against the repo on 2026-08-14, that premise does not hold:
 *
 *  - `tenants.wireMode` is `MANUAL | ASSISTED` and its schema comment says what
 *    it is — "The Wire authoring mode ... (Automatos pushes drafts)"
 *    (prisma/schema.prisma:821). It selects who WRITES a post, not what renders
 *    one. ASSISTED posts land in `posts` as drafts for review
 *    (app/api/integrations/automatos/posts/route.ts) and publish through the
 *    same route as a hand-written one.
 *  - The Wire's storefront surfaces are ordinary server-rendered Next routes
 *    (`app/store/[slug]/the-wire/page.tsx`, `[postSlug]/page.tsx`) — the post
 *    body is sanitized HTML in the response. Fully crawlable.
 *  - The Automatos widget IS Shadow-DOM (`attachShadow({mode:"open"})` in
 *    public/automatos-widget.js) but it is initialised as `widget: "chat"`
 *    (components/admin/AutomatosWidgetWrapper.tsx:28) — a chat FAB. It renders
 *    no blog content on any surface.
 *
 * So no tenant has a Shadow-DOM blog, and the specified check could never fire.
 * What DOES make Wire content invisible to every crawler and LLM is the
 * ordinary case the assisted mode produces at volume: a draft has no page.
 * `published: false` is the real invisibility, ASSISTED mode is why a store
 * accumulates it without noticing, and The Wire's list — the AC's deep link — is
 * where it is fixed. That is the check below, and the journal records the
 * substitution.
 */

import {
  blockedAiCrawlerClasses,
  parseAiCrawlerPolicy,
  aiCrawlersInClass,
  AI_CRAWLER_CLASS_COPY,
  type AiCrawlerPolicy,
} from "@/lib/seo/ai-crawlers";
import type { SeoAuditEntity, SeoAuditInput } from "@/lib/seo/audit-snapshot";
import {
  SEO_AUDIT_HEADING_MIN_BODY_LENGTH,
  SEO_AUDIT_WIRE_ADMIN_PATH,
} from "@/lib/seo/audit-llm-types";
import {
  SEO_AUDIT_WEIGHTS,
  type SeoAuditCheckId,
  type SeoAuditFinding,
  type SeoAuditTarget,
} from "@/lib/seo/audit-types";
import { LLMS_TXT_PATH } from "@/lib/seo/llms-txt-copy";
import { isSeoProUnlocked } from "@/lib/seo/pro-features";

function finding(
  check: SeoAuditCheckId,
  message: string,
  target: SeoAuditTarget,
): SeoAuditFinding {
  return {
    check,
    severity: SEO_AUDIT_WEIGHTS[check].severity,
    message,
    target,
  };
}

function targetFor(entity: SeoAuditEntity): SeoAuditTarget {
  return { tab: entity.tab, entityId: entity.entityId, label: entity.label };
}

/** The AI Crawlers tab: the policy card and the llms.txt card both live there. */
const AI_CRAWLERS_TARGET: SeoAuditTarget = {
  tab: "ai-crawlers",
  label: "AI crawlers",
};

/**
 * (a) — is this store's own robots.txt turning away the crawlers that produce
 * citations?
 *
 * ONLY THE SEARCH CLASS IS A FINDING. Blocking the TRAINING crawlers is a
 * legitimate, informed choice with a cost the settings card states in full
 * (`AI_CRAWLER_CLASS_COPY`), and an audit that marked it down would be scoring
 * a store on a decision its owner made deliberately. Blocking the SEARCH class
 * is the one that is nearly always an accident — it is what `blocked` does on
 * top of what the owner wanted — and it is total: ChatGPT, Claude and Perplexity
 * cannot cite a page they are not allowed to fetch.
 *
 * The policy is parsed fail-OPEN (`parseAiCrawlerPolicy`), so an unreadable
 * settings blob produces no finding rather than a false alarm about a block
 * that is not there.
 *
 * THE PLAN GATE IS THE ROBOTS ROUTE'S, applied here for the same reason:
 * `app/store/[slug]/robots.txt` omits the whole AI section for a tenant without
 * `seo.pro` (lib/seo/robots-txt.ts — a null policy renders the base file), so a
 * Basic store's stored `blocked` is dormant and no crawler is being turned
 * away. Reporting it would be a finding about a file that does not say that.
 * The audit route cannot reach this state — it is plan-gated itself — but the
 * engine is a pure function anyone may call, and the check has to be true for
 * the rows it is given rather than for the caller it expects.
 */
export function auditAiCrawlerAccess(
  input: SeoAuditInput,
): SeoAuditFinding[] {
  if (!isSeoProUnlocked({ id: input.tenantId, plan: input.plan })) return [];

  const policy: AiCrawlerPolicy = parseAiCrawlerPolicy(input.aiCrawlerPolicy);
  if (!blockedAiCrawlerClasses(policy).includes("search")) return [];

  const bots = aiCrawlersInClass("search")
    .map((crawler) => crawler.userAgent)
    .join(", ");
  const cost =
    AI_CRAWLER_CLASS_COPY.find((copy) => copy.crawlerClass === "search")?.cost ??
    "";

  return [
    finding(
      "ai-search-blocked",
      `Your robots.txt tells the AI search crawlers (${bots}) not to read this store. ${cost}`,
      AI_CRAWLERS_TARGET,
    ),
  ];
}

/**
 * (b) — pages that state no question and answer it.
 *
 * A strain description is prose about aroma and lineage; "is this good for
 * sleep?" has to be inferred from it. A stored pair is the same content in the
 * shape extraction actually reads, and it is the only part of this category
 * with a plausible mechanism behind it — which is why it is `info` and costs a
 * point, not a warning that costs three.
 *
 * PRODUCTS AND CONDITIONS ONLY (`expectsQa`): an article answers its questions
 * in its prose, and a static page has no Q&A field. The product finding's deep
 * link opens the Q&A editor that fixes it. THE CONDITION FINDING'S DOES NOT —
 * `conditions.faqs` is written by the seed and by nothing else in this repo
 * (the SEO route says so at app/api/tenant-admin/seo/conditions/[id]/route.ts
 * :101), so its button lands the owner on the right guide's editor and no
 * closer. It is reported anyway, and stays worded as a statement about the page
 * rather than an instruction: a condition guide that answers nothing is the
 * largest single GEO gap a store can have, and an owner is better served
 * knowing it than being told only about the gaps that happen to be editable.
 */
export function auditQaCoverage(
  entities: readonly SeoAuditEntity[],
): SeoAuditFinding[] {
  return entities
    .filter((entity) => entity.expectsQa && entity.qaPairs === 0)
    .map((entity) =>
      finding(
        "qa-missing",
        `“${entity.label}” publishes no questions and answers, so an AI assistant has to infer what this ${entity.noun} is for from the description.`,
        targetFor(entity),
      ),
    );
}

/**
 * (c) — the llms.txt this store publishes right now, and whether anything is in
 * it.
 *
 * PRESENCE IS NOT IN DOUBT AND STALENESS CANNOT HAPPEN, which is why neither is
 * checked. The document is not a stored artefact: `app/store/[slug]/llms.txt`
 * renders it per request from live rows behind a one-hour cache, and it is
 * published for exactly the tenants this audit runs for (both gate on
 * `seo.pro`). There is no file to be missing and no copy to fall behind.
 *
 * What CAN be wrong is that the document has nothing to say. It lists
 * conditions, products and posts; a store with none of them — or one that has
 * excluded all of them through `sitemapExclude` / `noindex`, which llms.txt
 * honours where the sitemap honours only the first — publishes an identity
 * block and three empty sections. `inLlmsTxt` is computed with the renderer's
 * own predicate, so this finding cannot disagree with the file.
 */
export function auditLlmsTxtContent(
  entities: readonly SeoAuditEntity[],
): SeoAuditFinding[] {
  const listable = entities.filter((entity) => entity.tab !== "pages");
  if (listable.length === 0) return [];
  if (listable.some((entity) => entity.inLlmsTxt)) return [];

  return [
    finding(
      "llms-txt-empty",
      `Your ${LLMS_TXT_PATH} names the store and lists none of its ${listable.length} products, posts or condition pages — every one of them is either excluded or has no URL.`,
      AI_CRAWLERS_TARGET,
    ),
  ];
}

/**
 * (d) — Wire content that no crawler can reach. See the module docstring for
 * why this is about drafts rather than about a Shadow-DOM blog surface.
 *
 * ASSISTED mode is named in the message only when it is on, and is named as the
 * EXPLANATION rather than the fault: a store that opted into agent drafts is
 * supposed to accumulate them, and the finding is that they have not been
 * reviewed yet. Turning the mode off would not publish a single one of them.
 */
export function auditWireVisibility(
  input: SeoAuditInput,
): SeoAuditFinding[] {
  const drafts = input.unpublishedPostCount ?? 0;
  if (drafts < 1) return [];

  const assisted =
    typeof input.wireMode === "string" && input.wireMode === "ASSISTED"
      ? " Assisted drafts from Automatos land here for review, so they arrive unpublished by design."
      : "";

  return [
    finding(
      "wire-drafts-unpublished",
      `${drafts} Wire ${drafts === 1 ? "post is" : "posts are"} still unpublished. An unpublished post has no page at all, so no crawler and no AI assistant can read ${drafts === 1 ? "it" : "them"}.${assisted}`,
      {
        // The nearest tab for a client that only understands tabs; `href` is
        // what the SEO Manager actually uses.
        tab: "posts",
        label: "The Wire",
        href: SEO_AUDIT_WIRE_ADMIN_PATH,
      },
    ),
  ];
}

/**
 * (e) — the heading skeleton of an authored article.
 *
 * THREE FAULTS, THREE CHECKS, because they are three different edits. The
 * duplicate `<h1>` is the one this platform actively invites: the Wire editor
 * offers a Heading 1 button and the post page already renders the title as the
 * page's `<h1>`, so using it produces two subjects for one document. A skipped
 * level and a missing tree are refinements, hence `info`.
 *
 * Runs over whatever entity carries an authored body, which today is a Wire post
 * and nothing else — `headings` is null for every other type and the loop skips
 * it, so a condition page is never judged on a heading tree it does not own.
 */
export function auditHeadingStructure(
  entities: readonly SeoAuditEntity[],
): SeoAuditFinding[] {
  const findings: SeoAuditFinding[] = [];

  for (const entity of entities) {
    const headings = entity.headings;
    if (!headings) continue;
    const target = targetFor(entity);

    if (headings.h1Count > 0) {
      findings.push(
        finding(
          "heading-duplicate-h1",
          `“${entity.label}” uses ${headings.h1Count === 1 ? "a Heading 1" : `${headings.h1Count} Heading 1s`} inside the article. The page already publishes the title as its one top-level heading, so a reader — human or machine — is told the page has ${headings.h1Count + 1} subjects.`,
          target,
        ),
      );
    }

    if (headings.firstSkip) {
      findings.push(
        finding(
          "heading-level-skip",
          `“${entity.label}” jumps from Heading ${headings.firstSkip.from} to Heading ${headings.firstSkip.to}, so the section it opens has no parent to belong to.`,
          target,
        ),
      );
    }

    if (
      headings.levels.length === 0 &&
      headings.textLength >= SEO_AUDIT_HEADING_MIN_BODY_LENGTH
    ) {
      findings.push(
        finding(
          "heading-missing",
          `“${entity.label}” is ${headings.textLength} characters with no subheadings, so an assistant answering a question has no labelled section to quote from.`,
          target,
        ),
      );
    }
  }

  return findings;
}
