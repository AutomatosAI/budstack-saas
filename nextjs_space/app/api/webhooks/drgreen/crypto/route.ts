import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { triggerWebhook, WEBHOOK_EVENTS } from "@/lib/webhook";

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
  try {
    const body = await request.json();

    console.log("[Crypto Webhook] Received:", JSON.stringify(body, null, 2));

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
        { message: "Missing order ID" },
        { status: 400 },
      );
    }

    // Find order by Dr. Green Order ID
    const order = await prisma.orders.findFirst({
      where: {
        drGreenOrderId: custom_data2,
      },
      include: {
        tenant: true,
        user: true,
      },
    });

    if (!order) {
      console.error("[Crypto Webhook] Order not found:", custom_data2);

      // Log webhook anyway for audit
      await prisma.drGreenWebhookLog.create({
        data: {
          tenantId: "unknown",
          webhookType: "crypto",
          drGreenOrderId: custom_data2,
          payload: body,
          processed: false,
          error: "Order not found",
        },
      });

      return NextResponse.json({ message: "Order not found" }, { status: 404 });
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

    // Log webhook
    await prisma.drGreenWebhookLog.create({
      data: {
        tenantId: order.tenantId,
        webhookType: "crypto",
        orderId: order.id,
        drGreenOrderId: custom_data2,
        payload: body,
        processed: true,
        processedAt: new Date(),
      },
    });

    // Trigger BudStack webhook if payment successful
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

    // Try to log error
    try {
      const body = await request.json();
      await prisma.drGreenWebhookLog.create({
        data: {
          tenantId: "unknown",
          webhookType: "crypto",
          payload: body,
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
