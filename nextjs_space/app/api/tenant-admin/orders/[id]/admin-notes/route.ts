import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * PATCH: Update admin notes for an order
 * Only accessible to tenant admins and super admins
 * Notes are internal and not visible to customers
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'TENANT_ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orderId = params.id;
    const body = await req.json();
    const { adminNotes } = body;

    if (typeof adminNotes !== 'string') {
      return NextResponse.json(
        { error: 'Admin notes must be a string' },
        { status: 400 }
      );
    }

    // Get user's tenant
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      include: { tenants: true },
    });

    if (!user?.tenant) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 });
    }

    // Verify the order belongs to this tenant
    const order = await prisma.orders.findFirst({
      where: {
        id: orderId,
        tenantId: user.tenant.id,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found or access denied' },
        { status: 404 }
      );
    }

    // Update admin notes
    const updatedOrder = await prisma.orders.update({
      where: { id: orderId },
      data: {
        adminNotes: adminNotes.trim() || null,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        adminNotes: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      adminNotes: updatedOrder.adminNotes,
      updatedAt: updatedOrder.updatedAt,
    });
  } catch (error) {
    console.error('Error updating admin notes:', error);
    return NextResponse.json(
      { error: 'Failed to update admin notes' },
      { status: 500 }
    );
  }
}
