import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenantAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { apiError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";

const orderUpdateSchema = z
  .object({
    orderId: z.string().min(1).max(200),
    status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "CANCELLED"]),
  })
  .strict();

/** Default pagination settings */
const DEFAULT_PAGE_SIZE = 20;
const VALID_PAGE_SIZES = [10, 20, 50, 100];

/** Valid sort columns for orders table */
const VALID_SORT_COLUMNS = [
  "orderNumber",
  "status",
  "total",
  "createdAt",
] as const;
type SortColumn = (typeof VALID_SORT_COLUMNS)[number];

// GET: Fetch orders for tenant with optional pagination, search, and filters
export const GET = withTenantAuth(async (req, { tenantId }) => {
  try {
    // Parse query params
    const { searchParams } = new URL(req.url);
    const pageParam = parseInt(searchParams.get("page") || "1", 10);
    const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

    const pageSizeParam = parseInt(
      searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE),
      10,
    );
    const pageSize = VALID_PAGE_SIZES.includes(pageSizeParam)
      ? pageSizeParam
      : DEFAULT_PAGE_SIZE;

    const search = searchParams.get("search")?.trim() || "";
    const statusFilter = searchParams.get("status") || "all";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";

    // Parse sort params
    const sortByParam = searchParams.get("sortBy");
    const sortOrderParam = searchParams.get("sortOrder");
    const sortBy =
      sortByParam && VALID_SORT_COLUMNS.includes(sortByParam as SortColumn)
        ? (sortByParam as SortColumn)
        : null;
    const sortOrder =
      sortOrderParam === "asc" || sortOrderParam === "desc"
        ? sortOrderParam
        : "asc";

    // Build Prisma where clause
    const whereClause: Prisma.ordersWhereInput = {
      tenantId,
    };

    // Apply search filter (across orderNumber, customer name, customer email)
    if (search) {
      whereClause.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { users: { name: { contains: search, mode: "insensitive" } } },
        { users: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Apply status filter
    const validStatuses = ["PENDING", "PROCESSING", "COMPLETED", "CANCELLED"];
    if (statusFilter !== "all" && validStatuses.includes(statusFilter)) {
      whereClause.status =
        statusFilter as Prisma.EnumOrderStatusFilter<"orders">;
    }

    // Apply date range filter
    if (dateFrom || dateTo) {
      whereClause.createdAt = {};
      if (dateFrom) {
        whereClause.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        // Add one day to include the entire end date
        const endDate = new Date(dateTo);
        endDate.setDate(endDate.getDate() + 1);
        whereClause.createdAt.lte = endDate;
      }
    }

    // Calculate skip for pagination
    const skip = (page - 1) * pageSize;

    // Build orderBy clause - default to createdAt desc if no sort specified
    const orderBy: Prisma.ordersOrderByWithRelationInput = sortBy
      ? { [sortBy]: sortOrder }
      : { createdAt: "desc" };

    // Build base filter (without status) for badge counts
    const baseFilter: any = {
      tenantId,
      ...(search
        ? {
          OR: [
            { orderNumber: { contains: search, mode: "insensitive" } },
            { users: { name: { contains: search, mode: "insensitive" } } },
            { users: { email: { contains: search, mode: "insensitive" } } },
          ],
        }
        : {}),
      ...(dateFrom || dateTo
        ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo
              ? { lte: new Date(new Date(dateTo).setDate(new Date(dateTo).getDate() + 1)) }
              : {}),
          },
        }
        : {}),
    };

    // Get filtered count, paginated orders, and status badge counts in parallel
    // Uses groupBy for status counts (1 query instead of 4)
    const [
      filteredCount,
      orders,
      statusGroups,
    ] = await Promise.all([
      prisma.orders.count({ where: whereClause }),
      prisma.orders.findMany({
        where: whereClause,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          subtotal: true,
          shippingCost: true,
          createdAt: true,
          adminNotes: true,
          order_items: {
            select: {
              id: true,
              productName: true,
              quantity: true,
              price: true,
            },
          },
          users: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      prisma.orders.groupBy({
        by: ["status"],
        where: baseFilter,
        _count: { id: true },
      }),
    ]);

    // Build status count map from single groupBy result
    const statusCountMap = Object.fromEntries(
      statusGroups.map((g: any) => [g.status, g._count.id])
    );
    const pendingCount = statusCountMap["PENDING"] || 0;
    const processingCount = statusCountMap["PROCESSING"] || 0;
    const completedCount = statusCountMap["COMPLETED"] || 0;
    const cancelledCount = statusCountMap["CANCELLED"] || 0;

    // Transform orders to match expected format (rename order_items to items, users to user)
    const transformedOrders = orders.map((order: any) => ({
      ...order,
      items: order.order_items,
      user: order.users,
      order_items: undefined,
      users: undefined,
    }));

    return NextResponse.json({
      orders: transformedOrders,
      totalCount: filteredCount,
      statusCounts: {
        PENDING: pendingCount,
        PROCESSING: processingCount,
        COMPLETED: completedCount,
        CANCELLED: cancelledCount,
      },
      pagination: {
        page,
        pageSize,
        totalPages: Math.ceil(filteredCount / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching tenant orders:", error);
    return apiError(error, {
      route: "GET /api/tenant-admin/orders",
      safeMessage: "Failed to fetch orders",
    });
  }
});

// PATCH: Update order status
export const PATCH = withTenantAuth(async (req, { tenantId }) => {
  try {
    const { orderId, status } = await parseJsonBody(req, orderUpdateSchema);

    // Verify the order belongs to this tenant
    const order = await prisma.orders.findFirst({
      where: {
        id: orderId,
        tenantId: tenantId,
      },
    });

    if (!order) {
      return apiError(new Error("Order not found or access denied"), {
        route: "PATCH /api/tenant-admin/orders",
        status: 404,
        safeMessage: "Order not found or access denied",
      });
    }

    // Update order status
    const updatedOrder = await prisma.orders.update({
      where: { id: orderId },
      data: { status },
      include: {
        items: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ order: updatedOrder });
  } catch (error) {
    return apiError(error, {
      route: "PATCH /api/tenant-admin/orders",
      safeMessage: "Failed to update order status",
    });
  }
});
