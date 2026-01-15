import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

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
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      user.role !== "TENANT_ADMIN" &&
      user.role !== "SUPER_ADMIN"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tenantId = user.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: "No tenant found for user" }, { status: 404 });
    }

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

    // Get filtered count and paginated orders in parallel
    // Also get counts for filter badges
    const [
      filteredCount,
      orders,
      pendingCount,
      processingCount,
      completedCount,
      cancelledCount,
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
      // Count by status (with search and date filters applied if present)
      prisma.orders.count({
        where: {
          tenantId,
          ...(search
            ? {
              OR: [
                { orderNumber: { contains: search, mode: "insensitive" } },
                {
                  users: { name: { contains: search, mode: "insensitive" } },
                },
                {
                  users: { email: { contains: search, mode: "insensitive" } },
                },
              ],
            }
            : {}),
          ...(dateFrom || dateTo
            ? {
              createdAt: {
                ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                ...(dateTo
                  ? {
                    lte: new Date(
                      new Date(dateTo).setDate(
                        new Date(dateTo).getDate() + 1,
                      ),
                    ),
                  }
                  : {}),
              },
            }
            : {}),
          status: "PENDING",
        },
      }),
      prisma.orders.count({
        where: {
          tenantId,
          ...(search
            ? {
              OR: [
                { orderNumber: { contains: search, mode: "insensitive" } },
                {
                  users: { name: { contains: search, mode: "insensitive" } },
                },
                {
                  users: { email: { contains: search, mode: "insensitive" } },
                },
              ],
            }
            : {}),
          ...(dateFrom || dateTo
            ? {
              createdAt: {
                ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                ...(dateTo
                  ? {
                    lte: new Date(
                      new Date(dateTo).setDate(
                        new Date(dateTo).getDate() + 1,
                      ),
                    ),
                  }
                  : {}),
              },
            }
            : {}),
          status: "PROCESSING",
        },
      }),
      prisma.orders.count({
        where: {
          tenantId,
          ...(search
            ? {
              OR: [
                { orderNumber: { contains: search, mode: "insensitive" } },
                {
                  users: { name: { contains: search, mode: "insensitive" } },
                },
                {
                  users: { email: { contains: search, mode: "insensitive" } },
                },
              ],
            }
            : {}),
          ...(dateFrom || dateTo
            ? {
              createdAt: {
                ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                ...(dateTo
                  ? {
                    lte: new Date(
                      new Date(dateTo).setDate(
                        new Date(dateTo).getDate() + 1,
                      ),
                    ),
                  }
                  : {}),
              },
            }
            : {}),
          status: "COMPLETED",
        },
      }),
      prisma.orders.count({
        where: {
          tenantId,
          ...(search
            ? {
              OR: [
                { orderNumber: { contains: search, mode: "insensitive" } },
                {
                  users: { name: { contains: search, mode: "insensitive" } },
                },
                {
                  users: { email: { contains: search, mode: "insensitive" } },
                },
              ],
            }
            : {}),
          ...(dateFrom || dateTo
            ? {
              createdAt: {
                ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                ...(dateTo
                  ? {
                    lte: new Date(
                      new Date(dateTo).setDate(
                        new Date(dateTo).getDate() + 1,
                      ),
                    ),
                  }
                  : {}),
              },
            }
            : {}),
          status: "CANCELLED",
        },
      }),
    ]);

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
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 },
    );
  }
}

// PATCH: Update order status
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      user.role !== "TENANT_ADMIN" &&
      user.role !== "SUPER_ADMIN"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { orderId, status } = body;

    if (!orderId || !status) {
      return NextResponse.json(
        { error: "Order ID and status are required" },
        { status: 400 },
      );
    }

    // Validate status
    const validStatuses = ["PENDING", "PROCESSING", "COMPLETED", "CANCELLED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const tenantId = user.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: "No tenant found" }, { status: 404 });
    }

    // Verify the order belongs to this tenant
    const order = await prisma.orders.findFirst({
      where: {
        id: orderId,
        tenantId: tenantId,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order not found or access denied" },
        { status: 404 },
      );
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
    console.error("Error updating order status:", error);
    return NextResponse.json(
      { error: "Failed to update order status" },
      { status: 500 },
    );
  }
}
