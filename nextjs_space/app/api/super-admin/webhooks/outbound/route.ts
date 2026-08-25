import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { withSuperAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { apiError, apiValidationError } from "@/lib/api-error";
import { requireSameOrigin } from "@/lib/security/require-same-origin";
import { parseJsonBody } from "@/lib/validation/body";
import { assertSafeWebhookUrl } from "@/lib/integrations/webhook-ssrf";
import { AUDIT_ACTIONS, createAuditLog, getClientInfo } from "@/lib/audit-log";

/**
 * PLATFORM-scope outbound webhooks — rows in `webhooks` with `tenantId: null`.
 *
 * The tenant-admin page manages a tenant's own destinations; this manages the
 * platform's. Same table, same delivery machinery (`triggerWebhook` selects on
 * `tenantId: tenantId || null`), which is why no migration is needed — the
 * column has always been nullable.
 *
 * Scope note for operators: a platform webhook fires on PLATFORM-level events
 * only, not on every tenant's activity.
 */

const ROUTE = "/api/super-admin/webhooks/outbound";

const createSchema = z
  .object({
    url: z.string().url().max(2000),
    events: z.array(z.string().min(1).max(100)).min(1).max(50),
    description: z.string().max(1000).optional(),
  })
  .strict();

export const GET = withSuperAdmin(async () => {
  try {
    const webhooks = await prisma.webhooks.findMany({
      where: { tenantId: null },
      include: { _count: { select: { webhook_deliveries: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      webhooks: webhooks.map(({ _count, secret, ...webhook }: any) => ({
        ...webhook,
        // Signing secret is shown once at creation; never re-served on list.
        secretPreview: `${String(secret).slice(0, 6)}…`,
        _count: { deliveries: _count.webhook_deliveries },
      })),
    });
  } catch (error) {
    return apiError(error, { route: `GET ${ROUTE}`, safeMessage: "Failed to fetch webhooks" });
  }
});

export const POST = withSuperAdmin(async (req, { user }) => {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  try {
    const { url, events, description } = await parseJsonBody(req, createSchema);

    // SSRF egress guard — same rule as the tenant route: public HTTPS only,
    // never an internal/private-resolving address.
    try {
      await assertSafeWebhookUrl(url);
    } catch {
      return apiValidationError(
        "Webhook URL is not allowed. Use a public HTTPS endpoint.",
        ROUTE,
      );
    }

    const secret = crypto.randomBytes(32).toString("hex");
    const webhook = await prisma.webhooks.create({
      data: {
        // `webhooks.id` carries no DB default — set it explicitly.
        id: crypto.randomUUID(),
        tenantId: null,
        url,
        events,
        secret,
        description: description || "",
        isActive: true,
        updatedAt: new Date(),
      },
    });

    await createAuditLog({
      action: AUDIT_ACTIONS.WEBHOOK_CREATED,
      entityType: "Webhook",
      entityId: webhook.id,
      userId: user.id,
      userEmail: user.email || undefined,
      metadata: { url, events, scope: "platform" },
      ...getClientInfo(req.headers),
    });

    // Only response that ever carries the secret — the operator copies it into
    // the receiving system now or rotates by recreating the endpoint.
    return NextResponse.json({ webhook: { ...webhook, secret } }, { status: 201 });
  } catch (error) {
    return apiError(error, { route: `POST ${ROUTE}`, safeMessage: "Failed to create webhook" });
  }
});
