import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantDrGreenConfig } from "@/lib/tenant-config";
import { getOrder } from "@/lib/drgreen-orders";
import { apiError } from "@/lib/api-error";

export const GET = withAuth(async (_request, { user }, { orderId }) => {
  try {
    const email = user.email;
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find linked DB user
    const dbUser = await prisma.users.findFirst({ where: { email } });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Resolve tenant from middleware headers (works for subdomain, path, and custom domain routing)
    const tenant = await getCurrentTenant();

    if (!tenant) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // Get Dr. Green credentials
    const drGreenConfig = await getTenantDrGreenConfig(tenant.id);

    // Get order (with Dr. Green sync)
    const order = await getOrder({
      orderId: orderId,
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
