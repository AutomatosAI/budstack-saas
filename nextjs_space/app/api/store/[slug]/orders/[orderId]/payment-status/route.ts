import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant/tenant";
import { getTenantDrGreenConfig } from "@/lib/tenant/tenant-config";
import { getDirectCheckoutStatus } from "@/lib/drgreen/drgreen-orders";
import { apiError } from "@/lib/api-error";
import { parseSlug, parseUuid } from "@/lib/validation/parse-uuid";

const ROUTE = "GET /api/store/[slug]/orders/[orderId]/payment-status";

// Definitive payment status for the payment-return page. PayCloud's return URL
// carries no reliable status, so this asks Dr Green for a LIVE order.query-backed
// state — paid | failed | pending | cancelled | expired — instead of waiting on
// the webhook. On a terminal result we sync the local order so the rest of the
// app agrees immediately. Owner-scoped (IDOR-safe).
export const GET = withAuth(async (_request, { user }, params) => {
  try {
    parseSlug(params.slug);
    const orderId = parseUuid(params.orderId);

    const email = user.email;
    if (!email) {
      return apiError(new Error("Unauthorized"), {
        route: ROUTE,
        status: 401,
        safeMessage: "Unauthorized",
      });
    }

    const dbUser = await prisma.users.findFirst({ where: { email } });
    if (!dbUser) {
      return apiError(new Error("User not found"), {
        route: ROUTE,
        status: 404,
        safeMessage: "User not found",
      });
    }

    const tenant = await getCurrentTenant();
    if (!tenant) {
      return apiError(new Error("Store not found"), {
        route: ROUTE,
        status: 404,
        safeMessage: "Store not found",
      });
    }

    const order = await prisma.orders.findFirst({
      where: { id: orderId, userId: dbUser.id, tenantId: tenant.id },
    });
    if (!order) {
      return apiError(new Error("Order not found"), {
        route: ROUTE,
        status: 404,
        safeMessage: "Order not found",
      });
    }

    // Already settled / not online-payable — answer from the local record.
    if (order.paymentStatus === "PAID") {
      return NextResponse.json({
        state: "paid",
        paymentStatus: "PAID",
        orderNumber: order.drGreenInvoiceNum || order.orderNumber,
      });
    }
    if (!order.drGreenOrderId) {
      return NextResponse.json({
        state: "pending",
        paymentStatus: order.paymentStatus,
        orderNumber: order.drGreenInvoiceNum || order.orderNumber,
      });
    }

    const drGreenConfig = await getTenantDrGreenConfig(tenant.id);
    let result: { state: string; paymentStatus: string };
    try {
      result = await getDirectCheckoutStatus({
        drGreenOrderId: order.drGreenOrderId,
        apiKey: drGreenConfig.apiKey,
        secretKey: drGreenConfig.secretKey,
        apiUrl: drGreenConfig.apiUrl,
      });
    } catch {
      // Dr Green unreachable — report pending so the page keeps polling.
      return NextResponse.json({
        state: "pending",
        paymentStatus: order.paymentStatus,
        orderNumber: order.drGreenInvoiceNum || order.orderNumber,
      });
    }

    // Mirror a terminal Dr Green state onto the local order (best-effort).
    const localByState: Record<string, string> = {
      paid: "PAID",
      cancelled: "CANCELLED",
      expired: "EXPIRED",
    };
    const localTarget = localByState[result.state];
    if (localTarget && order.paymentStatus !== localTarget) {
      await prisma.orders
        .update({ where: { id: order.id }, data: { paymentStatus: localTarget } })
        .catch(() => {});
    }

    return NextResponse.json({
      state: result.state,
      paymentStatus: result.paymentStatus,
      orderNumber: order.orderNumber,
    });
  } catch (error) {
    return apiError(error, {
      route: ROUTE,
      safeMessage: "Failed to check payment status",
    });
  }
});
