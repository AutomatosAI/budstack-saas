import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/tenant-admin/orders/[id]
 *
 * Fetch a single order by ID for the authenticated tenant admin.
 * Used for packing slip generation and order detail views.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch user's tenant
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json(
        { error: 'No tenant associated with user' },
        { status: 403 }
      );
    }

    // Fetch order with items and user data
    const order = await prisma.orders.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
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
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
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
        email: order.users?.email || 'N/A',
      },
      shippingAddress: {
        street: order.shippingAddress || 'Not provided',
        city: order.shippingCity || 'N/A',
        state: order.shippingState || 'N/A',
        postalCode: order.shippingPostalCode || 'N/A',
        country: order.shippingCountry || 'N/A',
        phone: order.phone || undefined,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}
