import { NextResponse } from "next/server";
import { withTenantAuthParams } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { parseUuid } from "@/lib/validation/parse-uuid";

/**
 * GET /api/tenant-admin/orders/[id]
 *
 * Fetch a single order by ID for the authenticated tenant admin.
 * Used for packing slip generation and order detail views.
 */
export const GET = withTenantAuthParams(async (_request, { tenantId }, params) => {
  try {
    const id = parseUuid(params.id);

    // Fetch order with items and user data
    const order = await prisma.orders.findFirst({
      where: {
        id,
        tenantId: tenantId,
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        subtotal: true,
        shippingCost: true,
        createdAt: true,
        shippingAddress: true,
        shippingCity: true,
        shippingState: true,
        shippingPostalCode: true,
        shippingCountry: true,
        phone: true,
        items: {
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
    });

    if (!order) {
      return apiError(new Error("Order not found"), {
        route: "GET /api/tenant-admin/orders/[id]",
        status: 404,
        safeMessage: "Order not found",
      });
    }

    // Transform data to match expected format
    const response = {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total,
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      createdAt: order.createdAt.toISOString(),
      items: order.items,
      user: {
        name: order.users?.name || null,
        email: order.users?.email || "N/A",
      },
      shippingAddress: {
        street: order.shippingAddress || "Not provided",
        city: order.shippingCity || "N/A",
        state: order.shippingState || "N/A",
        postalCode: order.shippingPostalCode || "N/A",
        country: order.shippingCountry || "N/A",
        phone: order.phone || undefined,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    return apiError(error, { route: "GET /api/tenant-admin/orders/[id]" });
  }
});
