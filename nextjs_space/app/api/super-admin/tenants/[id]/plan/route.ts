import { NextResponse } from "next/server";
import { z } from "zod";
import { withSuperAdminParams } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { ApiError, apiValidationError } from "@/lib/api-error";
import { parseUuid } from "@/lib/validation/parse-uuid";
import { AUDIT_ACTIONS, createAuditLog, getClientInfo } from "@/lib/audit-log";
import { requireSameOrigin } from "@/lib/security/require-same-origin";
import { mirrorPlanToClerkOrg } from "@/lib/entitlements/clerk-plan-mirror";
import { PLANS, type PlanUpdateResponse } from "@/lib/entitlements/plan";

/**
 * PATCH /api/super-admin/tenants/[id]/plan — set a tenant's entitlement plan.
 * Authorization: SUPER_ADMIN only.
 *
 * There is no billing integration (Clerk Billing was rejected — Stripe
 * underneath, cannabis-adjacent), so this operator action is the ONLY writer of
 * `tenants.plan`, which is the single source of truth every entitlement gate
 * reads (`lib/entitlements/require-feature.ts`).
 *
 * Deliberately its own route rather than a field on the tenant PATCH: that
 * handler provisions Railway domains and Namecheap subdomains as a side effect
 * of saving, and a plan change must not be able to trip over a DNS failure.
 * Mirrors the `toggle-active` precedent for single-field super-admin writes.
 *
 * Order of operations is the whole safety argument: validate → commit the
 * column → audit → THEN best-effort mirror to Clerk. A Clerk outage downgrades
 * to a warning in the response; it can never fail the write or leave the tenant
 * on the wrong plan.
 */

const ROUTE = "PATCH /api/super-admin/tenants/[id]/plan";

/** Operator input is constrained to the four known plans — nothing else reaches the column. */
const planUpdateSchema = z.object({ plan: z.enum(PLANS) });

export const PATCH = withSuperAdminParams(async (req, { user }, params) => {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const id = parseUuid(params.id);

  const body = await req.json().catch(() => null);
  const parsed = planUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(`Plan must be one of: ${PLANS.join(", ")}`, ROUTE);
  }
  const { plan } = parsed.data;

  // Explicit row annotation: the `prisma` export in lib/db.ts is any-widened by
  // the build-time mock Proxy, so an inferred result trips TS7006.
  const tenant: {
    id: string;
    subdomain: string;
    plan: string;
  } | null = await prisma.tenants.findFirst({
    where: { id },
    select: { id: true, subdomain: true, plan: true },
  });

  if (!tenant) {
    throw new ApiError("Tenant not found", 404);
  }

  const previousPlan = tenant.plan;
  const changed = previousPlan !== plan;

  // Conditional write: re-submitting the current plan re-syncs Clerk without
  // adding a no-op row to the entitlement provenance trail.
  if (changed) {
    await prisma.tenants.update({ where: { id }, data: { plan } });

    await createAuditLog({
      action: AUDIT_ACTIONS.TENANT_PLAN_CHANGED,
      entityType: "Tenant",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      tenantId: id,
      metadata: {
        subdomain: tenant.subdomain,
        // Raw previous value, not the fail-closed parse — if the column held
        // something unrecognised, the trail must say so.
        previousPlan,
        newPlan: plan,
      },
      ...getClientInfo(req.headers),
    });
  }

  const mirror = await mirrorPlanToClerkOrg(id, plan);

  const response: PlanUpdateResponse = {
    plan,
    changed,
    mirrored: mirror.mirrored,
    mirrorReason: mirror.reason ?? null,
  };
  return NextResponse.json(response);
});
