/**
 * Webhook System
 *
 * Sends real-time event notifications to external systems.
 * Includes signature verification (HMAC SHA256), retry logic, and delivery tracking.
 */

import { prisma } from "@/lib/db";
import crypto from "crypto";

export interface WebhookEvent {
  event: string;
  tenantId?: string;
  data: Record<string, any>;
  timestamp: string;
}

/**
 * Trigger webhooks for a specific event
 *
 * @example
 * ```ts
 * await triggerWebhook({
 *   event: 'order.completed',
 *   tenantId: tenant.id,
 *   data: {
 *     orderId: order.id,
 *     total: order.total,
 *     customerId: order.userId
 *   }
 * });
 * ```
 */
export async function triggerWebhook(params: {
  event: string;
  tenantId?: string;
  data: Record<string, any>;
}): Promise<void> {
  const { event, tenantId, data } = params;

  try {
    // Find all active webhooks subscribed to this event
    const webhooks = await prisma.webhooks.findMany({
      where: {
        isActive: true,
        tenantId: tenantId || null,
        events: {
          has: event,
        },
      },
    });

    if (webhooks.length === 0) {
      return; // No webhooks to trigger
    }

    // Prepare webhook payload
    const payload: WebhookEvent = {
      event,
      tenantId,
      data,
      timestamp: new Date().toISOString(),
    };

    // Trigger all webhooks in parallel
    await Promise.allSettled(
      webhooks.map((webhook: any) => deliverWebhook(webhook.id, payload)),
    );
  } catch (error) {
    console.error("[Webhook] Failed to trigger webhooks:", error);
  }
}

/**
 * Deliver webhook to a specific URL with retry logic
 */
async function deliverWebhook(
  webhookId: string,
  payload: WebhookEvent,
  attemptCount: number = 1,
): Promise<void> {
  try {
    const webhook = await prisma.webhooks.findUnique({
      where: { id: webhookId },
    });

    if (!webhook || !webhook.isActive) {
      return;
    }

    // Generate HMAC signature
    const signature = generateWebhookSignature(payload, webhook.secret);

    // Send webhook
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": payload.event,
        "User-Agent": "BudStack-Webhooks/1.0",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text().catch(() => "");
    const success = response.status >= 200 && response.status < 300;

    // Log delivery
    await prisma.webhookDelivery.create({
      data: {
        webhookId,
        event: payload.event,
        payload: payload as any,
        statusCode: response.status,
        response: responseText.substring(0, 1000), // Limit response length
        success,
        attemptCount,
      },
    });

    // Retry logic for failed deliveries
    if (!success && attemptCount < 3) {
      const retryDelay = Math.pow(2, attemptCount) * 1000; // Exponential backoff
      setTimeout(
        () => deliverWebhook(webhookId, payload, attemptCount + 1),
        retryDelay,
      );
    }
  } catch (error) {
    console.error(`[Webhook] Delivery failed for webhook ${webhookId}:`, error);

    // Log failed delivery
    await prisma.webhookDelivery.create({
      data: {
        webhookId,
        event: payload.event,
        payload: payload as any,
        success: false,
        attemptCount,
        response: error instanceof Error ? error.message : "Unknown error",
      },
    });

    // Retry logic
    if (attemptCount < 3) {
      const retryDelay = Math.pow(2, attemptCount) * 1000;
      setTimeout(
        () => deliverWebhook(webhookId, payload, attemptCount + 1),
        retryDelay,
      );
    }
  }
}

/**
 * Generate HMAC SHA256 signature for webhook payload
 *
 * Recipients can verify the webhook came from BudStack by computing
 * the same signature and comparing with the X-Webhook-Signature header.
 */
function generateWebhookSignature(
  payload: WebhookEvent,
  secret: string,
): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest("hex");
}

/**
 * Verify webhook signature (for webhook consumers)
 *
 * @example
 * ```ts
 * const isValid = verifyWebhookSignature(
 *   payload,
 *   signature,
 *   webhookSecret
 * );
 * ```
 */
export function verifyWebhookSignature(
  payload: WebhookEvent,
  signature: string,
  secret: string,
): boolean {
  const expectedSignature = generateWebhookSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  );
}

/**
 * Available webhook events
 */
export const WEBHOOK_EVENTS = {
  // Tenant Events
  TENANT_CREATED: "tenant.created",
  TENANT_UPDATED: "tenant.updated",
  TENANT_ACTIVATED: "tenant.activated",
  TENANT_DEACTIVATED: "tenant.deactivated",

  // Product Events
  PRODUCT_CREATED: "product.created",
  PRODUCT_UPDATED: "product.updated",
  PRODUCT_DELETED: "product.deleted",
  PRODUCT_LOW_STOCK: "product.low_stock",
  PRODUCT_OUT_OF_STOCK: "product.out_of_stock",

  // Order Events
  ORDER_CREATED: "order.created",
  ORDER_CONFIRMED: "order.confirmed",
  ORDER_SHIPPED: "order.shipped",
  ORDER_DELIVERED: "order.delivered",
  ORDER_CANCELLED: "order.cancelled",

  // Consultation Events
  CONSULTATION_SUBMITTED: "consultation.submitted",
  CONSULTATION_APPROVED: "consultation.approved",
  CONSULTATION_REJECTED: "consultation.rejected",

  // Dr. Green Payment Events
  DRGREEN_PAYMENT_RECEIVED: "drgreen.payment_received",
  DRGREEN_PAYMENT_FAILED: "drgreen.payment_failed",
  DRGREEN_ORDER_CREATED: "drgreen.order_created",
  DRGREEN_ORDER_APPROVED: "drgreen.order_approved",
} as const;

/**
 * Get webhook event categories for UI
 */
export const WEBHOOK_EVENT_CATEGORIES = [
  {
    name: "Tenant Events",
    events: [
      { value: WEBHOOK_EVENTS.TENANT_CREATED, label: "Tenant Created" },
      { value: WEBHOOK_EVENTS.TENANT_UPDATED, label: "Tenant Updated" },
      { value: WEBHOOK_EVENTS.TENANT_ACTIVATED, label: "Tenant Activated" },
      { value: WEBHOOK_EVENTS.TENANT_DEACTIVATED, label: "Tenant Deactivated" },
    ],
  },
  {
    name: "Product Events",
    events: [
      { value: WEBHOOK_EVENTS.PRODUCT_CREATED, label: "Product Created" },
      { value: WEBHOOK_EVENTS.PRODUCT_UPDATED, label: "Product Updated" },
      { value: WEBHOOK_EVENTS.PRODUCT_DELETED, label: "Product Deleted" },
      { value: WEBHOOK_EVENTS.PRODUCT_LOW_STOCK, label: "Product Low Stock" },
      {
        value: WEBHOOK_EVENTS.PRODUCT_OUT_OF_STOCK,
        label: "Product Out of Stock",
      },
    ],
  },
  {
    name: "Order Events",
    events: [
      { value: WEBHOOK_EVENTS.ORDER_CREATED, label: "Order Created" },
      { value: WEBHOOK_EVENTS.ORDER_CONFIRMED, label: "Order Confirmed" },
      { value: WEBHOOK_EVENTS.ORDER_SHIPPED, label: "Order Shipped" },
      { value: WEBHOOK_EVENTS.ORDER_DELIVERED, label: "Order Delivered" },
      { value: WEBHOOK_EVENTS.ORDER_CANCELLED, label: "Order Cancelled" },
    ],
  },
  {
    name: "Consultation Events",
    events: [
      {
        value: WEBHOOK_EVENTS.CONSULTATION_SUBMITTED,
        label: "Consultation Submitted",
      },
      {
        value: WEBHOOK_EVENTS.CONSULTATION_APPROVED,
        label: "Consultation Approved",
      },
      {
        value: WEBHOOK_EVENTS.CONSULTATION_REJECTED,
        label: "Consultation Rejected",
      },
    ],
  },
];
