/**
 * LLM Visibility US-004 — what the LLM-readiness category can find, and what
 * each fault costs the score.
 *
 * SPLIT FROM `audit-types.ts` purely for size: the core vocabulary was already
 * the length of a file worth reading, and this category's weights need more
 * justification than a table row each. `audit-types.ts` spreads
 * {@link SEO_AUDIT_LLM_WEIGHTS} into the one `SEO_AUDIT_WEIGHTS` map and
 * declares the ids in the one `SEO_AUDIT_CHECKS` list, so there is still exactly
 * one scoring model — this file holds no second one.
 *
 * The `SeoAuditWeight` import below is TYPE-ONLY and therefore erased, so the
 * runtime dependency runs one way (`audit-types` → this file) and there is no
 * import cycle.
 *
 * THE WEIGHTS, AND WHY THEY SIT WHERE THEY DO relative to the search checks.
 *
 * `ai-search-blocked` is the heaviest check in the whole audit (20 — above
 * `sitemap-empty`'s 15) and is declared FIRST, so it outranks every other
 * critical when the result is sorted. That is not enthusiasm for the category:
 * an empty sitemap makes a store hard to DISCOVER, while a robots.txt that
 * turns away OAI-SearchBot, Claude-SearchBot and PerplexityBot makes it
 * impossible to CITE — the pages are readable by everything except the systems
 * being asked about them. It is also the one finding here an owner can fix in a
 * single click, and it is usually an accident: `blocked` is chosen to keep
 * content out of model TRAINING, and it takes the search bots down with it
 * (`lib/seo/ai-crawlers.ts` exists to make that distinction visible).
 *
 * Everything else in this category is deliberately LIGHTER than the equivalent
 * search-SEO fault, and the reason is honesty. A missing title provably changes
 * what Google renders; the evidence that Q&A blocks, an llms.txt or a tidy
 * heading tree change how often a model cites a store is thin to non-existent
 * (see `lib/seo/llms-txt.ts` on the SE Ranking study). These are cheap,
 * plausible, no-downside improvements, and a score that punished a store for
 * skipping them would be asserting a causal claim nobody can support. So:
 * `qa-missing` costs a point per page against a 6-point ceiling, where
 * `title-missing` costs three against eighteen.
 */

import type { SeoAuditWeight } from "@/lib/seo/audit-types";

/** The LLM-readiness checks, declared in `SEO_AUDIT_CHECKS` alongside the rest. */
export const SEO_AUDIT_LLM_CHECKS = [
  "ai-search-blocked",
  "llms-txt-empty",
  "wire-drafts-unpublished",
  "heading-duplicate-h1",
  "qa-missing",
  "heading-level-skip",
  "heading-missing",
] as const;

export type SeoAuditLlmCheckId = (typeof SEO_AUDIT_LLM_CHECKS)[number];

export const SEO_AUDIT_LLM_WEIGHTS: Readonly<
  Record<SeoAuditLlmCheckId, SeoAuditWeight>
> = {
  // One finding for the store, never one per bot: the cause is a single radio
  // button, so `perFinding` and `cap` are the same number.
  "ai-search-blocked": {
    severity: "critical",
    title: "AI search crawlers are blocked",
    perFinding: 20,
    cap: 20,
  },
  "llms-txt-empty": {
    severity: "warning",
    title: "Your llms.txt lists no content",
    perFinding: 6,
    cap: 6,
  },
  "wire-drafts-unpublished": {
    severity: "warning",
    title: "Wire drafts nobody can read",
    perFinding: 4,
    cap: 4,
  },
  "heading-duplicate-h1": {
    severity: "warning",
    title: "More than one top-level heading",
    perFinding: 2,
    cap: 8,
  },
  "qa-missing": {
    severity: "info",
    title: "Pages that answer no questions",
    perFinding: 1,
    cap: 6,
  },
  "heading-level-skip": {
    severity: "info",
    title: "Heading levels that skip",
    perFinding: 1,
    cap: 4,
  },
  "heading-missing": {
    severity: "info",
    title: "Long articles with no subheadings",
    perFinding: 1,
    cap: 4,
  },
};

/**
 * How long an article has to be before "no subheadings" is a finding.
 *
 * Roughly 200 words. Below it an article is one idea and a heading tree would
 * be scaffolding around a paragraph; above it a reader — human or model — is
 * being asked to hold an unlabelled block in their head. Measured on the
 * visible text with the tags stripped, so a body that is mostly markup is
 * judged on what it actually says.
 */
export const SEO_AUDIT_HEADING_MIN_BODY_LENGTH = 1200;

/**
 * The path the "unpublished Wire drafts" finding sends an owner to.
 *
 * The one target in the audit that leaves the SEO Manager. It is the list where
 * every draft is visible and where publishing one is a click — see
 * `SeoAuditTarget.href` for how the UI renders a destination it cannot reach by
 * switching tabs.
 */
export const SEO_AUDIT_WIRE_ADMIN_PATH = "/tenant-admin/the-wire";
