/**
 * BS-A02 — the `affiliateCode` field of the consultation submit schema, and
 * the parse that keeps a malformed code from failing the whole sign-up.
 *
 * Kept apart from affiliate-code.ts so middleware (edge) never bundles zod.
 */
import { z } from "zod";
import { AFFILIATE_CODE_MAX_LENGTH, AFFILIATE_CODE_PATTERN } from "./affiliate-code";

export const AFFILIATE_CODE_FIELD = "affiliateCode";

/** Optional; "" = the customer left the field empty (or cleared it). */
export const affiliateCodeField = z
  .union([
    z.literal(""),
    z.string().trim().regex(AFFILIATE_CODE_PATTERN).max(AFFILIATE_CODE_MAX_LENGTH),
  ])
  .optional();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parse a sign-up body whose schema declares `affiliateCode`. A malformed code
 * is a field error on that one input — the form shows it inline before submit
 * (`affiliateCodeFieldError`) — and never a 400 for the whole registration:
 * the body is re-parsed without it, so the sign-up proceeds with no code (Dr
 * Green FR-2: a code never blocks sign-up), and when something else is also
 * wrong the error reported is that other field's, as it was before this field
 * existed.
 */
export function parseSignUpWithOptionalAffiliateCode<S extends z.ZodTypeAny>(
  schema: S,
  raw: unknown,
): { result: z.SafeParseReturnType<z.input<S>, z.output<S>>; affiliateCodeIssue: z.ZodIssue | null } {
  const first = schema.safeParse(raw);
  if (first.success || !isPlainObject(raw)) {
    return { result: first, affiliateCodeIssue: null };
  }
  const codeIssue = first.error.issues.find((issue) => issue.path[0] === AFFILIATE_CODE_FIELD);
  if (!codeIssue) {
    return { result: first, affiliateCodeIssue: null };
  }
  const { [AFFILIATE_CODE_FIELD]: _malformed, ...rest } = raw;
  return { result: schema.safeParse(rest), affiliateCodeIssue: codeIssue };
}
