"use server";

import { getCurrentUser } from "@/lib/auth-helper";
import { getCurrentTenant } from "@/lib/tenant/tenant";
import { getTenantDrGreenConfig } from "@/lib/tenant/tenant-config";
import {
  getTenantVerificationMode,
  type VerificationMode,
} from "@/lib/verification-mode";
import { prisma } from "@/lib/db";
import {
  listUserOrdersWithSync,
  type StorefrontOrder,
} from "@/lib/orders/storefront-orders";
import { logger } from "@/lib/logger";

export interface StorefrontDashboard {
  verificationMode: VerificationMode;
  orders: StorefrontOrder[];
  orderCount: number;
  totalPaid: number;
}

const EMPTY: StorefrontDashboard = {
  verificationMode: "KYC",
  orders: [],
  orderCount: 0,
  totalPaid: 0,
};

/**
 * Dashboard / orders-page data for the signed-in customer:
 *  - the tenant's verification mode (so the UI hides consultation/prescription
 *    sections for ID-upload tenants),
 *  - their orders, status-synced live from Dr Green on load, and
 *  - lifetime totals.
 * Pass `limit` for the dashboard's "recent" list; omit it for the full page.
 */
export async function getStorefrontDashboard(
  limit?: number,
): Promise<StorefrontDashboard> {
  try {
    const [clerkUser, tenant] = await Promise.all([
      getCurrentUser(),
      getCurrentTenant(),
    ]);
    if (!clerkUser || !tenant) return EMPTY;

    const verificationMode = getTenantVerificationMode(tenant);

    // Resolve the tenant-scoped user row (by email, falling back to clerk id).
    let dbUser = clerkUser.email
      ? await prisma.users.findFirst({
          where: { email: clerkUser.email, tenantId: tenant.id },
          select: { id: true },
        })
      : null;
    if (!dbUser && clerkUser.id) {
      dbUser = await prisma.users.findUnique({
        where: { id: clerkUser.id },
        select: { id: true },
      });
    }
    if (!dbUser) return { ...EMPTY, verificationMode };

    let orders: StorefrontOrder[] = [];
    try {
      const config = await getTenantDrGreenConfig(tenant.id);
      orders = await listUserOrdersWithSync({
        userId: dbUser.id,
        tenantId: tenant.id,
        config,
        limit,
      });
    } catch (err) {
      logger.warn("[dashboard] order list/sync failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const [orderCount, paidAgg] = await Promise.all([
      prisma.orders.count({ where: { userId: dbUser.id, tenantId: tenant.id } }),
      prisma.orders.aggregate({
        where: {
          userId: dbUser.id,
          tenantId: tenant.id,
          paymentStatus: "PAID",
        },
        _sum: { total: true },
      }),
    ]);

    return {
      verificationMode,
      orders,
      orderCount,
      totalPaid: paidAgg._sum.total ?? 0,
    };
  } catch (error) {
    logger.error("[dashboard] getStorefrontDashboard failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return EMPTY;
  }
}
