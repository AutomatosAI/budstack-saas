import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { triggerWebhook, WEBHOOK_EVENTS } from "@/lib/webhook";
import { verifyDrGreenWebhookSignature } from "@/lib/drgreen-webhook-verify";
import { decrypt } from "@/lib/encryption";

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
    const body = JSON.parse(rawBody);

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
        { error: "Missing order ID" },
        { status: 400 },
      );
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

      // Log webhook anyway for audit
      await prisma.drgreen_webhook_logs.create({
        data: {
          id: crypto.randomUUID(),
          tenantId: "unknown",
          webhookType: "crypto",
          drGreenOrderId: custom_data2,
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
        console.error("[Crypto Webhook] Signature verification failed");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
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
    await prisma.drgreen_webhook_logs.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: order.tenantId,
        webhookType: "crypto",
        orderId: order.id,
        drGreenOrderId: custom_data2,
        payload: body,
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
        try { return JSON.parse(rawBody); }
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
