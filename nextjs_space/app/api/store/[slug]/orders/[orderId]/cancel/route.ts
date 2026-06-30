import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant/tenant";
import { getTenantDrGreenConfig } from "@/lib/tenant/tenant-config";
import { cancelDirectCheckout } from "@/lib/drgreen/drgreen-orders";
import { apiError } from "@/lib/api-error";
import { parseSlug, parseUuid } from "@/lib/validation/parse-uuid";

const ROUTE = "POST /api/store/[slug]/orders/[orderId]/cancel";

// Void an unpaid direct-pay order when the customer abandons payment ("back to
// cart" / gave up) so it never lingers as a placed-but-unpaid order. Dr Green
// re-checks PayCloud first, so a payment that actually completed is reported
// paid and NOT voided. Owner-scoped (IDOR-safe) and idempotent.
export const POST = withAuth(async (_request, { user }, params) => {
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

    // Never void a paid order.
    if (order.paymentStatus === "PAID") {
      return NextResponse.json({ state: "paid", cancelled: false });
    }
    // Never reached Dr Green checkout — just retire it locally.
    if (!order.drGreenOrderId) {
      await prisma.orders
        .update({ where: { id: order.id }, data: { paymentStatus: "CANCELLED" } })
        .catch(() => {});
      return NextResponse.json({ state: "cancelled", cancelled: true });
    }

    const drGreenConfig = await getTenantDrGreenConfig(tenant.id);
    const result = await cancelDirectCheckout({
      drGreenOrderId: order.drGreenOrderId,
      apiKey: drGreenConfig.apiKey,
      secretKey: drGreenConfig.secretKey,
      apiUrl: drGreenConfig.apiUrl,
    });

    // Dr Green found the payment had actually completed — sync to PAID.
    if (result.state === "paid") {
      await prisma.orders
        .update({ where: { id: order.id }, data: { paymentStatus: "PAID" } })
        .catch(() => {});
      return NextResponse.json({ state: "paid", cancelled: false });
    }

    await prisma.orders
      .update({ where: { id: order.id }, data: { paymentStatus: "CANCELLED" } })
      .catch(() => {});
    return NextResponse.json({ state: "cancelled", cancelled: true });
  } catch (error) {
    return apiError(error, { route: ROUTE, safeMessage: "Failed to cancel order" });
  }
});
