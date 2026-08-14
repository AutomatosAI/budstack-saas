/**
 * The plan gate — "may this TENANT use this feature at all".
 *
 * Composes with, and never replaces, the permission gate
 * (`lib/permissions/require-permission.ts`), which answers the different
 * question "may this MEMBER do this". Both must pass on a Pro write:
 *
 * ```ts
 * export const PUT = requirePermission(
 *   "canEditSeo",
 *   requireFeature(FEATURES.SEO_PRO, async (req, ctx) => { ... }),
 * );
 * ```
 *
 * Order matters and this is the sanctioned one: the permission wrapper
 * authenticates and denies unauthorised members BEFORE the plan lookup runs, so
 * an anonymous or unentitled caller never costs a query and never learns the
 * tenant's plan.
 *
 * `requireFeature` wraps the inner HANDLER rather than the route, which is why
 * it works under both `requirePermission` and `requirePermissionParams` — the
 * trailing `params` argument is forwarded untouched.
 *
 * SCOPE: tenant-admin routes only. The storefront never gates on plan — a Pro
 * feature's absence degrades rendering (no JSON-LD emitted), it never blocks
 * commerce.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getTenantFeatures, type FeatureKey } from "./features";
import { FAIL_CLOSED_PLAN, parsePlan, type Plan } from "./plan";

/**
 * Distinct 403 body so the client can tell "your plan doesn't include this"
 * apart from "your role doesn't allow this" (which returns a bare
 * `{ error }` from the permission wrapper) and offer an upgrade instead of a
 * "ask your admin" dead end.
 */
export const UPGRADE_REQUIRED_CODE = "upgrade_required";

export interface UpgradeRequiredBody {
  error: string;
  code: typeof UPGRADE_REQUIRED_CODE;
  /** The entitlement key that was missing, e.g. "seo.pro". */
  feature: FeatureKey;
  /** The tenant's own resolved plan — safe to show them, drives the CTA. */
  plan: Plan;
}

function upgradeRequired(feature: FeatureKey, plan: Plan): NextResponse {
  const body: UpgradeRequiredBody = {
    error: "This feature is not included in your plan.",
    code: UPGRADE_REQUIRED_CODE,
    feature,
    plan,
  };
  return NextResponse.json(body, { status: 403 });
}

/**
 * Read a tenant's plan from the authoritative column.
 *
 * Fail-closed on every unhappy path — unknown value, missing row, or a query
 * that throws all resolve to 'basic'. A database blip must not hand a Basic
 * tenant the Pro feature set.
 *
 * `findFirst` with a flat field per repo convention (compound-unique
 * `findUnique` breaks under the `$extends` tenant-scope rewrite in lib/db.ts).
 * The explicit row annotation is required: that same file's `prisma` export is
 * any-widened by the build-time mock Proxy, so generics do not flow and an
 * inferred callback/result param trips TS7006.
 */
export async function getTenantPlan(tenantId: string): Promise<Plan> {
  try {
    const row: { plan: string | null } | null = await prisma.tenants.findFirst({
      where: { id: tenantId },
      select: { plan: true },
    });
    return parsePlan(row?.plan);
  } catch (error) {
    logger.error("[entitlements] plan lookup failed — failing closed", {
      tenantId,
      plan: FAIL_CLOSED_PLAN,
      message: error instanceof Error ? error.message : String(error),
    });
    return FAIL_CLOSED_PLAN;
  }
}

type FeatureGatedHandler<Ctx, Rest extends unknown[]> = (
  req: NextRequest,
  ctx: Ctx,
  ...rest: Rest
) => Promise<NextResponse>;

/**
 * Require `feature` of the calling tenant's plan, else 403 `upgrade_required`.
 *
 * Generic over the trailing arguments so one wrapper serves both the 2-arg
 * (`requirePermission`) and 3-arg (`requirePermissionParams`) handler shapes.
 */
export function requireFeature<
  Ctx extends { tenantId: string },
  Rest extends unknown[],
>(
  feature: FeatureKey,
  handler: FeatureGatedHandler<Ctx, Rest>,
): FeatureGatedHandler<Ctx, Rest> {
  return async (req, ctx, ...rest) => {
    const plan = await getTenantPlan(ctx.tenantId);
    if (!getTenantFeatures({ id: ctx.tenantId, plan }).has(feature)) {
      return upgradeRequired(feature, plan);
    }
    return handler(req, ctx, ...rest);
  };
}
