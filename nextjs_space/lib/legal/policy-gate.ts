/**
 * Gate on collecting personal data without a published privacy notice.
 *
 * A storefront that takes a consultation while telling visitors "no privacy
 * policy is available" is collecting special-category data with no Art. 13
 * notice at all. That should not be possible.
 *
 * Enforcement is OFF by default and switched on by date, deliberately. Turning
 * this on before operators have published would stop live storefronts taking
 * orders — a self-inflicted outage in the name of compliance. So the gate ships
 * dark, logs every storefront that would be blocked, and starts refusing only
 * once LEGAL_POLICY_ENFORCEMENT_DATE has passed.
 *
 * Rollout:
 *   1. deploy with the variable unset — warn-only, nothing changes
 *   2. work the warnings until no active tenant appears in them
 *   3. set LEGAL_POLICY_ENFORCEMENT_DATE to a date a fortnight out
 *   4. the gate enforces itself on that date
 *
 * See docs/PRDS/prd-data-protection-remediation.md (US-010).
 */

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export type PolicyGateDecision =
  | { allowed: true; published: boolean }
  | { allowed: false; reason: string };

/** Parsed enforcement date, or null when enforcement is not configured. */
export function enforcementDate(env = process.env): Date | null {
  const raw = env.LEGAL_POLICY_ENFORCEMENT_DATE;
  if (!raw || raw.trim() === "") return null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    logger.error("[Legal] LEGAL_POLICY_ENFORCEMENT_DATE is not a valid date", {
      value: raw,
    });
    return null;
  }
  return parsed;
}

/** True once the configured enforcement date has passed. */
export function isEnforcing(now: Date, env = process.env): boolean {
  const date = enforcementDate(env);
  return date !== null && now >= date;
}

/**
 * Decide whether `tenantId` may collect personal data right now.
 *
 * Pure decision helper, separated from the database read so it can be tested
 * without one.
 */
export function decide(
  hasPublishedPolicy: boolean,
  now: Date,
  env = process.env,
): PolicyGateDecision {
  if (hasPublishedPolicy) return { allowed: true, published: true };

  if (!isEnforcing(now, env)) {
    return { allowed: true, published: false };
  }

  return {
    allowed: false,
    reason:
      "This store cannot accept consultations because it has not published a privacy policy.",
  };
}

/**
 * Gate a data-collecting request for a tenant.
 *
 * Never throws on database trouble: a failure to read the profile must not take
 * a storefront down, so it fails OPEN and logs. The gate is a backstop, not the
 * primary control — the primary control is the operator publishing.
 */
export async function checkPolicyGate(
  tenantId: string,
  now = new Date(),
): Promise<PolicyGateDecision> {
  let hasPublishedPolicy = false;

  try {
    const profile = await prisma.tenant_legal_profiles.findFirst({
      where: { tenantId },
      select: { publishedAt: true },
    });
    hasPublishedPolicy = Boolean(profile?.publishedAt);
  } catch (error) {
    logger.error("[Legal] Policy gate lookup failed; allowing the request", {
      tenantId,
      message: error instanceof Error ? error.message : String(error),
    });
    return { allowed: true, published: false };
  }

  const decision = decide(hasPublishedPolicy, now);

  if (!hasPublishedPolicy) {
    logger[decision.allowed ? "warn" : "error"](
      decision.allowed
        ? "[Legal] Tenant is collecting personal data with no published privacy policy"
        : "[Legal] Blocked data collection — no published privacy policy",
      { tenantId, enforcing: !decision.allowed },
    );
  }

  return decision;
}
