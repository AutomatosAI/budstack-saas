import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/tenant-admin/orders/[id]
 *
 * Fetch a single order by ID for the authenticated tenant admin.
 * Used for packing slip generation and order detail views.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = user.emailAddresses[0]?.emailAddress;

    // Fetch user's tenant
    const localUser = await prisma.users.findFirst({
      where: { email: email },
      select: { tenantId: true },
    });

    if (!localUser?.tenantId) {
      return NextResponse.json(
        { error: "No tenant associated with user" },
        { status: 403 },
      );
    }

    // Fetch order with items and user data
    const order = await prisma.orders.findFirst({
      where: {
        id: params.id,
        tenantId: localUser.tenantId,
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
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
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
    console.error("Error fetching order:", error);
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 },
    );
  }
}
