import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/permissions/require-permission";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";
import { AUDIT_ACTIONS, createAuditLog, getClientInfo } from "@/lib/audit-log";
import { FEATURES, getTenantFeatures, hasFeature } from "@/lib/entitlements/features";

const wireModeSchema = z.object({
  wireMode: z.enum(["MANUAL", "ASSISTED"]),
});

/**
 * US-013: The Wire mode. Switching TO ASSISTED requires the automatos.wire
 * entitlement (server-enforced, mirroring the chatbot toggle's US-005
 * pattern); switching back to MANUAL is always allowed.
 */
export const PATCH = requirePermission("canEditSettings", async (req, { user, tenantId }) => {
  try {
    const body = await parseJsonBody(req, wireModeSchema);

    if (
      body.wireMode === "ASSISTED" &&
      !hasFeature(getTenantFeatures({ id: tenantId }), FEATURES.AUTOMATOS_WIRE)
    ) {
      return NextResponse.json(
        { error: "Assisted Wire is a Pro feature. Upgrade to enable it." },
        { status: 403 },
      );
    }

    await prisma.tenants.update({
      where: { id: tenantId },
      data: { wireMode: body.wireMode },
    });

    const { ipAddress, userAgent } = getClientInfo(req.headers);
    await createAuditLog({
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      entityType: "Tenant",
      entityId: tenantId,
      userId: user.id,
      userEmail: user.email,
      tenantId,
      metadata: { source: "wire-mode", wireMode: body.wireMode },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, wireMode: body.wireMode });
  } catch (error) {
    return apiError(error, {
      route: "PATCH /api/tenant-admin/wire-mode",
      safeMessage: "Failed to change Wire mode",
    });
  }
});
