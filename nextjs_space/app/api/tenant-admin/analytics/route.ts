import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions/require-permission";
import { prisma } from "@/lib/db";
import { subDays, startOfDay, format, eachDayOfInterval } from "date-fns";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { apiError } from "@/lib/api-error";
import { getTenantVerificationMode } from "@/lib/verification-mode";
import {
  percentChange,
  revenuePeriods,
} from "@/lib/analytics/period-metrics";

// Revenue basis: every aggregate below excludes CANCELLED orders, except the
// orders-by-status breakdown (whose whole point is to show cancellations) and
// the recent-orders activity feed (where a cancelled order is still activity).
const activeOrders = (tenantId: string) => ({
  tenantId,
  status: { not: "CANCELLED" as const },
});

export const GET = requirePermission("canViewAnalytics", async (req, { user, tenantId }) => {
  try {
    // Rate limiting
    const rateLimitResult = await checkRateLimit(user.id);
    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    // Get time range from query params
    const searchParams = req.nextUrl.searchParams;
    const timeRangeParam = searchParams.get("timeRange") || "30d";
    const days =
      timeRangeParam === "7d" ? 7 : timeRangeParam === "90d" ? 90 : 30;
    const startDate = startOfDay(subDays(new Date(), days));

    // Get all-time totals for this tenant
    const totalProducts = await prisma.products.count({
      where: { tenantId },
    });

    const totalOrders = await prisma.orders.count({
      where: activeOrders(tenantId),
    });

    const totalCustomers = await prisma.users.count({
      where: { tenantId, role: "PATIENT" },
    });

    // Get total revenue
    const totalRevenueResult = await prisma.orders.aggregate({
      where: activeOrders(tenantId),
      _sum: { total: true },
    });
    const totalRevenue = totalRevenueResult._sum.total || 0;

    // Revenue actually collected (PAID/OVERPAID payment status). Exposed for
    // downstream use; the headline totalRevenue keeps counting non-cancelled
    // orders because some flows never stamp paymentStatus (known desync).
    const paidRevenueResult = await prisma.orders.aggregate({
      where: {
        ...activeOrders(tenantId),
        paymentStatus: { in: ["PAID", "OVERPAID"] },
      },
      _sum: { total: true },
    });
    const paidRevenue = paidRevenueResult._sum.total || 0;

    // Get recent stats
    const recentOrders = await prisma.orders.count({
      where: {
        ...activeOrders(tenantId),
        createdAt: { gte: startDate },
      },
    });

    const recentCustomers = await prisma.users.count({
      where: {
        tenantId,
        role: "PATIENT",
        createdAt: { gte: startDate },
      },
    });

    // Get recent revenue
    const recentRevenueResult = await prisma.orders.aggregate({
      where: {
        ...activeOrders(tenantId),
        createdAt: { gte: startDate },
      },
      _sum: { total: true },
    });
    const recentRevenue = recentRevenueResult._sum.total || 0;

    // Get average order value
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Today / rolling-7d / rolling-30d revenue with real prior-period deltas.
    const periods = revenuePeriods(new Date());
    const periodSums = await Promise.all(
      periods.flatMap((spec) =>
        [spec.current, spec.previous].map((window) =>
          prisma.orders
            .aggregate({
              where: {
                ...activeOrders(tenantId),
                createdAt: { gte: window.start, lt: window.end },
              },
              _sum: { total: true },
            })
            .then((r: { _sum: { total: number | null } }) => r._sum.total || 0),
        ),
      ),
    );
    const revenueMetrics = periods.map((spec, i) => {
      const current = periodSums[i * 2];
      const previous = periodSums[i * 2 + 1];
      return {
        label: spec.label,
        value: current,
        change: percentChange(current, previous),
        period: spec.period,
      };
    });

    // Get revenue and order counts by day in a single query using raw groupBy
    const dateRange = eachDayOfInterval({ start: startDate, end: new Date() });
    const ordersByDay = await prisma.orders.groupBy({
      by: ["createdAt"],
      where: {
        ...activeOrders(tenantId),
        createdAt: { gte: startDate },
      },
      _sum: { total: true },
      _count: { id: true },
    });

    // Build a date-keyed map for O(1) lookup
    const dayMap = new Map<string, { revenue: number; orders: number }>();
    for (const row of ordersByDay) {
      const key = format(startOfDay(row.createdAt), "yyyy-MM-dd");
      const existing = dayMap.get(key) || { revenue: 0, orders: 0 };
      dayMap.set(key, {
        revenue: existing.revenue + (Number(row._sum.total) || 0),
        orders: existing.orders + (row._count.id || 0),
      });
    }

    const revenueByDayData = dateRange.map((date: Date) => {
      const key = format(date, "yyyy-MM-dd");
      return { date: format(date, "MMM dd"), revenue: dayMap.get(key)?.revenue || 0 };
    });

    const ordersByDayData = dateRange.map((date: Date) => {
      const key = format(date, "yyyy-MM-dd");
      return { date: format(date, "MMM dd"), orders: dayMap.get(key)?.orders || 0 };
    });

    // Top selling products. Raw SQL because product revenue is
    // SUM(price * quantity) — Prisma groupBy cannot multiply columns, and the
    // previous _sum.price implementation understated any line with quantity > 1.
    interface TopProductRow {
      productId: string;
      revenue: number;
      quantity: number;
      orders: number;
    }
    const topProductsRaw: TopProductRow[] = await prisma.$queryRaw<
      TopProductRow[]
    >`
      SELECT oi."productId" AS "productId",
             COALESCE(SUM(oi."price" * oi."quantity"), 0)::float AS "revenue",
             COALESCE(SUM(oi."quantity"), 0)::int AS "quantity",
             COUNT(DISTINCT oi."orderId")::int AS "orders"
      FROM "order_items" oi
      JOIN "orders" o ON o."id" = oi."orderId"
      WHERE o."tenantId" = ${tenantId}
        AND o."createdAt" >= ${startDate}
        AND o."status" <> 'CANCELLED'
      GROUP BY oi."productId"
      ORDER BY "revenue" DESC
      LIMIT 5
    `;

    // Batch fetch product details (single query instead of N+1)
    const productIds = topProductsRaw
      .map((item: TopProductRow) => item.productId)
      .filter(Boolean);
    const products = productIds.length > 0
      ? await prisma.products.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true },
        })
      : [];
    const productMap = new Map(products.map((p: { id: string; name: string }) => [p.id, p.name]));

    const topProductsWithDetails = topProductsRaw.map((item: TopProductRow) => ({
      id: item.productId,
      name: productMap.get(item.productId) || "Unknown Product",
      quantity: item.quantity,
      revenue: item.revenue,
      orders: item.orders,
    }));

    // Get customer growth by day (single groupBy instead of N queries)
    const customersByDay = await prisma.users.groupBy({
      by: ["createdAt"],
      where: {
        tenantId,
        role: "PATIENT",
        createdAt: { gte: startDate },
      },
      _count: { id: true },
    });

    const customerDayMap = new Map<string, number>();
    for (const row of customersByDay) {
      const key = format(startOfDay(row.createdAt), "yyyy-MM-dd");
      customerDayMap.set(key, (customerDayMap.get(key) || 0) + (row._count.id || 0));
    }

    const customerGrowthData = dateRange.map((date: Date) => {
      const key = format(date, "yyyy-MM-dd");
      return { date: format(date, "MMM dd"), customers: customerDayMap.get(key) || 0 };
    });

    // Get order status distribution — deliberately INCLUDES cancelled orders.
    const orderStatusData = await prisma.orders.groupBy({
      by: ["status"],
      where: {
        tenantId,
        createdAt: { gte: startDate },
      },
      _count: {
        id: true,
      },
    });

    const ordersByStatus = orderStatusData.map((item: any) => ({
      name: item.status,
      value: item._count.id,
    }));

    // Verification mode — drives whether the consultations card renders
    // (ID-upload tenants skip consultations).
    const tenantRow = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { countryCode: true, settings: true },
    });
    const verificationMode = getTenantVerificationMode(tenantRow ?? {});

    // Real, tenant-scoped recent orders — activity feed, includes cancelled.
    const recentOrdersRows = await prisma.orders.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        total: true,
        status: true,
        createdAt: true,
        users: { select: { name: true, email: true } },
      },
    });
    const recentOrdersList = recentOrdersRows.map((o: any) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customer: o.users?.name || o.users?.email || "Unknown",
      total: o.total,
      status: o.status,
      createdAt: o.createdAt,
    }));

    // Real, tenant-scoped recent customers — replaces the former client-side mock.
    const recentCustomersRows = await prisma.users.findMany({
      where: { tenantId, role: "PATIENT" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, email: true, createdAt: true },
    });
    const recentCustomersList = recentCustomersRows.map((c: any) => ({
      id: c.id,
      name: c.name || c.email || "Unknown",
      email: c.email,
      createdAt: c.createdAt,
    }));

    // Real pending consultation count (0 for a new tenant = blank slate).
    const pendingConsultations = await prisma.consultation_questionnaires.count({
      where: { tenantId },
    });

    return NextResponse.json({
      totalProducts,
      totalOrders,
      totalCustomers,
      totalRevenue,
      paidRevenue,
      recentOrders,
      recentCustomers,
      recentRevenue,
      avgOrderValue,
      revenueMetrics,
      revenueByDay: revenueByDayData,
      ordersByDay: ordersByDayData,
      topProducts: topProductsWithDetails,
      customerGrowth: customerGrowthData,
      ordersByStatus,
      verificationMode,
      recentOrdersList,
      recentCustomersList,
      pendingConsultations,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return apiError(error, {
      route: "GET /api/tenant-admin/analytics",
      safeMessage: "Failed to fetch analytics",
    });
  }
});
