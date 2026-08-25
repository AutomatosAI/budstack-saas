import { NextResponse } from "next/server";
import { withSuperAdminParams } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { requireSameOrigin } from "@/lib/security/require-same-origin";
import { parseUuid } from "@/lib/validation/parse-uuid";
import { AUDIT_ACTIONS, createAuditLog, getClientInfo } from "@/lib/audit-log";

/**
 * DELETE a PLATFORM outbound webhook (`webhooks` row with `tenantId: null`).
 *
 * The tenantId predicate is the authorization boundary, not a filter: without
 * it this route would delete any tenant's endpoint by id.
 */
export const DELETE = withSuperAdminParams(async (req, { user }, params) => {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const id = parseUuid(params.id);

  try {
    const result = await prisma.webhooks.deleteMany({
      where: { id, tenantId: null },
    });

    if (result.count === 0) {
      return apiError(new Error("Platform webhook not found"), {
        route: "DELETE /api/super-admin/webhooks/outbound/[id]",
        status: 404,
        safeMessage: "Webhook not found",
      });
    }

    await createAuditLog({
      action: AUDIT_ACTIONS.WEBHOOK_DELETED,
      entityType: "Webhook",
      entityId: id,
      userId: user.id,
      userEmail: user.email || undefined,
      metadata: { scope: "platform" },
      ...getClientInfo(req.headers),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, {
      route: "DELETE /api/super-admin/webhooks/outbound/[id]",
      safeMessage: "Failed to delete webhook",
    });
  }
});
