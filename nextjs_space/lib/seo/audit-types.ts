/**
 * SEO Supercharge US-023 — the audit's vocabulary: what can be wrong with a
 * store's SEO, what each fault costs the score, and which editor fixes it.
 *
 * SPLIT FROM THE ENGINE so the dependency graph stays a DAG: `audit-checks.ts`
 * produces findings against these shapes, `audit.ts` scores them, and neither
 * has to import the other. Types and constants only — no logic, no prisma, no
 * next, no I/O.
 *
 * A FINDING IS A SENTENCE PLUS A DESTINATION. The story's whole point is that a
 * score nobody can act on is a vanity metric, so every finding carries a
 * {@link SeoAuditTarget} naming the SEO Manager tab — and, where there is one,
 * the row — that fixes it. The UI turns that into a button; nothing in the
 * result is allowed to be an observation with no next step.
 */

import {
  SEO_AUDIT_LLM_CHECKS,
  SEO_AUDIT_LLM_WEIGHTS,
} from "@/lib/seo/audit-llm-types";
import { SEO_DESCRIPTION_MAX_LENGTH } from "@/lib/seo/store-identity";

/**
 * How much a fault matters, in the crawler's terms rather than ours.
 *
 * `critical` — a page is invisible, unreachable or advertised wrongly: the
 * defect class this whole PRD exists to close.
 * `warning`  — the page works but competes with itself or with another store on
 * the same template (a default title, a duplicate, an over-long description).
 * `info`     — a refinement. Real advice, but a store that ignores every one of
 * these still ranks.
 */
export type SeoAuditSeverity = "critical" | "warning" | "info";

/** Severity order for sorting a result — criticals first, always. */
export const SEO_AUDIT_SEVERITY_ORDER: Readonly<
  Record<SeoAuditSeverity, number>
> = { critical: 0, warning: 1, info: 2 };

/**
 * Every check the audit runs. The result reports one group per entry.
 *
 * DECLARED ORDER IS THE TIE-BREAK, not the ranking: `checkRank` sorts on
 * failing-first, then severity, and only then on position here — so this list
 * decides which of two equally severe checks an owner reads first.
 * `ai-search-blocked` (US-004) therefore leads, above `sitemap-empty`: a store
 * that cannot be discovered is behind a store that cannot be cited, and both
 * are behind neither.
 */
export const SEO_AUDIT_CHECKS = [
  "ai-search-blocked",
  "sitemap-empty",
  "sitemap-url-form",
  "sitemap-deleted-leak",
  "redirect-loop",
  "title-duplicate",
  "title-missing",
  "description-missing",
  "llms-txt-empty",
  "wire-drafts-unpublished",
  "heading-duplicate-h1",
  "title-long",
  "description-long",
  "image-alt-missing",
  "noindex-in-sitemap",
  "product-no-page",
  "qa-missing",
  "heading-level-skip",
  "heading-missing",
  "title-short",
  "description-short",
  "og-image-missing",
  "redirect-chain",
] as const;

export type SeoAuditCheckId = (typeof SEO_AUDIT_CHECKS)[number];

/**
 * The LLM-readiness ids, as core check ids.
 *
 * The annotation is the point: `SEO_AUDIT_LLM_WEIGHTS` is keyed by its own
 * union, so an id declared there and forgotten HERE would carry a weight the
 * scorer never reaches — the scorer iterates {@link SEO_AUDIT_CHECKS} and
 * nothing else. This line fails to compile in exactly that case.
 */
export const SEO_AUDIT_LLM_CHECK_IDS: readonly SeoAuditCheckId[] =
  SEO_AUDIT_LLM_CHECKS;

/**
 * The SEO Manager tabs a finding can send an owner to.
 *
 * `ai-crawlers` is US-004's addition: the tab that holds both the crawler
 * policy card and the llms.txt card, which is where its two store-level
 * findings are fixed. A destination OUTSIDE this panel travels as
 * {@link SeoAuditTarget.href} instead — a tab name it does not have cannot be
 * switched to.
 */
export const SEO_AUDIT_TABS = [
  "products",
  "posts",
  "conditions",
  "pages",
  "redirects",
  "ai-crawlers",
] as const;

export type SeoAuditTab = (typeof SEO_AUDIT_TABS)[number];

/** Where the fix lives — the deep link the UI renders as a button. */
export interface SeoAuditTarget {
  readonly tab: SeoAuditTab;
  /**
   * The row to open in the editor: `products.id`, `posts.id`, `conditions.id`,
   * a `StoreSeoPageKey`, or `seo_redirects.id`. Absent for a finding about the
   * store as a whole, which opens the tab and nothing more.
   */
  readonly entityId?: string;
  /** What to call the thing in the finding — the product name, the page name. */
  readonly label: string;
  /**
   * US-004 — an admin path OUTSIDE the SEO Manager, for the one finding whose
   * fix does not live in this panel (unpublished Wire drafts, fixed in The
   * Wire). When present the UI renders a link to it rather than a button that
   * switches tabs; `tab` still names the nearest tab, so a client that only
   * understands tabs lands somewhere related instead of nowhere.
   */
  readonly href?: string;
}

export interface SeoAuditFinding {
  readonly check: SeoAuditCheckId;
  readonly severity: SeoAuditSeverity;
  /** One sentence, addressed to the owner, stating what is wrong. */
  readonly message: string;
  readonly target: SeoAuditTarget;
}

/**
 * THE SCORING MODEL, and why it is capped per check rather than per finding.
 *
 * The score starts at 100 and each check subtracts `perFinding` points per
 * finding, up to `cap`. The cap is the load-bearing part: a store with 400
 * products and no authored titles has 400 findings of one kind, and an
 * uncapped model would put it at 0 with every other check — duplicate titles, a
 * redirect loop, a leaking sitemap — invisible behind it. Capping means the
 * score answers "how many DIFFERENT things are wrong", which is the question an
 * owner can act on, while the group's `total` still reports the real volume.
 *
 * Weights are relative, not absolute: a redirect loop (10) is worth roughly
 * three missing titles (3 each) because a loop takes a page out of the index
 * entirely and a missing title only makes it compete with its own defaults.
 * The caps sum to more than 100 by design — a store failing everything scores
 * 0, and there is no useful distinction below that.
 */
export interface SeoAuditWeight {
  readonly severity: SeoAuditSeverity;
  /** Group heading in the Audit tab. */
  readonly title: string;
  readonly perFinding: number;
  /** Most points this check can ever cost, however many findings it produces. */
  readonly cap: number;
}

export const SEO_AUDIT_WEIGHTS: Readonly<
  Record<SeoAuditCheckId, SeoAuditWeight>
> = {
  "sitemap-empty": {
    severity: "critical",
    title: "Sitemap advertises no content",
    perFinding: 15,
    cap: 15,
  },
  "sitemap-url-form": {
    severity: "critical",
    title: "Pages missing from the sitemap",
    perFinding: 5,
    cap: 20,
  },
  "sitemap-deleted-leak": {
    severity: "critical",
    title: "Deleted products still advertised",
    perFinding: 10,
    cap: 20,
  },
  "redirect-loop": {
    severity: "critical",
    title: "Redirect loops",
    perFinding: 10,
    cap: 20,
  },
  "title-duplicate": {
    severity: "critical",
    title: "Duplicate titles",
    perFinding: 5,
    cap: 15,
  },
  "title-missing": {
    severity: "warning",
    title: "Missing search titles",
    perFinding: 3,
    cap: 18,
  },
  "description-missing": {
    severity: "warning",
    title: "Missing search descriptions",
    perFinding: 3,
    cap: 18,
  },
  "title-long": {
    severity: "warning",
    title: "Titles too long",
    perFinding: 2,
    cap: 10,
  },
  "description-long": {
    severity: "warning",
    title: "Descriptions too long",
    perFinding: 2,
    cap: 10,
  },
  "image-alt-missing": {
    severity: "warning",
    title: "Images without alt text",
    perFinding: 2,
    cap: 10,
  },
  "noindex-in-sitemap": {
    severity: "warning",
    title: "Hidden pages still in the sitemap",
    perFinding: 3,
    cap: 9,
  },
  "product-no-page": {
    severity: "warning",
    title: "Products with no storefront page",
    perFinding: 2,
    cap: 8,
  },
  "title-short": {
    severity: "info",
    title: "Titles that could say more",
    perFinding: 1,
    cap: 5,
  },
  "description-short": {
    severity: "info",
    title: "Descriptions that could say more",
    perFinding: 1,
    cap: 5,
  },
  "og-image-missing": {
    severity: "info",
    title: "No image of their own to share",
    perFinding: 1,
    cap: 5,
  },
  "redirect-chain": {
    severity: "info",
    title: "Redirect chains",
    perFinding: 1,
    cap: 5,
  },
  // US-004's LLM-readiness category. Spread rather than restated so there is one
  // scoring model; the rationale for each number lives beside it.
  ...SEO_AUDIT_LLM_WEIGHTS,
};

/**
 * Title length bounds.
 *
 * 60 is where Google's ~600px result column clips a title mid-word; under 30 an
 * owner is almost certainly leaving the strain, the condition or the town out of
 * a string that is their entire pitch in the result. Neither is a rule a crawler
 * enforces — they are the widths a HUMAN reads, which is why "short" is `info`
 * and "long" is `warning`.
 */
export const SEO_AUDIT_TITLE_MIN_LENGTH = 30;
export const SEO_AUDIT_TITLE_MAX_LENGTH = 60;

/**
 * Description length bounds. The maximum is the platform's own truncation width
 * (`SEO_DESCRIPTION_MAX_LENGTH`), imported rather than restated so an authored
 * description the audit calls acceptable is one the storefront renders whole.
 */
export const SEO_AUDIT_DESCRIPTION_MIN_LENGTH = 70;
export const SEO_AUDIT_DESCRIPTION_MAX_LENGTH = SEO_DESCRIPTION_MAX_LENGTH;

/**
 * How many findings of one kind travel in the response.
 *
 * A store with 400 unauthored products produces 400 identical findings and the
 * owner reads the first few. The group still reports its true `total`, and the
 * UI says "showing 25 of 400" — the cap is stated, never silent.
 */
export const SEO_AUDIT_MAX_FINDINGS_PER_CHECK = 25;

/**
 * Row ceiling per entity type. The audit runs at most once per 15 minutes per
 * tenant (see `audit-cache.ts`), but it holds every row in memory while it runs
 * and this process serves every other tenant at the same time. A store past the
 * ceiling is audited on its first N rows and TOLD so, in `stats.truncated`.
 */
export const SEO_AUDIT_MAX_ROWS_PER_TYPE = 2000;

/** What the audit looked at — context for the score, shown above the findings. */
export interface SeoAuditStats {
  readonly pages: number;
  readonly products: number;
  readonly posts: number;
  readonly conditions: number;
  readonly redirects: number;
  /** URLs the store's sitemap.xml publishes right now. */
  readonly sitemapEntries: number;
  /** Entity types whose row ceiling was reached, so the score is partial. */
  readonly truncated: readonly string[];
}

/** One check's outcome. Present even when clean, so the UI can show it passed. */
export interface SeoAuditCheckResult {
  readonly check: SeoAuditCheckId;
  readonly severity: SeoAuditSeverity;
  readonly title: string;
  /** Findings before the per-check display cap. */
  readonly total: number;
  readonly findings: readonly SeoAuditFinding[];
  /** Points this check cost the score (already capped). */
  readonly penalty: number;
}

/**
 * The bands the score is reported in.
 *
 * 90 is "nothing a crawler would hold against you"; 70 is where the warnings
 * start outnumbering the refinements. Bands rather than a bare number because a
 * 78 and an 81 are the same store, and an owner who chases the number instead
 * of the findings has been given a slot machine.
 */
export const SEO_AUDIT_GRADES = ["good", "needs-work", "poor"] as const;
export type SeoAuditGrade = (typeof SEO_AUDIT_GRADES)[number];

export const SEO_AUDIT_GRADE_THRESHOLDS: Readonly<
  Record<Exclude<SeoAuditGrade, "poor">, number>
> = { good: 90, "needs-work": 70 };

export interface SeoAuditResult {
  /** 0..100, integer. */
  readonly score: number;
  readonly grade: SeoAuditGrade;
  /** Every check, worst first; clean ones carry `total: 0`. */
  readonly checks: readonly SeoAuditCheckResult[];
  readonly totalFindings: number;
  readonly severityCounts: Readonly<Record<SeoAuditSeverity, number>>;
  readonly stats: SeoAuditStats;
}
