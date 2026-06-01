import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant/tenant";
import { getTenantDrGreenConfig } from "@/lib/tenant/tenant-config";
import { getOrder } from "@/lib/drgreen/drgreen-orders";
import { apiError } from "@/lib/api-error";
import { parseSlug, parseUuid } from "@/lib/validation/parse-uuid";

export const GET = withAuth(async (_request, { user }, params) => {
  try {
    parseSlug(params.slug);
    const orderId = parseUuid(params.orderId);

    const email = user.email;
    if (!email) {
      return apiError(new Error("Unauthorized"), {
        route: "GET /api/store/[slug]/orders/[orderId]",
        status: 401,
        safeMessage: "Unauthorized",
      });
    }

    // Find linked DB user
    const dbUser = await prisma.users.findFirst({ where: { email } });
    if (!dbUser) {
      return apiError(new Error("User not found"), {
        route: "GET /api/store/[slug]/orders/[orderId]",
        status: 404,
        safeMessage: "User not found",
      });
    }

    // Resolve tenant from middleware headers (works for subdomain, path, and custom domain routing)
    const tenant = await getCurrentTenant();

    if (!tenant) {
      return apiError(new Error("Store not found"), {
        route: "GET /api/store/[slug]/orders/[orderId]",
        status: 404,
        safeMessage: "Store not found",
      });
    }

    // Get Dr. Green credentials
    const drGreenConfig = await getTenantDrGreenConfig(tenant.id);

    // Get order (with Dr. Green sync)
    const order = await getOrder({
      orderId,
      userId: dbUser.id,
      tenantId: tenant.id,
      apiKey: drGreenConfig.apiKey,
      secretKey: drGreenConfig.secretKey,
    });

    return NextResponse.json({ order });
  } catch (error) {
    return apiError(error, {
      route: "GET /api/store/[slug]/orders/[orderId]",
      safeMessage: "Failed to get order",
    });
  }
});
