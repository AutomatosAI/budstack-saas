import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { triggerWebhook, WEBHOOK_EVENTS } from "@/lib/webhook";

/**
 * Fiat Payment Webhook Handler (Pay-Inn)
 *
 * Handles payment notifications from Pay-Inn for fiat (credit card) payments
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log("[Fiat Webhook] Received:", JSON.stringify(body, null, 2));

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
      return NextResponse.json({ message: "Missing nonce" }, { status: 400 });
    }

    // Find order by nonce
    const order = await prisma.orders.findFirst({
      where: {
        nonce: custom,
      },
      include: {
        tenant: true,
        user: true,
      },
    });

    if (!order) {
      console.error("[Fiat Webhook] Order not found for nonce:", custom);

      // Log webhook anyway for audit
      await prisma.drGreenWebhookLog.create({
        data: {
          tenantId: "unknown",
          webhookType: "fiat",
          payload: body,
          processed: false,
          error: "Order not found",
        },
      });

      return NextResponse.json({ message: "Order not found" }, { status: 404 });
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
    await prisma.drGreenWebhookLog.create({
      data: {
        tenantId: order.tenantId,
        webhookType: "fiat",
        orderId: order.id,
        drGreenOrderId: order.drGreenOrderId || undefined,
        payload: body,
        processed: true,
        processedAt: new Date(),
      },
    });

    // Trigger BudStack webhook
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
          customerEmail: order.user.email,
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
          customerEmail: order.user.email,
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

    // Try to log error
    try {
      const body = await request.json();
      await prisma.drGreenWebhookLog.create({
        data: {
          tenantId: "unknown",
          webhookType: "fiat",
          payload: body,
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
