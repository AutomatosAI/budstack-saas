import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { triggerWebhook, WEBHOOK_EVENTS } from "@/lib/webhook";
import {
  verifyDrGreenWebhookSignature,
  validateWebhookTimestamp,
  sanitizeForLogging,
} from "@/lib/drgreen-webhook-verify";
import { decrypt } from "@/lib/encryption";

// SECURITY (C14, M9): Cap payload size to prevent DoS from oversized POSTs
// pre-routing. CoinRemitter webhooks are typically <2KB; 100KB is a generous
// cap that still rejects abusive payloads before JSON.parse.
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
 * Crypto Payment Webhook Handler (CoinRemitter)
 *
 * Handles payment notifications from CoinRemitter for crypto payments:
 * - TCN (testnet)
 * - USDT
 * - ETH
 * - BTC
 */
export async function POST(request: NextRequest) {
  let rawBody = "";

  try {
    rawBody = await request.text();

    // SECURITY (C14, M9): Reject oversized payloads before parse.
    if (rawBody.length > MAX_WEBHOOK_BODY_BYTES) {
      console.error("[Crypto Webhook] Payload too large:", rawBody.length);
      return NextResponse.json(
        { error: "Payload too large" },
        { status: 413 },
      );
    }

    const body = JSON.parse(rawBody);

    // SECURITY (H_a7): Sanitize payload before logging — custom_data1 is
    // customer email and other fields may contain PII.
    if (process.env.NODE_ENV === 'development') {
      console.log("[Crypto Webhook] Received:", sanitizeForLogging(body));
    }

    // SECURITY (C14): Replay protection — reject webhooks with stale or
    // missing timestamps. CoinRemitter includes `timestamp` (unix seconds)
    // or `created_at` (ISO). If neither is present in production, reject.
    const tsRaw = body?.timestamp ?? body?.created_at;
    const tsNormalized = normalizeTimestamp(tsRaw);
    if (tsNormalized) {
      const tsCheck = validateWebhookTimestamp(tsNormalized);
      if (!tsCheck.valid) {
        console.error(
          `[Crypto Webhook] Replay protection rejected: ${tsCheck.reason}`,
        );
        return NextResponse.json(
          { error: `Webhook replay rejected: ${tsCheck.reason}` },
          { status: 400 },
        );
      }
    } else if (process.env.NODE_ENV === "production") {
      // No timestamp in prod — strict rejection. Captured-and-replayed
      // webhooks have no timestamp forgery defense without this.
      console.error("[Crypto Webhook] Missing timestamp in production payload");
      return NextResponse.json(
        { error: "Missing timestamp" },
        { status: 400 },
      );
    }

    // Extract key fields from webhook payload
    const {
      invoice_id,
      status,
      status_code,
      coin,
      usd_amount,
      address,
      custom_data1, // Customer email
      custom_data2, // Dr. Green Order ID
    } = body;

    if (!custom_data2) {
      console.error(
        "[Crypto Webhook] Missing Dr. Green Order ID (custom_data2)",
      );
      return NextResponse.json(
        { error: "Missing order ID" },
        { status: 400 },
      );
    }

    // SECURITY (US-012, AC-6): verify-before-resolve. When a platform-level
    // DRGREEN_WEBHOOK_SECRET is set, authenticate the HMAC signature BEFORE the
    // orders.findFirst() below runs on the attacker-controlled order id — a
    // forged payload is rejected here with zero DB access. Flag-gated: when
    // unset, the existing per-tenant resolve-then-verify path runs unchanged.
    const signature = request.headers.get("x-webhook-signature") || "";
    const platformSecret = process.env.DRGREEN_WEBHOOK_SECRET;
    let verifiedByPlatformSecret = false;
    if (platformSecret) {
      if (!verifyDrGreenWebhookSignature(rawBody, signature, platformSecret)) {
        console.error(
          "[Crypto Webhook] Platform-secret signature verification failed (pre-resolve)",
        );
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
      verifiedByPlatformSecret = true;
    }

    // Find order by Dr. Green Order ID
    const order = await prisma.orders.findFirst({
      where: {
        drGreenOrderId: custom_data2,
      },
      include: {
        tenants: true,
        users: true,
      },
    });

    if (!order) {
      console.error("[Crypto Webhook] Order not found:", custom_data2);

      // Log webhook anyway for audit (sanitized — even unknown-order
      // webhooks may carry PII in custom_data1).
      await prisma.drgreen_webhook_logs.create({
        data: {
          id: crypto.randomUUID(),
          tenantId: "unknown",
          webhookType: "crypto",
          drGreenOrderId: custom_data2,
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
        console.error("[Crypto Webhook] Signature verification failed");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } else if (process.env.NODE_ENV === 'production') {
      console.error("[Crypto Webhook] No drGreenSecretKey configured, rejecting");
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 401 });
    }

    // Map CoinRemitter status codes to payment status
    // 0 = Pending, 1 = Paid, 2 = Overpaid, 3 = Underpaid, 4 = Expired, 5 = Cancelled
    let paymentStatus:
      | "PENDING"
      | "PAID"
      | "OVERPAID"
      | "UNDERPAID"
      | "EXPIRED"
      | "CANCELLED"
      | "FAILED";

    switch (status_code) {
      case 1:
        paymentStatus = "PAID";
        break;
      case 2:
        paymentStatus = "OVERPAID";
        break;
      case 3:
        paymentStatus = "UNDERPAID";
        break;
      case 4:
        paymentStatus = "EXPIRED";
        break;
      case 5:
        paymentStatus = "CANCELLED";
        break;
      default:
        paymentStatus = "PENDING";
    }

    // SECURITY (H_a8): Idempotency — if this exact (invoice_id, status) pair
    // is already recorded, short-circuit instead of re-firing downstream
    // BudStacks webhooks. Replay defence-in-depth on top of the timestamp
    // check above.
    if (
      invoice_id &&
      order.drGreenInvoiceNum === invoice_id &&
      order.paymentStatus === paymentStatus
    ) {
      console.log(
        "[Crypto Webhook] Duplicate webhook ignored (already at status):",
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
        drGreenInvoiceNum: invoice_id,
        // If paid, mark order as confirmed
        ...(paymentStatus === "PAID" && { status: "CONFIRMED" }),
      },
    });

    // Log webhook (with sanitized payload — never persist raw PII).
    await prisma.drgreen_webhook_logs.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: order.tenantId,
        webhookType: "crypto",
        orderId: order.id,
        drGreenOrderId: custom_data2,
        payload: sanitizeForLogging(body),
        processed: true,
        processedAt: new Date(),
      },
    });

    // Trigger BudStacks webhook if payment successful
    if (paymentStatus === "PAID") {
      await triggerWebhook({
        event: WEBHOOK_EVENTS.ORDER_CONFIRMED,
        tenantId: order.tenantId,
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          drGreenOrderId: custom_data2,
          paymentMethod: `CRYPTO_${coin}`,
          amount: parseFloat(usd_amount || "0"),
          invoiceId: invoice_id,
          customerEmail: custom_data1,
        },
      });

      console.log("[Crypto Webhook] Order paid successfully:", order.id);
    }

    return NextResponse.json({
      message: "Webhook processed",
      orderId: order.id,
      paymentStatus,
    });
  } catch (error) {
    console.error("[Crypto Webhook] Error:", error);

    try {
      const errorPayload = (() => {
        try { return sanitizeForLogging(JSON.parse(rawBody)); }
        catch { return { raw: rawBody?.substring(0, 500) || "empty" }; }
      })();
      await prisma.drgreen_webhook_logs.create({
        data: {
          id: crypto.randomUUID(),
          tenantId: "unknown",
          webhookType: "crypto",
          payload: errorPayload,
          processed: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    } catch (logError) {
      console.error("[Crypto Webhook] Failed to log error:", logError);
    }

    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
