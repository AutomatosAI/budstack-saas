import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/security/encryption";
import {
  verifyDrGreenWebhookSignature,
  validateWebhookTimestamp,
  validateWebhookPayload,
  sanitizeForLogging,
  type DrGreenWebhookPayload,
} from "@/lib/drgreen/drgreen-webhook-verify";
import { dispatchEvent } from "@/lib/drgreen/status-event-handlers";
import { apiError, apiValidationError } from "@/lib/api-error";

// SECURITY (C14, M9): Cap payload size to prevent DoS from oversized POSTs.
const MAX_WEBHOOK_BODY_BYTES = 100_000;

/**
 * Dr Green Status Webhook Handler
 *
 * Central POST handler for all non-payment Dr Green callbacks:
 * KYC status, client approval, order shipping, inventory changes.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // SECURITY (C14, M9): Reject oversized payloads before parse.
  if (rawBody.length > MAX_WEBHOOK_BODY_BYTES) {
    console.error("[DrGreen Status] Payload too large:", rawBody.length);
    return apiError(new Error("Payload too large"), {
      route: "POST /api/webhooks/drgreen/status",
      status: 413,
      safeMessage: "Payload too large",
    });
  }

  let payload: DrGreenWebhookPayload;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return apiValidationError("Invalid JSON", "POST /api/webhooks/drgreen/status");
  }

  // Validate payload structure
  if (!validateWebhookPayload(payload)) {
    return apiValidationError(
      "Invalid payload structure",
      "POST /api/webhooks/drgreen/status",
    );
  }

  // Validate timestamp (anti-replay)
  const tsResult = validateWebhookTimestamp(payload.timestamp);
  if (!tsResult.valid) {
    return apiValidationError(
      tsResult.reason ?? "Invalid timestamp",
      "POST /api/webhooks/drgreen/status",
    );
  }

  const { event, clientId, orderId, strainId } = payload;
  const signature = request.headers.get("x-webhook-signature") || "";

  // SECURITY (US-011, AC-6): verify-before-resolve. When a platform-level
  // DRGREEN_WEBHOOK_SECRET is provisioned, authenticate the webhook with it
  // BEFORE any tenant-resolution DB query touches attacker-controlled body
  // identifiers (clientId/orderId/strainId). Timestamp + structure are already
  // validated above. A forged payload is rejected here with zero DB access and
  // no log row (cheap rejection — avoids unauthenticated log-flooding).
  //
  // Flag-gated: when the env var is unset (the default until Dr Green confirms
  // they sign with one platform secret), this block is skipped and the existing
  // per-tenant resolve-then-verify path below runs EXACTLY as before.
  const platformSecret = process.env.DRGREEN_WEBHOOK_SECRET;
  let verifiedByPlatformSecret = false;
  if (platformSecret) {
    if (!verifyDrGreenWebhookSignature(rawBody, signature, platformSecret)) {
      console.error(
        "[DrGreen Status] Platform-secret signature verification failed (pre-resolve)",
      );
      return apiError(new Error("Invalid signature"), {
        route: "POST /api/webhooks/drgreen/status",
        status: 401,
        safeMessage: "Invalid signature",
      });
    }
    verifiedByPlatformSecret = true;
  }

  console.log(
    `[DrGreen Status] Event: ${event}`,
    sanitizeForLogging({ clientId, orderId, strainId }),
  );

  try {
    // --- Tenant Resolution ---
    const resolved = await resolveTenant(event, { clientId, orderId, strainId });

    if (!resolved) {
      console.error("[DrGreen Status] Could not resolve tenant for event:", event);
      await logWebhook("unknown", event, payload, false, "Tenant not found");
      return apiError(new Error("Tenant not found"), {
        route: "POST /api/webhooks/drgreen/status",
        status: 404,
        safeMessage: "Tenant not found",
      });
    }

    // --- Signature Verification (per-tenant secret) ---
    if (verifiedByPlatformSecret) {
      // Already authenticated against the platform secret before tenant
      // resolution (US-011). The per-tenant secret would not match the one
      // that signed this request, so the per-tenant check is skipped.
    } else if (resolved.tenantSecret) {
      const secret = decrypt(resolved.tenantSecret, {
        allowUnencryptedMigration: true,
      });
      if (!verifyDrGreenWebhookSignature(rawBody, signature, secret)) {
        console.error("[DrGreen Status] Signature verification failed");
        await logWebhook(resolved.tenantId, event, payload, false, "Invalid signature");
        return apiError(new Error("Invalid signature"), {
          route: "POST /api/webhooks/drgreen/status",
          status: 401,
          safeMessage: "Invalid signature",
        });
      }
    } else {
      // No secret configured — reject in production, allow in dev
      if (process.env.NODE_ENV === 'production') {
        console.error("[DrGreen Status] No drGreenSecretKey configured for tenant, rejecting webhook");
        await logWebhook(resolved.tenantId, event, payload, false, "No webhook secret configured");
        return apiError(new Error("Webhook secret not configured"), {
          route: "POST /api/webhooks/drgreen/status",
          status: 401,
          safeMessage: "Webhook secret not configured",
        });
      }
      console.warn("[DrGreen Status] No drGreenSecretKey configured for tenant, skipping signature check (dev mode)");
    }

    // --- Dispatch to Event Handler ---
    // For inventory events that may affect multiple tenants
    if (resolved.tenantIds) {
      for (const tid of resolved.tenantIds) {
        await handleEvent(event, tid, payload);
      }
    } else {
      await handleEvent(event, resolved.tenantId, payload);
    }

    return NextResponse.json({ message: "Webhook processed", event });
  } catch (error) {
    console.error("[DrGreen Status] Error:", error);

    try {
      await logWebhook(
        "unknown",
        event,
        payload,
        false,
        error instanceof Error ? error.message : "Unknown error",
      );
    } catch (logErr) {
      console.error("[DrGreen Status] Failed to log error:", logErr);
    }

    return apiError(error, {
      route: "POST /api/webhooks/drgreen/status",
      safeMessage: "Webhook processing failed",
    });
  }
}

// =============================================================================
// Tenant Resolution
// =============================================================================

interface ResolvedTenant {
  tenantId: string;
  tenantIds?: string[];
  tenantSecret?: string | null;
  consultation?: any;
  user?: any;
  order?: any;
}

async function resolveTenant(
  event: string,
  ids: { clientId?: string; orderId?: string; strainId?: string },
): Promise<ResolvedTenant | null> {
  // KYC / Client events: resolve via clientId
  if (ids.clientId && (event.startsWith("kyc.") || event.startsWith("client."))) {
    // Try consultation_questionnaires first
    const consultation = await prisma.consultation_questionnaires.findFirst({
      where: { drGreenClientId: ids.clientId },
    });

    if (consultation?.tenantId) {
      const tenant = await prisma.tenants.findUnique({
        where: { id: consultation.tenantId },
      });
      return {
        tenantId: consultation.tenantId,
        tenantSecret: tenant?.drGreenSecretKey,
        consultation,
      };
    }

    // Fallback: users table
    const user = await prisma.users.findFirst({
      where: { drGreenClientId: ids.clientId },
    });

    if (user?.tenantId) {
      const tenant = await prisma.tenants.findUnique({
        where: { id: user.tenantId },
      });
      return {
        tenantId: user.tenantId,
        tenantSecret: tenant?.drGreenSecretKey,
        user,
      };
    }

    return null;
  }

  // Order events: resolve via orderId
  if (ids.orderId && (event.startsWith("order.") || event.startsWith("payment."))) {
    const order = await prisma.orders.findFirst({
      where: { drGreenOrderId: ids.orderId },
      include: { users: true, tenants: true },
    });

    if (order) {
      return {
        tenantId: order.tenantId,
        tenantSecret: order.tenants.drGreenSecretKey,
        order,
      };
    }

    return null;
  }

  // Inventory events: resolve via strainId, broadcast to all affected tenants
  if (ids.strainId && (event.startsWith("inventory.") || event.startsWith("stock."))) {
    // Find all products matching this strainId (could be across tenants)
    // strainId maps to product slug or an external identifier stored in products
    const products = await prisma.products.findMany({
      where: {
        OR: [
          { slug: ids.strainId },
          { id: ids.strainId },
        ],
      },
      include: { tenants: true },
    });

    if (products.length > 0) {
      const tenantIds = Array.from(new Set(products.map((p: any) => p.tenantId))) as string[];
      return {
        tenantId: tenantIds[0],
        tenantIds,
        tenantSecret: products[0].tenants.drGreenSecretKey,
      };
    }

    return null;
  }

  return null;
}

// =============================================================================
// Event Handler Dispatch
// =============================================================================

async function handleEvent(
  event: string,
  tenantId: string,
  payload: DrGreenWebhookPayload,
) {
  // Log webhook receipt (mark as processing, updated to processed after handler)
  const logId = crypto.randomUUID();
  await logWebhook(tenantId, event, payload, false, undefined, logId);

  try {
    await dispatchEvent(event, tenantId, payload);

    // Mark as processed after successful handling
    try {
      await prisma.drgreen_webhook_logs.update({
        where: { id: logId },
        data: { processed: true, processedAt: new Date() },
      });
    } catch {}
  } catch (err) {
    // Update log with error
    try {
      await prisma.drgreen_webhook_logs.update({
        where: { id: logId },
        data: { error: err instanceof Error ? err.message : "Handler failed" },
      });
    } catch {}
    throw err;
  }
}


// =============================================================================
// Helpers
// =============================================================================

async function findUserByClientId(clientId: string) {
  // Try consultation first to get email, then user
  const consultation = await prisma.consultation_questionnaires.findFirst({
    where: { drGreenClientId: clientId },
  });

  if (consultation) {
    const user = await prisma.users.findFirst({
      where: { email: consultation.email },
    });
    return user || {
      email: consultation.email,
      name: `${consultation.firstName} ${consultation.lastName}`,
      firstName: consultation.firstName,
    };
  }

  return prisma.users.findFirst({ where: { drGreenClientId: clientId } });
}

async function logWebhook(
  tenantId: string,
  event: string,
  payload: DrGreenWebhookPayload,
  processed: boolean,
  error?: string,
  id?: string,
) {
  try {
    await prisma.drgreen_webhook_logs.create({
      data: {
        id: id || crypto.randomUUID(),
        tenantId,
        webhookType: "status",
        drGreenOrderId: payload.orderId || undefined,
        drGreenClientId: payload.clientId || undefined,
        // SECURITY (H_a7): redact PII fields (email/phone/name) before
        // persisting webhook payload to drgreen_webhook_logs.
        payload: sanitizeForLogging(payload as Record<string, any>) as any,
        processed,
        processedAt: processed ? new Date() : undefined,
        error,
      },
    });
  } catch (err) {
    console.error("[DrGreen Status] Failed to log webhook:", err);
  }
}
