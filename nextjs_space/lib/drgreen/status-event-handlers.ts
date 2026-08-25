import { prisma } from "@/lib/db";
import { triggerWebhook, WEBHOOK_EVENTS } from "@/lib/integrations/webhook";
import { sendEmail, emailTemplates } from "@/lib/email/email";
import {
  isValidStateTransition,
  sanitizeForLogging,
  type DrGreenWebhookPayload,
} from "@/lib/drgreen/drgreen-webhook-verify";

/** Dr Green's outbound dispatcher sends `data.emailsSent: true` when it has
 *  already emailed the client (branded per nftId) for this transition — in
 *  that case our own customer email would be a duplicate and is skipped.
 *  Older/unknown senders omit the flag and keep the existing behaviour. */
function senderAlreadyEmailedClient(payload: DrGreenWebhookPayload): boolean {
  return payload.data?.emailsSent === true;
}

export async function dispatchEvent(
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
  if (user && !senderAlreadyEmailedClient(payload)) {
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
  if (user && !senderAlreadyEmailedClient(payload)) {
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
    data: {
      adminApproval: "VERIFIED",
      // ID-path approvals set the client's KYC flag in the same admin action;
      // the dispatcher reports it so both mirror fields stay in step (the
      // order gate needs both).
      ...(payload.data?.isKYCVerified === true ? { isKycVerified: true } : {}),
    },
  });

  await logKycJourney(tenantId, clientId, payload.data?.email, "client.approved", payload);

  const user = await findUserByClientId(clientId);
  if (user && !senderAlreadyEmailedClient(payload)) {
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
  if (user && !senderAlreadyEmailedClient(payload)) {
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
