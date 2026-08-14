/**
 * SEO Supercharge US-023 — the SEO audit: one score, grouped findings, and a
 * deep link on every one of them.
 *
 * WHAT THIS IS FOR. Workstreams A and C gave a store owner a great many fields
 * they can author and no way to know which ones they have left empty. An owner
 * with 60 products cannot hold "which of these has no description" in their
 * head, and the fields that matter most — the sitemap being right, a redirect
 * not looping — are not visible from the editor at all. This is the panel that
 * answers "what should I fix next", in the order it is worth fixing.
 *
 * PURE, AND THAT IS THE WHOLE DESIGN. `runSeoAudit` takes already-fetched rows
 * and returns a result: no prisma, no clock, no request. The queries live in the
 * route, the 15-minute cache in `audit-cache.ts`, the row-to-entity normalising
 * in `audit-snapshot.ts`, and the judgement in `audit-checks.ts` where it can be
 * tested a row at a time. The score is therefore reproducible — the same rows
 * always produce the same number, which is what makes "it went from 64 to 81"
 * mean something.
 *
 * THE SCORE IS CAPPED PER CHECK, not per finding — see `SEO_AUDIT_WEIGHTS` in
 * `audit-types.ts` for why a store with 400 missing titles must not have every
 * other fault hidden behind them.
 *
 * TWO CATEGORIES OF CHECK, ONE SCORE. `audit-checks.ts` asks whether a page can
 * be found and is described well enough to rank; `audit-llm-checks.ts`
 * (LLM Visibility US-004) asks whether a model is allowed to read it and can
 * extract an answer from it. They share the snapshot, the weights table and the
 * result, because an owner has one list of things to fix, not two.
 *
 * PRO ONLY, at the route (`requireFeature(FEATURES.SEO_PRO)`). Nothing in this
 * module gates: it is fed rows and it judges them. That split is deliberate —
 * the audit is a read over data a Basic tenant already owns, so the only thing
 * the plan decides is whether we do the work, and that decision belongs at the
 * API boundary rather than smeared through the checks.
 */

import {
  auditDuplicateTitles,
  auditEntityFields,
  auditNoindexInSitemap,
  auditRedirectTable,
  auditSitemapHealth,
} from "@/lib/seo/audit-checks";
import {
  auditAiCrawlerAccess,
  auditHeadingStructure,
  auditLlmsTxtContent,
  auditQaCoverage,
  auditWireVisibility,
} from "@/lib/seo/audit-llm-checks";
import {
  buildAuditSitemap,
  collectAuditEntities,
  type SeoAuditInput,
} from "@/lib/seo/audit-snapshot";
import {
  SEO_AUDIT_CHECKS,
  SEO_AUDIT_GRADE_THRESHOLDS,
  SEO_AUDIT_MAX_FINDINGS_PER_CHECK,
  SEO_AUDIT_SEVERITY_ORDER,
  SEO_AUDIT_WEIGHTS,
  type SeoAuditCheckResult,
  type SeoAuditFinding,
  type SeoAuditGrade,
  type SeoAuditResult,
  type SeoAuditSeverity,
  type SeoAuditStats,
} from "@/lib/seo/audit-types";

export type {
  SeoAuditConditionRow,
  SeoAuditDeletedProductRow,
  SeoAuditEntity,
  SeoAuditInput,
  SeoAuditPostRow,
  SeoAuditProductRow,
  SeoAuditRedirectRow,
} from "@/lib/seo/audit-snapshot";
export * from "@/lib/seo/audit-types";

/** The band a score falls in. See `SEO_AUDIT_GRADE_THRESHOLDS` for the why. */
export function seoAuditGrade(score: number): SeoAuditGrade {
  if (score >= SEO_AUDIT_GRADE_THRESHOLDS.good) return "good";
  if (score >= SEO_AUDIT_GRADE_THRESHOLDS["needs-work"]) return "needs-work";
  return "poor";
}

/** Where a check sits in the result: failing first, then worst severity first. */
function checkRank(result: SeoAuditCheckResult): number {
  const declared = SEO_AUDIT_CHECKS.indexOf(result.check);
  const failing = result.total > 0 ? 0 : 1;
  return (
    failing * 1_000_000 +
    SEO_AUDIT_SEVERITY_ORDER[result.severity] * 1_000 +
    declared
  );
}

/**
 * Group findings into checks, cap each group's penalty and display list, and
 * turn the total into a 0..100 score.
 *
 * EVERY check appears in the result, including the clean ones. That is what the
 * Audit tab's clean state is built from — "14 checks passed" is a sentence the
 * UI can only write if it is told about the checks that found nothing.
 */
export function scoreSeoAudit(
  findings: readonly SeoAuditFinding[],
  stats: SeoAuditStats,
): SeoAuditResult {
  const byCheck = new Map<string, SeoAuditFinding[]>();
  for (const item of findings) {
    const group = byCheck.get(item.check);
    if (group) group.push(item);
    else byCheck.set(item.check, [item]);
  }

  const checks: SeoAuditCheckResult[] = SEO_AUDIT_CHECKS.map((check) => {
    const weight = SEO_AUDIT_WEIGHTS[check];
    const group = byCheck.get(check) ?? [];
    return {
      check,
      severity: weight.severity,
      title: weight.title,
      total: group.length,
      findings: group.slice(0, SEO_AUDIT_MAX_FINDINGS_PER_CHECK),
      penalty: Math.min(weight.cap, weight.perFinding * group.length),
    };
  }).sort((a, b) => checkRank(a) - checkRank(b));

  const penalty = checks.reduce((sum, check) => sum + check.penalty, 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));

  const severityCounts: Record<SeoAuditSeverity, number> = {
    critical: 0,
    warning: 0,
    info: 0,
  };
  for (const check of checks) {
    severityCounts[check.severity] += check.total;
  }

  return {
    score,
    grade: seoAuditGrade(score),
    checks,
    totalFindings: findings.length,
    severityCounts,
    stats,
  };
}

/**
 * Audit one store.
 *
 * `truncated` names the entity types whose row ceiling the caller hit, so a
 * partial audit says so instead of quietly scoring a store on its first 2000
 * products (`SEO_AUDIT_MAX_ROWS_PER_TYPE`).
 */
export function runSeoAudit(
  input: SeoAuditInput,
  truncated: readonly string[] = [],
): SeoAuditResult {
  const sitemap = buildAuditSitemap(input);
  const entities = collectAuditEntities(input, sitemap.locs);

  const findings: SeoAuditFinding[] = [
    ...auditEntityFields(entities),
    ...auditDuplicateTitles(entities),
    ...auditNoindexInSitemap(entities),
    ...auditSitemapHealth(input, entities, sitemap),
    ...auditRedirectTable(input.redirects),
    // LLM Visibility US-004 — the same rows, asked whether a model can read
    // them. A second module rather than more of `audit-checks.ts`: the
    // questions are different (readable and quotable, not discoverable and
    // described) and each file stays a length worth reading.
    ...auditAiCrawlerAccess(input),
    ...auditQaCoverage(entities),
    ...auditLlmsTxtContent(entities),
    ...auditWireVisibility(input),
    ...auditHeadingStructure(entities),
  ];

  return scoreSeoAudit(findings, {
    pages: entities.filter((entity) => entity.tab === "pages").length,
    products: input.products.length,
    posts: input.posts.length,
    conditions: input.conditions.length,
    redirects: input.redirects.length,
    sitemapEntries: sitemap.entries.length,
    truncated,
  });
}
