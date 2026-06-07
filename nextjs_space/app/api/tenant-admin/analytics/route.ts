import { NextResponse } from "next/server";
import { withTenantAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { subDays, startOfDay, format, eachDayOfInterval } from "date-fns";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { apiError } from "@/lib/api-error";

export const GET = withTenantAuth(async (req, { user, tenantId }) => {
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
      where: { tenantId },
    });

    const totalCustomers = await prisma.users.count({
      where: { tenantId, role: "PATIENT" },
    });

    // Get total revenue
    const totalRevenueResult = await prisma.orders.aggregate({
      where: { tenantId },
      _sum: { total: true },
    });
    const totalRevenue = totalRevenueResult._sum.total || 0;

    // Get recent stats
    const recentOrders = await prisma.orders.count({
      where: {
        tenantId,
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
        tenantId,
        createdAt: { gte: startDate },
      },
      _sum: { total: true },
    });
    const recentRevenue = recentRevenueResult._sum.total || 0;

    // Get average order value
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Get revenue and order counts by day in a single query using raw groupBy
    const dateRange = eachDayOfInterval({ start: startDate, end: new Date() });
    const ordersByDay = await prisma.orders.groupBy({
      by: ["createdAt"],
      where: {
        tenantId,
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

    // Get top selling products
    const topProducts = await prisma.order_items.groupBy({
      by: ["productId"],
      where: {
        orders: {
          tenantId,
          createdAt: { gte: startDate },
        },
      },
      _sum: {
        quantity: true,
        price: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _sum: {
          quantity: "desc",
        },
      },
      take: 5,
    });

    // Batch fetch product details (single query instead of N+1)
    const productIds = topProducts.map((item: any) => item.productId).filter(Boolean);
    const products = productIds.length > 0
      ? await prisma.products.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true },
        })
      : [];
    const productMap = new Map(products.map((p: { id: string; name: string }) => [p.id, p.name]));

    const topProductsWithDetails = topProducts.map((item: any) => ({
      id: item.productId,
      name: productMap.get(item.productId) || "Unknown Product",
      quantity: item._sum.quantity || 0,
      revenue: item._sum.price || 0,
      orders: item._count.id,
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

    // Get order status distribution
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

    return NextResponse.json({
      totalProducts,
      totalOrders,
      totalCustomers,
      totalRevenue,
      recentOrders,
      recentCustomers,
      recentRevenue,
      avgOrderValue,
      revenueByDay: revenueByDayData,
      ordersByDay: ordersByDayData,
      topProducts: topProductsWithDetails,
      customerGrowth: customerGrowthData,
      ordersByStatus,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return apiError(error, {
      route: "GET /api/tenant-admin/analytics",
      safeMessage: "Failed to fetch analytics",
    });
  }
});
