import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant/tenant";
import { apiError } from "@/lib/api-error";
import { parseSlug } from "@/lib/validation/parse-uuid";

export const GET = withAuth(async (_req, { user }, params) => {
  try {
    parseSlug(params.slug);

    const email = user.email;
    if (!email) {
      return apiError(new Error("Email not found"), {
        route: "GET /api/store/[slug]/orders",
        status: 401,
        safeMessage: "Email not found",
      });
    }

    const dbUser = await prisma.users.findFirst({
      where: { email },
    });

    if (!dbUser) {
      return apiError(new Error("User not found"), {
        route: "GET /api/store/[slug]/orders",
        status: 404,
        safeMessage: "User not found",
      });
    }

    const tenant = await getCurrentTenant();

    if (!tenant) {
      return apiError(new Error("Tenant not found"), {
        route: "GET /api/store/[slug]/orders",
        status: 404,
        safeMessage: "Tenant not found",
      });
    }

    // Get orders for the current user AND specific tenant
    const orders = await prisma.orders.findMany({
      where: {
        userId: dbUser.id,
        tenantId: tenant.id,
      },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    return apiError(error, {
      route: "GET /api/store/[slug]/orders",
      safeMessage: "Failed to fetch orders",
    });
  }
});
