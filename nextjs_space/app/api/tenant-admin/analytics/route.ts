import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import { subDays, startOfDay, format, eachDayOfInterval } from "date-fns";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "TENANT_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(user.id);
    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    const tenantId = user.tenantId;

    if (!tenantId) {
      return NextResponse.json(
        { error: "No tenant associated with user" },
        { status: 403 },
      );
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

    // Get revenue by day
    const dateRange = eachDayOfInterval({ start: startDate, end: new Date() });
    const revenueByDayData = await Promise.all(
      dateRange.map(async (date: Date) => {
        const dayStart = startOfDay(date);
        const dayEnd = startOfDay(subDays(date, -1));

        const result = await prisma.orders.aggregate({
          where: {
            tenantId,
            createdAt: {
              gte: dayStart,
              lt: dayEnd,
            },
          },
          _sum: { total: true },
        });

        return {
          date: format(date, "MMM dd"),
          revenue: result._sum.total || 0,
        };
      }),
    );

    // Get orders by day
    const ordersByDayData = await Promise.all(
      dateRange.map(async (date: Date) => {
        const dayStart = startOfDay(date);
        const dayEnd = startOfDay(subDays(date, -1));

        const count = await prisma.orders.count({
          where: {
            tenantId,
            createdAt: {
              gte: dayStart,
              lt: dayEnd,
            },
          },
        });

        return {
          date: format(date, "MMM dd"),
          orders: count,
        };
      }),
    );

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

    // Get product details for top products
    const topProductsWithDetails = await Promise.all(
      topProducts.map(async (item: any) => {
        const product = await prisma.products.findUnique({
          where: { id: item.productId },
        });
        return {
          id: product?.id,
          name: product?.name || "Unknown Product",
          quantity: item._sum.quantity || 0,
          revenue: item._sum.price || 0,
          orders: item._count.id,
        };
      }),
    );

    // Get customer growth by day
    const customerGrowthData = await Promise.all(
      dateRange.map(async (date: Date) => {
        const dayStart = startOfDay(date);
        const dayEnd = startOfDay(subDays(date, -1));

        const count = await prisma.users.count({
          where: {
            tenantId,
            role: "PATIENT",
            createdAt: {
              gte: dayStart,
              lt: dayEnd,
            },
          },
        });

        return {
          date: format(date, "MMM dd"),
          customers: count,
        };
      }),
    );

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
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 },
    );
  }
}
