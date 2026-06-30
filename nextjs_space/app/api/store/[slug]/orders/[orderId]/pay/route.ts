import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant/tenant";
import { getTenantDrGreenConfig } from "@/lib/tenant/tenant-config";
import { createDirectCheckout } from "@/lib/drgreen/drgreen-orders";
import { apiError } from "@/lib/api-error";
import { parseSlug, parseUuid } from "@/lib/validation/parse-uuid";

const ROUTE = "POST /api/store/[slug]/orders/[orderId]/pay";

// Re-mint a PayCloud hosted checkout for an EXISTING order so a customer whose
// payment was cancelled or failed (and who landed back on the return page) can
// retry without creating a duplicate order. The Dr Green checkout endpoint only
// mints for a PENDING order, so an already-PAID order can never be re-charged.
export const POST = withAuth(async (request, { user }, params) => {
  try {
    const slug = parseSlug(params.slug);
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

    // Owner-scoped lookup (IDOR-safe): only the order's own customer can retry.
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

    // Already paid — nothing to retry; let the page show success.
    if (order.paymentStatus === "PAID") {
      return NextResponse.json({ paid: true });
    }
    if (!order.drGreenOrderId) {
      return apiError(new Error("Order not payable online"), {
        route: ROUTE,
        status: 400,
        safeMessage: "This order can't be paid online — please contact support.",
      });
    }

    const drGreenConfig = await getTenantDrGreenConfig(tenant.id);
    const origin =
      request.headers.get("origin") ||
      (request.headers.get("host")
        ? `https://${request.headers.get("host")}`
        : "");

    const checkout = await createDirectCheckout({
      drGreenOrderId: order.drGreenOrderId,
      returnUrl: `${origin}/store/${slug}/payment/return/${orderId}`,
      apiKey: drGreenConfig.apiKey,
      secretKey: drGreenConfig.secretKey,
      apiUrl: drGreenConfig.apiUrl,
    });

    return NextResponse.json({ payUrl: checkout.payUrl });
  } catch (error) {
    return apiError(error, { route: ROUTE, safeMessage: "Failed to start payment" });
  }
});
