import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant/tenant-context";
import { apiError } from "@/lib/api-error";

// withAuth binds the request's host tenant at the boundary (PRD-202
// runWithTenantContextAsync) and admits any logged-in user. Customer order
// history is therefore read under the confined tenant context — every
// tenant-scoped Prisma query runs under the correct tenant and can never
// observe a concurrent request's tenant.
export const GET = withAuth(async (_req, { user }) => {
  try {
    const email = user.email;
    if (!email) {
      return apiError(new Error("Unauthorized"), {
        route: "GET /api/orders/customer",
        status: 401,
        safeMessage: "Unauthorized",
      });
    }

    // Read the bound tenant from the confined context instead of re-resolving
    // here. A null id means no tenant resolved → 404.
    const tenantId = getTenantContext();
    if (!tenantId) {
      return apiError(new Error("Tenant not found"), {
        route: "GET /api/orders/customer",
        status: 404,
        safeMessage: "Tenant not found",
      });
    }

    const dbUser = await prisma.users.findFirst({
      where: { email, tenantId },
    });

    if (!dbUser) {
      return NextResponse.json({ orders: [] });
    }

    const orders = await prisma.orders.findMany({
      where: {
        userId: dbUser.id,
        tenantId,
      },
      include: {
        items: true,
        tenant: {
          select: {
            businessName: true,
            subdomain: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Error fetching customer orders:", error);
    return apiError(error, {
      route: "GET /api/orders/customer",
      safeMessage: "Failed to fetch orders",
    });
  }
});
