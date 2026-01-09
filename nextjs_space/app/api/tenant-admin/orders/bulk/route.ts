import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * POST /api/tenant-admin/orders/bulk
 * Perform bulk actions on multiple orders
 * Authorization: TENANT_ADMIN or SUPER_ADMIN only
 *
 * Request body:
 * {
 *   action: 'mark-processing' | 'mark-completed',
 *   orderIds: string[]
 * }
 *
 * Note: Bulk cancel is NOT allowed - cancellation requires individual confirmation
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication and authorization
    const session = await getServerSession(authOptions);
    if (!session || !['TENANT_ADMIN', 'SUPER_ADMIN'].includes(session.user.role || '')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting
    const rateLimitResult = checkRateLimit(session.user.id);
    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    // Get user's tenant ID
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

    const tenantId = user.tenantId;

    const body = await request.json();
    const { action, orderIds } = body;

    // Validate request - only allow mark-processing and mark-completed (no bulk cancel)
    if (!action || !['mark-processing', 'mark-completed'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "mark-processing" or "mark-completed". Bulk cancellation is not allowed.' },
        { status: 400 }
      );
    }

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json(
        { error: 'No order IDs provided.' },
        { status: 400 }
      );
    }

    // Get orders to update (ensure they belong to this tenant)
    const ordersToUpdate = await prisma.orders.findMany({
      where: {
        id: { in: orderIds },
        tenantId: tenantId,
      },
      select: { id: true, orderNumber: true, status: true, total: true },
    });

    if (ordersToUpdate.length === 0) {
      return NextResponse.json(
        { error: 'No valid orders found.' },
        { status: 404 }
      );
    }

    // Determine new status
    const newStatus = action === 'mark-processing' ? 'PROCESSING' : 'COMPLETED';

    // Update the orders
    const result = await prisma.orders.updateMany({
      where: {
        id: { in: ordersToUpdate.map((o: { id: string }) => o.id) },
        tenantId: tenantId,
      },
      data: { status: newStatus },
    });

    // Define audit action based on bulk action
    const auditAction = action === 'mark-processing'
      ? 'ORDER_BULK_MARK_PROCESSING'
      : 'ORDER_BULK_MARK_COMPLETED';

    // Create audit logs for each order
    const auditLogs = ordersToUpdate.map((order: { id: string; orderNumber: string; status: string; total: number }) => ({
      action: auditAction,
      entityType: 'Order',
      entityId: order.id,
      userId: session.user.id,
      userEmail: session.user.email,
      tenantId: tenantId,
      metadata: {
        orderNumber: order.orderNumber,
        previousStatus: order.status,
        newStatus: newStatus,
        orderTotal: order.total,
        bulkOperation: true,
        totalInBatch: orderIds.length,
        action: action,
      },
    }));

    await prisma.audit_logs.createMany({
      data: auditLogs,
    });

    // Build message based on action
    const actionMessages: Record<string, string> = {
      'mark-processing': 'marked as Processing',
      'mark-completed': 'marked as Completed',
    };

    return NextResponse.json({
      message: `${result.count} order${result.count === 1 ? '' : 's'} ${actionMessages[action]} successfully`,
      count: result.count,
      action,
    });
  } catch (error) {
    console.error('[POST /api/tenant-admin/orders/bulk] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
