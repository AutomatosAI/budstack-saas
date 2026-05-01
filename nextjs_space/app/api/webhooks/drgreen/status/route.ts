import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { triggerWebhook, WEBHOOK_EVENTS } from "@/lib/webhook";
import { decrypt } from "@/lib/encryption";
import { sendEmail, emailTemplates } from "@/lib/email";
import {
  verifyDrGreenWebhookSignature,
  validateWebhookTimestamp,
  validateWebhookPayload,
  sanitizeForLogging,
  isValidStateTransition,
  type DrGreenWebhookPayload,
} from "@/lib/drgreen-webhook-verify";

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
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let payload: DrGreenWebhookPayload;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate payload structure
  if (!validateWebhookPayload(payload)) {
    return NextResponse.json(
      { error: "Invalid payload structure" },
      { status: 400 },
    );
  }

  // Validate timestamp (anti-replay)
  const tsResult = validateWebhookTimestamp(payload.timestamp);
  if (!tsResult.valid) {
    return NextResponse.json(
      { error: tsResult.reason },
      { status: 400 },
    );
  }

  const { event, clientId, orderId, strainId } = payload;
  const signature = request.headers.get("x-webhook-signature") || "";

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
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // --- Signature Verification (per-tenant secret) ---
    if (resolved.tenantSecret) {
      const secret = decrypt(resolved.tenantSecret, {
        allowUnencryptedMigration: true,
        migrationDeadline: "2026-12-31",
      });
      if (!verifyDrGreenWebhookSignature(rawBody, signature, secret)) {
        console.error("[DrGreen Status] Signature verification failed");
        await logWebhook(resolved.tenantId, event, payload, false, "Invalid signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } else {
      // No secret configured — reject in production, allow in dev
      if (process.env.NODE_ENV === 'production') {
        console.error("[DrGreen Status] No drGreenSecretKey configured for tenant, rejecting webhook");
        await logWebhook(resolved.tenantId, event, payload, false, "No webhook secret configured");
        return NextResponse.json({ error: "Webhook secret not configured" }, { status: 401 });
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

    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
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

async function dispatchEvent(
  event: string,
  tenantId: string,
  payload: DrGreenWebhookPayload,
) {
  switch (event) {
    case "kyc.link_generated":
      await handleKycLinkGenerated(tenantId, payload);
      break;
    case "kyc.verified":
    case "kyc.approved":
      await handleKycVerified(tenantId, payload);
      break;
    case "kyc.rejected":
    case "kyc.failed":
      await handleKycRejected(tenantId, payload);
      break;
    case "client.approved":
      await handleClientApproved(tenantId, payload);
      break;
    case "client.rejected":
      await handleClientRejected(tenantId, payload);
      break;
    case "order.shipped":
      await handleOrderStatus(tenantId, payload, "SHIPPED");
      break;
    case "order.delivered":
      await handleOrderStatus(tenantId, payload, "DELIVERED");
      break;
    case "order.cancelled":
      await handleOrderStatus(tenantId, payload, "CANCELLED");
      break;
    case "order.status_updated":
    case "order.updated":
      await handleOrderStatusUpdated(tenantId, payload);
      break;
    case "payment.completed":
      await handlePaymentCompleted(tenantId, payload);
      break;
    case "payment.failed":
      await handlePaymentFailed(tenantId, payload);
      break;
    default:
      if (event.startsWith("inventory.") || event.startsWith("stock.")) {
        await handleInventoryUpdate(tenantId, payload);
      } else {
        console.warn("[DrGreen Status] Unhandled event:", event);
      }
  }
}

// =============================================================================
// KYC Handlers
// =============================================================================

async function handleKycLinkGenerated(
  tenantId: string,
  payload: DrGreenWebhookPayload,
) {
  const { clientId, kycLink } = payload;

  if (!clientId) {
    console.warn("[DrGreen Status] kyc.link_generated missing clientId");
    return;
  }

  if (kycLink) {
    await prisma.consultation_questionnaires.updateMany({
      where: { drGreenClientId: clientId, tenantId },
      data: { kycLink },
    });
  }

  await logKycJourney(tenantId, clientId, payload.data?.email, "kyc.link_generated", payload);

  // Send KYC link email
  const user = await findUserByClientId(clientId);
  if (user && kycLink) {
    const tenant = await prisma.tenants.findUnique({ where: { id: tenantId } });
    const html = await emailTemplates.kycLink(
      user.name || user.firstName || "there",
      kycLink,
      tenant?.businessName || "BudStacks",
    );
    await sendEmail({
      to: user.email,
      subject: "Complete Your Identity Verification",
      html,
      tenantId,
      templateName: "kyc-link",
    });
  }

  await triggerWebhook({
    event: WEBHOOK_EVENTS.KYC_LINK_GENERATED,
    tenantId,
    data: { clientId, kycLink },
  });
}

async function handleKycVerified(
  tenantId: string,
  payload: DrGreenWebhookPayload,
) {
  const { clientId } = payload;

  if (!clientId) {
    console.warn("[DrGreen Status] kyc.verified missing clientId");
    return;
  }

  await prisma.consultation_questionnaires.updateMany({
    where: { drGreenClientId: clientId, tenantId },
    data: { isKycVerified: true },
  });

  await logKycJourney(tenantId, clientId, payload.data?.email, "kyc.verified", payload);

  const user = await findUserByClientId(clientId);
  if (user) {
    const tenant = await prisma.tenants.findUnique({ where: { id: tenantId } });
    const html = await emailTemplates.kycStatus(
      user.name || user.firstName || "there",
      "approved",
      tenant?.businessName || "BudStacks",
    );
    await sendEmail({
      to: user.email,
      subject: "Identity Verification Approved",
      html,
      tenantId,
      templateName: "kyc-status",
    });
  }

  await triggerWebhook({
    event: WEBHOOK_EVENTS.KYC_VERIFIED,
    tenantId,
    data: { clientId },
  });
}

async function handleKycRejected(
  tenantId: string,
  payload: DrGreenWebhookPayload,
) {
  const { clientId, rejectionReason, kycLink } = payload;

  if (!clientId) {
    console.warn("[DrGreen Status] kyc.rejected missing clientId");
    return;
  }

  await logKycJourney(tenantId, clientId, payload.data?.email, "kyc.rejected", payload);

  const user = await findUserByClientId(clientId);
  if (user) {
    const tenant = await prisma.tenants.findUnique({ where: { id: tenantId } });
    // Use kycLink from payload, or fall back to stored link for retry
    let retryLink = kycLink;
    if (!retryLink) {
      const consultation = await prisma.consultation_questionnaires.findFirst({
        where: { drGreenClientId: clientId, tenantId },
      });
      retryLink = consultation?.kycLink || undefined;
    }
    const html = await emailTemplates.kycStatus(
      user.name || user.firstName || "there",
      "rejected",
      tenant?.businessName || "BudStacks",
      rejectionReason,
      retryLink,
    );
    await sendEmail({
      to: user.email,
      subject: "Identity Verification Update",
      html,
      tenantId,
      templateName: "kyc-status",
    });
  }

  await triggerWebhook({
    event: WEBHOOK_EVENTS.KYC_REJECTED,
    tenantId,
    data: { clientId, reason: rejectionReason },
  });
}

// =============================================================================
// Client Approval Handlers
// =============================================================================

async function handleClientApproved(
  tenantId: string,
  payload: DrGreenWebhookPayload,
) {
  const { clientId } = payload;

  if (!clientId) {
    console.warn("[DrGreen Status] client.approved missing clientId");
    return;
  }

  // Validate state transition (matching HealingBudStacks)
  const existing = await prisma.consultation_questionnaires.findFirst({
    where: { drGreenClientId: clientId, tenantId },
  });
  if (existing && !isValidStateTransition(existing.adminApproval, "VERIFIED")) {
    console.warn("[DrGreen Status] Invalid state transition:", existing.adminApproval, "→ VERIFIED");
  }

  await prisma.consultation_questionnaires.updateMany({
    where: { drGreenClientId: clientId, tenantId },
    data: { adminApproval: "VERIFIED" },
  });

  await logKycJourney(tenantId, clientId, payload.data?.email, "client.approved", payload);

  const user = await findUserByClientId(clientId);
  if (user) {
    const tenant = await prisma.tenants.findUnique({ where: { id: tenantId } });
    const html = await emailTemplates.clientStatus(
      user.name || user.firstName || "there",
      "approved",
      tenant?.businessName || "BudStacks",
    );
    await sendEmail({
      to: user.email,
      subject: "You've Been Approved!",
      html,
      tenantId,
      templateName: "client-status",
    });
  }

  await triggerWebhook({
    event: WEBHOOK_EVENTS.CONSULTATION_APPROVED,
    tenantId,
    data: { clientId },
  });
}

async function handleClientRejected(
  tenantId: string,
  payload: DrGreenWebhookPayload,
) {
  const { clientId, rejectionReason } = payload;

  if (!clientId) {
    console.warn("[DrGreen Status] client.rejected missing clientId");
    return;
  }

  // Validate state transition (matching HealingBudStacks)
  const existing = await prisma.consultation_questionnaires.findFirst({
    where: { drGreenClientId: clientId, tenantId },
  });
  if (existing && !isValidStateTransition(existing.adminApproval, "REJECTED")) {
    console.warn("[DrGreen Status] Invalid state transition:", existing.adminApproval, "→ REJECTED");
  }

  await prisma.consultation_questionnaires.updateMany({
    where: { drGreenClientId: clientId, tenantId },
    data: { adminApproval: "REJECTED" },
  });

  await logKycJourney(tenantId, clientId, payload.data?.email, "client.rejected", payload);

  const user = await findUserByClientId(clientId);
  if (user) {
    const tenant = await prisma.tenants.findUnique({ where: { id: tenantId } });
    const html = await emailTemplates.clientStatus(
      user.name || user.firstName || "there",
      "rejected",
      tenant?.businessName || "BudStacks",
      rejectionReason,
    );
    await sendEmail({
      to: user.email,
      subject: "Eligibility Update",
      html,
      tenantId,
      templateName: "client-status",
    });
  }

  await triggerWebhook({
    event: WEBHOOK_EVENTS.CONSULTATION_REJECTED,
    tenantId,
    data: { clientId, reason: rejectionReason },
  });
}

// =============================================================================
// Order Handlers
// =============================================================================

async function handleOrderStatus(
  tenantId: string,
  payload: DrGreenWebhookPayload,
  status: "SHIPPED" | "DELIVERED" | "CANCELLED",
) {
  const { orderId } = payload;

  if (orderId) {
    await prisma.orders.updateMany({
      where: { drGreenOrderId: orderId, tenantId },
      data: { status },
    });
  }

  const order = await prisma.orders.findFirst({
    where: { drGreenOrderId: orderId, tenantId },
    include: { users: true, tenants: true },
  });

  if (order) {
    const html = await emailTemplates.orderStatusUpdate(
      order.users.name || order.users.firstName || "there",
      order.orderNumber,
      status,
      order.tenants.businessName,
    );
    await sendEmail({
      to: order.users.email,
      subject: `Order #${order.orderNumber} — ${status.charAt(0) + status.slice(1).toLowerCase()}`,
      html,
      tenantId,
      templateName: "order-status-update",
    });
  }

  const webhookEvent =
    status === "SHIPPED"
      ? WEBHOOK_EVENTS.ORDER_SHIPPED
      : status === "DELIVERED"
        ? WEBHOOK_EVENTS.ORDER_DELIVERED
        : WEBHOOK_EVENTS.ORDER_CANCELLED;

  await triggerWebhook({
    event: webhookEvent,
    tenantId,
    data: { orderId, orderNumber: order?.orderNumber, status },
  });
}

async function handleOrderStatusUpdated(
  tenantId: string,
  payload: DrGreenWebhookPayload,
) {
  const { orderId, status: newStatus, paymentStatus: newPaymentStatus } = payload;

  const updateData: Record<string, any> = {};
  if (newStatus) updateData.status = newStatus;
  if (newPaymentStatus) updateData.payment_status = newPaymentStatus;

  if (orderId && Object.keys(updateData).length > 0) {
    await prisma.orders.updateMany({
      where: { drGreenOrderId: orderId, tenantId },
      data: updateData,
    });
  }

  const order = await prisma.orders.findFirst({
    where: { drGreenOrderId: orderId, tenantId },
    include: { users: true, tenants: true },
  });

  if (order && newStatus) {
    type OrderEmailStatus = "SHIPPED" | "DELIVERED" | "CANCELLED" | "CONFIRMED" | "PROCESSING";
    const validStatuses: OrderEmailStatus[] = ["SHIPPED", "DELIVERED", "CANCELLED", "CONFIRMED", "PROCESSING"];
    const emailStatus: OrderEmailStatus = validStatuses.includes(newStatus as OrderEmailStatus) ? (newStatus as OrderEmailStatus) : "PROCESSING";

    const html = await emailTemplates.orderStatusUpdate(
      order.users.name || order.users.firstName || "there",
      order.orderNumber,
      emailStatus,
      order.tenants.businessName,
    );
    await sendEmail({
      to: order.users.email,
      subject: `Order #${order.orderNumber} Status Update`,
      html,
      tenantId,
      templateName: "order-status-update",
    });
  }

  // Map to the closest matching webhook event
  const eventMap: Record<string, string> = {
    SHIPPED: WEBHOOK_EVENTS.ORDER_SHIPPED,
    DELIVERED: WEBHOOK_EVENTS.ORDER_DELIVERED,
    CANCELLED: WEBHOOK_EVENTS.ORDER_CANCELLED,
    CONFIRMED: WEBHOOK_EVENTS.ORDER_CONFIRMED,
  };
  const webhookEvent = eventMap[newStatus || ""] || WEBHOOK_EVENTS.ORDER_CONFIRMED;

  await triggerWebhook({
    event: webhookEvent,
    tenantId,
    data: { orderId, orderNumber: order?.orderNumber, ...updateData },
  });
}

// =============================================================================
// Payment Handlers
// =============================================================================

async function handlePaymentCompleted(
  tenantId: string,
  payload: DrGreenWebhookPayload,
) {
  const { orderId } = payload;

  if (orderId) {
    await prisma.orders.updateMany({
      where: { drGreenOrderId: orderId, tenantId },
      data: { paymentStatus: "PAID", status: "CONFIRMED" },
    });
  }

  const order = await prisma.orders.findFirst({
    where: { drGreenOrderId: orderId, tenantId },
    include: { users: true, tenants: true },
  });

  if (order) {
    const html = await emailTemplates.orderStatusUpdate(
      order.users.name || order.users.firstName || "there",
      order.orderNumber,
      "CONFIRMED",
      order.tenants.businessName,
    );
    await sendEmail({
      to: order.users.email,
      subject: `Payment Confirmed — Order #${order.orderNumber}`,
      html,
      tenantId,
      templateName: "order-status-update",
    });
  }

  await triggerWebhook({
    event: WEBHOOK_EVENTS.ORDER_CONFIRMED,
    tenantId,
    data: { orderId, orderNumber: order?.orderNumber, paymentStatus: "PAID" },
  });
}

async function handlePaymentFailed(
  tenantId: string,
  payload: DrGreenWebhookPayload,
) {
  const { orderId } = payload;

  if (orderId) {
    await prisma.orders.updateMany({
      where: { drGreenOrderId: orderId, tenantId },
      data: { paymentStatus: "FAILED" },
    });
  }

  const order = await prisma.orders.findFirst({
    where: { drGreenOrderId: orderId, tenantId },
    include: { users: true, tenants: true },
  });

  if (order) {
    const html = await emailTemplates.orderStatusUpdate(
      order.users.name || order.users.firstName || "there",
      order.orderNumber,
      "CANCELLED",
      order.tenants.businessName,
    );
    await sendEmail({
      to: order.users.email,
      subject: `Payment Failed — Order #${order.orderNumber}`,
      html,
      tenantId,
      templateName: "order-status-update",
    });
  }

  await triggerWebhook({
    event: WEBHOOK_EVENTS.DRGREEN_PAYMENT_FAILED,
    tenantId,
    data: { orderId, orderNumber: order?.orderNumber, reason: payload.rejectionReason },
  });
}

// =============================================================================
// Inventory Handlers
// =============================================================================

async function handleInventoryUpdate(
  tenantId: string,
  payload: DrGreenWebhookPayload,
) {
  const { strainId, stock } = payload;

  if (strainId && stock !== undefined) {
    await prisma.products.updateMany({
      where: {
        tenantId,
        OR: [{ slug: strainId }, { id: strainId }],
      },
      data: { stock },
    });
  }

  await triggerWebhook({
    event: WEBHOOK_EVENTS.INVENTORY_UPDATED,
    tenantId,
    data: { strainId, stock, availability: payload.availability },
  });
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

async function logKycJourney(
  tenantId: string,
  clientId: string,
  email: string | undefined,
  eventType: string,
  eventData: Record<string, any> | DrGreenWebhookPayload,
) {
  try {
    await prisma.kyc_journey_logs.create({
      data: {
        tenantId,
        clientId,
        email,
        eventType,
        eventData: sanitizeForLogging(eventData as Record<string, any>) as any,
      },
    });
  } catch (err) {
    console.error("[DrGreen Status] Failed to log KYC journey:", err);
  }
}
