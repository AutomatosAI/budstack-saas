import { NextResponse } from "next/server";
import { withTenantAuth } from "@/lib/api-auth";
import { z } from "zod";
import { prisma } from "@/lib/db";
import crypto from "crypto";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";
import { apiError, apiValidationError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";
import { assertSafeWebhookUrl } from "@/lib/integrations/webhook-ssrf";

const webhookCreateSchema = z
  .object({
    url: z.string().url().max(2000),
    events: z.array(z.string().min(1).max(100)).min(1).max(50),
    description: z.string().max(1000).optional(),
  })
  .strict();

/**
 * GET /api/tenant-admin/webhooks
 *
 * List all webhooks for the tenant
 */
export const GET = withTenantAuth(async (_request, { tenantId }) => {
  try {
    // NB: the `webhooks` relation is `webhook_deliveries` — NOT `deliveries`
    // (that is the transformed name this response exposes). Using the wrong
    // name in `_count.select` throws PrismaClientValidationError → 500.
    const webhooks = await prisma.webhooks.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { webhook_deliveries: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Match the public shape the page expects (`_count.deliveries`).
    return NextResponse.json({
      webhooks: webhooks.map(({ _count, ...webhook }: any) => ({
        ...webhook,
        _count: { deliveries: _count.webhook_deliveries },
      })),
    });
  } catch (error) {
    console.error("[API] Error fetching webhooks:", error);
    return apiError(error, {
      route: "GET /api/tenant-admin/webhooks",
      safeMessage: "Failed to fetch webhooks",
    });
  }
});

/**
 * POST /api/tenant-admin/webhooks
 *
 * Create a new webhook for the tenant
 */
export const POST = withTenantAuth(async (req, { user, tenantId }) => {
  try {
    const { url, events, description } = await parseJsonBody(
      req,
      webhookCreateSchema,
    );

    // SSRF egress guard — reject non-https / internal / private-resolving URLs
    // up front (generic message; never leak the resolved address).
    try {
      await assertSafeWebhookUrl(url);
    } catch {
      return apiValidationError(
        "Webhook URL is not allowed. Use a public HTTPS endpoint.",
        "tenant-admin/webhooks",
      );
    }

    // Generate a secret for webhook signature
    const secret = crypto.randomBytes(32).toString("hex");

    const webhook = await prisma.webhooks.create({
      data: {
        tenantId,
        url,
        events,
        secret,
        description: description || "",
        isActive: true,
      },
    });

    // Log the action
    const clientInfo = getClientInfo(req.headers);
    await createAuditLog({
      action: AUDIT_ACTIONS.WEBHOOK_CREATED,
      entityType: "Webhook",
      entityId: webhook.id,
      userId: user.id,
      userEmail: user.email || undefined,
      tenantId,
      metadata: { url, events, description },
      ...clientInfo,
    });

    return NextResponse.json({ webhook }, { status: 201 });
  } catch (error) {
    return apiError(error, {
      route: "POST /api/tenant-admin/webhooks",
      safeMessage: "Failed to create webhook",
    });
  }
});
