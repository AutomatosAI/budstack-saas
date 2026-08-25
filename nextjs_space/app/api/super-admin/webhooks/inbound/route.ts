import { NextResponse } from "next/server";
import { z } from "zod";
import { withSuperAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { apiError, apiValidationError } from "@/lib/api-error";
import { requireSameOrigin } from "@/lib/security/require-same-origin";
import { AUDIT_ACTIONS, createAuditLog, getClientInfo } from "@/lib/audit-log";
import {
  DRGREEN_CHANNEL,
  getInboundWebhookStatus,
  saveInboundWebhookSecret,
  setInboundWebhookEnabled,
} from "@/lib/drgreen/inbound-webhook-config";

/**
 * Inbound partner-webhook channel (Dr Green → BudStacks), PLATFORM scope.
 * SUPER_ADMIN only — this secret authenticates events for every tenant, so it
 * must never be reachable from tenant-admin.
 *
 * GET  → status + recent deliveries (never the secret itself)
 * PUT  → rotate the secret / enable-disable the channel
 *
 * There is no URL to configure here: the receiving endpoint is ours and fixed
 * in code (/api/webhooks/drgreen/status). What an operator manages is the
 * verification secret, the on/off switch, and visibility of what arrived.
 */

const ROUTE_GET = "GET /api/super-admin/webhooks/inbound";
const ROUTE_PUT = "PUT /api/super-admin/webhooks/inbound";

/** How many recent deliveries the console shows. */
const RECENT_LIMIT = 25;

export const GET = withSuperAdmin(async () => {
  try {
    const status = await getInboundWebhookStatus();

    // Delivery history is best-effort: the console must still render (and
    // still let an operator set the secret) if this query fails.
    let recent: Array<Record<string, unknown>> = [];
    let stats = { total: 0, processed: 0, failed: 0 };
    try {
      const [rows, total, processed, failed] = await Promise.all([
        prisma.drgreen_webhook_logs.findMany({
          where: { webhookType: "status" },
          orderBy: { createdAt: "desc" },
          take: RECENT_LIMIT,
          select: {
            id: true,
            tenantId: true,
            drGreenClientId: true,
            processed: true,
            error: true,
            createdAt: true,
            payload: true,
          },
        }),
        prisma.drgreen_webhook_logs.count({ where: { webhookType: "status" } }),
        prisma.drgreen_webhook_logs.count({ where: { webhookType: "status", processed: true } }),
        prisma.drgreen_webhook_logs.count({
          where: { webhookType: "status", error: { not: null } },
        }),
      ]);
      stats = { total, processed, failed };
      recent = rows.map((row: any) => ({
        id: row.id,
        tenantId: row.tenantId,
        clientId: row.drGreenClientId,
        // The payload is already PII-redacted on write (sanitizeForLogging);
        // only the event name is surfaced here.
        event: typeof row.payload?.event === "string" ? row.payload.event : "unknown",
        processed: row.processed,
        error: row.error,
        createdAt: row.createdAt.toISOString(),
      }));
    } catch {
      // Leave recent/stats empty — status still renders.
    }

    return NextResponse.json({
      channel: DRGREEN_CHANNEL,
      // The endpoint Dr Green must POST to. Shown for copy/paste; not editable.
      receivingPath: "/api/webhooks/drgreen/status",
      status,
      stats,
      recent,
    });
  } catch (error) {
    return apiError(error, { route: ROUTE_GET, safeMessage: "Failed to load webhook status" });
  }
});

const updateSchema = z
  .object({
    // Min length is a weak-secret guard, not a format requirement — it must
    // match whatever Dr Green signs with byte for byte.
    secret: z.string().min(16).max(512).optional(),
    isEnabled: z.boolean().optional(),
  })
  .refine((v) => v.secret !== undefined || v.isEnabled !== undefined, {
    message: "Provide a secret to rotate, an isEnabled flag, or both",
  });

export const PUT = withSuperAdmin(async (req, { user }) => {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error.errors[0]?.message ?? "Invalid request", ROUTE_PUT);
  }

  try {
    const actor = user.email ?? user.id;

    if (parsed.data.secret !== undefined) {
      await saveInboundWebhookSecret({ secret: parsed.data.secret, updatedBy: actor });
    }
    if (parsed.data.isEnabled !== undefined) {
      await setInboundWebhookEnabled({ isEnabled: parsed.data.isEnabled, updatedBy: actor });
    }

    await createAuditLog({
      action: AUDIT_ACTIONS.PLATFORM_WEBHOOK_CONFIG_UPDATED,
      entityType: "PlatformWebhookConfig",
      entityId: DRGREEN_CHANNEL,
      userId: user.id,
      userEmail: user.email ?? undefined,
      // Records THAT the secret rotated, never the value.
      metadata: {
        secretRotated: parsed.data.secret !== undefined,
        ...(parsed.data.isEnabled !== undefined ? { isEnabled: parsed.data.isEnabled } : {}),
      },
      ...getClientInfo(req.headers),
    });

    return NextResponse.json({ success: true, status: await getInboundWebhookStatus() });
  } catch (error) {
    return apiError(error, {
      route: ROUTE_PUT,
      safeMessage:
        "Failed to save webhook settings. If this persists, the platform_webhook_config table may not be provisioned yet.",
    });
  }
});
