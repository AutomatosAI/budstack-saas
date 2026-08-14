/**
 * Best-effort MIRROR of a tenant's plan onto its Clerk organization.
 *
 * WRITE ONLY. Nothing in this codebase reads `publicMetadata.plan` back —
 * `lib/entitlements/require-feature.ts` resolves from the `tenants.plan` column
 * and nowhere else. The mirror exists so the plan is visible in the Clerk
 * dashboard alongside the org, and so a future integration has it to hand.
 *
 * Why the column is authoritative and this is not:
 * - a Clerk outage or a rate-limited write must never lock a paying tenant out
 *   of what they bought, nor silently unlock a Basic tenant;
 * - Clerk Billing was evaluated and rejected (Stripe underneath,
 *   cannabis-adjacent), so there is no billing truth in Clerk to defer to.
 *
 * Never throws. Callers (US-012's super-admin plan selector) commit the column
 * first, then call this and surface `{ mirrored: false }` as a soft warning.
 */

import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { parseTenantSettings } from "@/lib/tenant/tenant-settings";
import type { Plan } from "./plan";

export interface PlanMirrorResult {
  mirrored: boolean;
  /** Machine-readable failure cause — for a UI warning, never for a gate. */
  reason?: "no_clerk_org" | "clerk_write_failed";
}

/**
 * Push `plan` onto the tenant's Clerk org `publicMetadata`.
 *
 * The Clerk org id lives in `tenants.settings.clerkOrgId` (written at
 * onboarding — `app/api/onboarding/route.ts`); `tenants.id` is a separate UUID,
 * not the org id. Read through the sanctioned parse-on-read helper so a
 * malformed settings blob degrades to "no org" instead of throwing.
 *
 * `updateOrganizationMetadata` merges top-level keys, so the `nftTokenId` /
 * `countryCode` written at onboarding survive.
 */
export async function mirrorPlanToClerkOrg(
  tenantId: string,
  plan: Plan,
): Promise<PlanMirrorResult> {
  try {
    const row: { settings: unknown } | null = await prisma.tenants.findFirst({
      where: { id: tenantId },
      select: { settings: true },
    });
    const clerkOrgId = parseTenantSettings(row?.settings, { tenantId }).clerkOrgId;

    if (!clerkOrgId) {
      logger.warn("[entitlements] plan mirror skipped — tenant has no Clerk org", {
        tenantId,
        plan,
      });
      return { mirrored: false, reason: "no_clerk_org" };
    }

    const client = await clerkClient();
    await client.organizations.updateOrganizationMetadata(clerkOrgId, {
      publicMetadata: { plan },
    });

    logger.info("[entitlements] plan mirrored to Clerk org", { tenantId, plan });
    return { mirrored: true };
  } catch (error) {
    // Soft failure by design: the column already carries the truth.
    logger.error("[entitlements] plan mirror to Clerk failed — column stands", {
      tenantId,
      plan,
      message: error instanceof Error ? error.message : String(error),
    });
    return { mirrored: false, reason: "clerk_write_failed" };
  }
}
