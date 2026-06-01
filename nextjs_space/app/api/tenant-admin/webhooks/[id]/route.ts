import { NextResponse } from "next/server";
import { withTenantAuthParams } from "@/lib/api-auth";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";
import { apiError, apiValidationError } from "@/lib/api-error";
import { parseUuid } from "@/lib/validation/parse-uuid";
import { parseJsonBody } from "@/lib/validation/body";
import { assertSafeWebhookUrl } from "@/lib/integrations/webhook-ssrf";

const webhookUpdateSchema = z
  .object({
    url: z.string().url().max(2000).optional(),
    events: z.array(z.string().min(1).max(100)).min(1).max(50).optional(),
    description: z.string().max(1000).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

/**
 * PATCH /api/tenant-admin/webhooks/[id]
 *
 * Update a webhook
 */
export const PATCH = withTenantAuthParams(async (req, { user, tenantId }, params) => {
  try {
    const id = parseUuid(params.id);
    const { url, events, description, isActive } = await parseJsonBody(
      req,
      webhookUpdateSchema,
    );

    // Verify webhook belongs to tenant
    const existingWebhook = await prisma.webhooks.findFirst({
      where: { id, tenantId },
    });

    if (!existingWebhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    // SSRF egress guard — same check as creation (generic message, no leak).
    // URL format is already validated by webhookUpdateSchema (z.string().url()).
    if (url) {
      try {
        await assertSafeWebhookUrl(url);
      } catch {
        return apiValidationError(
          "Webhook URL is not allowed. Use a public HTTPS endpoint.",
          "tenant-admin/webhooks/[id]",
        );
      }
    }

    const webhook = await prisma.webhooks.update({
      where: { id },
      data: {
        ...(url && { url }),
        ...(events && { events }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    // Log the action
    const clientInfo = getClientInfo(req.headers);
    await createAuditLog({
      action: AUDIT_ACTIONS.WEBHOOK_UPDATED,
      entityType: "Webhook",
      entityId: webhook.id,
      userId: user.id,
      userEmail: user.email!,
      tenantId,
      metadata: { url, events, description, isActive },
      ...clientInfo,
    });

    return NextResponse.json({ webhook });
  } catch (error) {
    return apiError(error, { route: "PATCH /api/tenant-admin/webhooks/[id]" });
  }
});

/**
 * DELETE /api/tenant-admin/webhooks/[id]
 *
 * Delete a webhook
 */
export const DELETE = withTenantAuthParams(async (req, { user, tenantId }, params) => {
  try {
    const id = parseUuid(params.id);

    // Verify webhook belongs to tenant
    const existingWebhook = await prisma.webhooks.findFirst({
      where: { id, tenantId },
    });

    if (!existingWebhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    await prisma.webhooks.delete({
      where: { id },
    });

    // Log the action
    const clientInfo = getClientInfo(req.headers);
    await createAuditLog({
      action: AUDIT_ACTIONS.WEBHOOK_DELETED,
      entityType: "Webhook",
      entityId: id,
      userId: user.id,
      userEmail: user.email!,
      tenantId,
      metadata: { webhookUrl: existingWebhook.url },
      ...clientInfo,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, { route: "DELETE /api/tenant-admin/webhooks/[id]" });
  }
});
