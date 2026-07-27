/**
 * Article 9 special-category (health) field names.
 *
 * These are the fields BudStacks collects on the consultation form and forwards
 * to Dr Green, who is the controller for the clinical record. BudStacks does not
 * store them: they are validated on the way in, mapped into the Dr Green payload
 * from the in-memory request body, and discarded with the request.
 *
 * Single source of truth. Consumed by:
 *   - `lib/security/redact.ts` — folded into SENSITIVE_FIELDS so these names are
 *     stripped from logs, audit_logs.metadata and webhook archives.
 *   - `tests/unit/no-article9-persistence.test.ts` — fails the build if any of
 *     these is written back into a Prisma `create`/`update` payload.
 *
 * Extend HERE. Never maintain a parallel list.
 *
 * Background: docs/PRDS/prd-data-protection-remediation.md
 * Evidence:   docs/compliance/2026-07-27-article9-purge.md
 */
export const ARTICLE_9_FIELDS: readonly string[] = Object.freeze([
  // Conditions and medication
  "medicalConditions",
  "otherCondition",
  "prescribedMedications",
  "prescribedSupplements",

  // Contraindication screening
  "hasHeartProblems",
  "hasCancerTreatment",
  "hasImmunosuppressants",
  "hasLiverDisease",
  "hasPsychiatricHistory",

  // Substance-use history
  "hasAlcoholAbuse",
  "hasDrugServices",
  "alcoholUnitsPerWeek",
  "cannabisReducesMeds",
  "cannabisFrequency",
  "cannabisAmountPerDay",
]);

/** Set form, for O(1) membership checks. */
export const ARTICLE_9_FIELD_SET: ReadonlySet<string> = new Set(ARTICLE_9_FIELDS);

/** True if `name` is an Article 9 health field that must never be persisted. */
export function isArticle9Field(name: string): boolean {
  return ARTICLE_9_FIELD_SET.has(name);
}
