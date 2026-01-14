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
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

/**
 * Available webhook events
 */
export {
  WEBHOOK_EVENTS,
  WEBHOOK_EVENT_CATEGORIES,
} from "@/lib/webhook-events";
