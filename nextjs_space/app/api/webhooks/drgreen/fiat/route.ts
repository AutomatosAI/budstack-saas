import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { triggerWebhook, WEBHOOK_EVENTS } from "@/lib/integrations/webhook";
import {
  verifyDrGreenWebhookSignature,
  validateWebhookTimestamp,
  sanitizeForLogging,
} from "@/lib/drgreen/drgreen-webhook-verify";
import { decrypt } from "@/lib/security/encryption";

// SECURITY (C14, M9): Cap payload size to prevent DoS from oversized POSTs.
const MAX_WEBHOOK_BODY_BYTES = 100_000;

/**
 * Normalize a timestamp value (string ISO, numeric unix-seconds, or
 * numeric unix-ms) into an ISO string for the shared validator.
 */
function normalizeTimestamp(raw: unknown): string | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const ms = raw > 10_000_000_000 ? raw : raw * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof raw === "string" && raw.length > 0) {
    if (/^\d+$/.test(raw)) {
      const num = parseInt(raw, 10);
      const ms = num > 10_000_000_000 ? num : num * 1000;
      return new Date(ms).toISOString();
    }
    return raw;
  }
  return null;
}

/**
 * Fiat Payment Webhook Handler (Pay-Inn)
 *
 * Handles payment notifications from Pay-Inn for fiat (credit card) payments
 */
export async function POST(request: NextRequest) {
  let rawBody = "";

  try {
    rawBody = await request.text();

    // SECURITY (C14, M9): Reject oversized payloads before parse.
    if (rawBody.length > MAX_WEBHOOK_BODY_BYTES) {
      console.error("[Fiat Webhook] Payload too large:", rawBody.length);
      return NextResponse.json(
        { error: "Payload too large" },
        { status: 413 },
      );
    }

    const body = JSON.parse(rawBody);

    // SECURITY (H_a7): Sanitize payload before logging.
    if (process.env.NODE_ENV === 'development') {
      console.log("[Fiat Webhook] Received:", sanitizeForLogging(body));
    }

    // SECURITY (C14): Replay protection — reject stale or future-dated
    // webhooks. Pay-Inn sends `timestamp` (ISO) or `created_at` on payloads.
    const tsRaw = body?.timestamp ?? body?.created_at;
    const tsNormalized = normalizeTimestamp(tsRaw);
    if (tsNormalized) {
      const tsCheck = validateWebhookTimestamp(tsNormalized);
      if (!tsCheck.valid) {
        console.error(
          `[Fiat Webhook] Replay protection rejected: ${tsCheck.reason}`,
        );
        return NextResponse.json(
          { error: `Webhook replay rejected: ${tsCheck.reason}` },
          { status: 400 },
        );
      }
    } else if (process.env.NODE_ENV === "production") {
      console.error("[Fiat Webhook] Missing timestamp in production payload");
      return NextResponse.json(
        { error: "Missing timestamp" },
        { status: 400 },
      );
    }

    // Extract key fields from webhook payload
    const {
      payment_id,
      status,
      code,
      amount,
      currency,
      custom, // Nonce for order lookup
    } = body;

    if (!custom) {
      console.error("[Fiat Webhook] Missing nonce (custom field)");
      return NextResponse.json({ error: "Missing nonce" }, { status: 400 });
    }

    // SECURITY (US-012, AC-6): verify-before-resolve. When a platform-level
    // DRGREEN_WEBHOOK_SECRET is set, authenticate the HMAC signature BEFORE the
    // orders.findFirst() below runs on the attacker-controlled nonce — a forged
    // payload is rejected here with zero DB access. Flag-gated: when unset, the
    // existing per-tenant resolve-then-verify path below runs unchanged.
    const signature = request.headers.get("x-webhook-signature") || "";
    const platformSecret = process.env.DRGREEN_WEBHOOK_SECRET;
    let verifiedByPlatformSecret = false;
    if (platformSecret) {
      if (!verifyDrGreenWebhookSignature(rawBody, signature, platformSecret)) {
        console.error(
          "[Fiat Webhook] Platform-secret signature verification failed (pre-resolve)",
        );
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
      verifiedByPlatformSecret = true;
    }

    // Find order by nonce
    const order = await prisma.orders.findFirst({
      where: {
        nonce: custom,
      },
      include: {
        tenants: true,
        users: true,
      },
    });

    if (!order) {
      console.error("[Fiat Webhook] Order not found for nonce:", custom);

      // Log webhook anyway for audit (sanitized).
      await prisma.drgreen_webhook_logs.create({
        data: {
          id: crypto.randomUUID(),
          tenantId: "unknown",
          webhookType: "fiat",
          payload: sanitizeForLogging(body),
          processed: false,
          error: "Order not found",
        },
      });

      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Verify signature using tenant's secret
    if (verifiedByPlatformSecret) {
      // Already authenticated against the platform secret before resolve (US-012).
    } else if (order.tenants?.drGreenSecretKey) {
      const secret = decrypt(order.tenants.drGreenSecretKey, {
        allowUnencryptedMigration: true,
      });
      if (!verifyDrGreenWebhookSignature(rawBody, signature, secret)) {
        console.error("[Fiat Webhook] Signature verification failed");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } else if (process.env.NODE_ENV === 'production') {
      console.error("[Fiat Webhook] No drGreenSecretKey configured, rejecting");
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 401 });
    }

    // Map Pay-Inn status to payment status
    // status: 'OK' | 'FAILED', code: 200 | 400+
    let paymentStatus: "PAID" | "FAILED" | "PENDING";

    if (status === "OK" && code === 200) {
      paymentStatus = "PAID";
    } else if (status === "FAILED" || code >= 400) {
      paymentStatus = "FAILED";
    } else {
      paymentStatus = "PENDING";
    }

    // SECURITY (H_a8): Idempotency — short-circuit if this exact
    // (payment_id, status) combo has already been recorded. The fiat path
    // also clears `nonce` after first processing, but a defence-in-depth
    // explicit check protects against missed-update races.
    if (
      payment_id &&
      order.drGreenInvoiceNum === payment_id &&
      order.paymentStatus === paymentStatus
    ) {
      console.log(
        "[Fiat Webhook] Duplicate webhook ignored (already at status):",
        order.id,
        paymentStatus,
      );
      return NextResponse.json({
        message: "Already processed",
        orderId: order.id,
        paymentStatus,
      });
    }

    // Update order payment status
    const updatedOrder = await prisma.orders.update({
      where: { id: order.id },
      data: {
        paymentStatus,
        drGreenInvoiceNum: payment_id,
        nonce: null, // Clear nonce after processing
        // If paid, mark order as confirmed
        ...(paymentStatus === "PAID" && { status: "CONFIRMED" }),
      },
    });

    // Log webhook (sanitized — never persist raw PII).
    await prisma.drgreen_webhook_logs.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: order.tenantId,
        webhookType: "fiat",
        orderId: order.id,
        drGreenOrderId: order.drGreenOrderId || undefined,
        payload: sanitizeForLogging(body),
        processed: true,
        processedAt: new Date(),
      },
    });

    // Trigger BudStacks webhook
    if (paymentStatus === "PAID") {
      await triggerWebhook({
        event: WEBHOOK_EVENTS.ORDER_CONFIRMED,
        tenantId: order.tenantId,
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          drGreenOrderId: order.drGreenOrderId,
          paymentMethod: "FIAT",
          amount: parseFloat(amount || "0"),
          currency: currency || "USD",
          invoiceId: payment_id,
          customerEmail: order.users.email,
        },
      });

      console.log("[Fiat Webhook] Order paid successfully:", order.id);
    } else if (paymentStatus === "FAILED") {
      await triggerWebhook({
        event: WEBHOOK_EVENTS.ORDER_CANCELLED,
        tenantId: order.tenantId,
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          reason: "Payment failed",
          customerEmail: order.users.email,
        },
      });

      console.log("[Fiat Webhook] Payment failed for order:", order.id);
    }

    return NextResponse.json({
      message: "Webhook processed",
      orderId: order.id,
      paymentStatus,
    });
  } catch (error) {
    console.error("[Fiat Webhook] Error:", error);

    try {
      const errorPayload = (() => {
        try { return sanitizeForLogging(JSON.parse(rawBody)); }
        catch { return { raw: rawBody?.substring(0, 500) || "empty" }; }
      })();
      await prisma.drgreen_webhook_logs.create({
        data: {
          id: crypto.randomUUID(),
          tenantId: "unknown",
          webhookType: "fiat",
          payload: errorPayload,
          processed: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    } catch (logError) {
      console.error("[Fiat Webhook] Failed to log error:", logError);
    }

    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
