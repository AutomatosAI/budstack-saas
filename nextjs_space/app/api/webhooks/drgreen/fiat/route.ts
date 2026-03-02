import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { triggerWebhook, WEBHOOK_EVENTS } from "@/lib/webhook";
import { verifyDrGreenWebhookSignature } from "@/lib/drgreen-webhook-verify";
import { decrypt } from "@/lib/encryption";

/**
 * Fiat Payment Webhook Handler (Pay-Inn)
 *
 * Handles payment notifications from Pay-Inn for fiat (credit card) payments
 */
export async function POST(request: NextRequest) {
  let rawBody = "";

  try {
    rawBody = await request.text();
    const body = JSON.parse(rawBody);

    if (process.env.NODE_ENV === 'development') {
      console.log("[Fiat Webhook] Received:", JSON.stringify(body, null, 2));
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

      // Log webhook anyway for audit
      await prisma.drgreen_webhook_logs.create({
        data: {
          id: crypto.randomUUID(),
          tenantId: "unknown",
          webhookType: "fiat",
          payload: body,
          processed: false,
          error: "Order not found",
        },
      });

      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Verify signature using tenant's secret
    const signature = request.headers.get("x-webhook-signature") || "";
    if (order.tenants?.drGreenSecretKey) {
      const secret = decrypt(order.tenants.drGreenSecretKey, {
        allowUnencryptedMigration: true,
        migrationDeadline: "2026-12-31",
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

    // Log webhook
    await prisma.drgreen_webhook_logs.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: order.tenantId,
        webhookType: "fiat",
        orderId: order.id,
        drGreenOrderId: order.drGreenOrderId || undefined,
        payload: body,
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
        try { return JSON.parse(rawBody); }
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
