import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import crypto from "crypto";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";
import { apiError, apiValidationError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";
import { assertSafeWebhookUrl } from "@/lib/webhook-ssrf";

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
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "TENANT_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: "No tenant associated with user" },
        { status: 400 },
      );
    }

    const webhooks = await prisma.webhooks.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { deliveries: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ webhooks });
  } catch (error) {
    console.error("[API] Error fetching webhooks:", error);
    return NextResponse.json(
      { error: "Failed to fetch webhooks" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/tenant-admin/webhooks
 *
 * Create a new webhook for the tenant
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "TENANT_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: "No tenant associated with user" },
        { status: 400 },
      );
    }

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
}
