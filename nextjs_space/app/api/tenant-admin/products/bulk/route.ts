import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * POST /api/tenant-admin/products/bulk
 * Perform bulk actions on multiple products
 * Authorization: TENANT_ADMIN or SUPER_ADMIN only
 *
 * Request body:
 * {
 *   action: 'set-in-stock' | 'set-out-of-stock' | 'delete',
 *   productIds: string[]
 * }
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
    const { action, productIds } = body;

    // Validate request
    if (!action || !['set-in-stock', 'set-out-of-stock', 'delete'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "set-in-stock", "set-out-of-stock", or "delete".' },
        { status: 400 }
      );
    }

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: 'No product IDs provided.' },
        { status: 400 }
      );
    }

    // Get products to update (ensure they belong to this tenant)
    const productsToUpdate = await prisma.products.findMany({
      where: {
        id: { in: productIds },
        tenantId: tenantId,
      },
      select: { id: true, name: true, stock: true, category: true },
    });

    if (productsToUpdate.length === 0) {
      return NextResponse.json(
        { error: 'No valid products found.' },
        { status: 404 }
      );
    }

    let result: { count: number };
    let auditAction: string;

    if (action === 'delete') {
      // Delete the products
      result = await prisma.products.deleteMany({
        where: {
          id: { in: productsToUpdate.map((p: { id: string }) => p.id) },
          tenantId: tenantId,
        },
      });
      auditAction = 'PRODUCT_BULK_DELETED';
    } else {
      // Set stock status
      const newStock = action === 'set-in-stock' ? 1 : 0;
      result = await prisma.products.updateMany({
        where: {
          id: { in: productsToUpdate.map((p: { id: string }) => p.id) },
          tenantId: tenantId,
        },
        data: { stock: newStock },
      });
      auditAction = action === 'set-in-stock'
        ? 'PRODUCT_BULK_SET_IN_STOCK'
        : 'PRODUCT_BULK_SET_OUT_OF_STOCK';
    }

    // Create audit logs for each product
    const auditLogs = productsToUpdate.map((product: { id: string; name: string; stock: number; category: string | null }) => ({
      action: auditAction,
      entityType: 'Product',
      entityId: product.id,
      userId: session.user.id,
      userEmail: session.user.email,
      tenantId: tenantId,
      metadata: {
        productName: product.name,
        category: product.category,
        previousStock: product.stock,
        newStock: action === 'delete' ? null : (action === 'set-in-stock' ? 1 : 0),
        bulkOperation: true,
        totalInBatch: productIds.length,
        action: action,
      },
    }));

    await prisma.audit_logs.createMany({
      data: auditLogs,
    });

    // Build message based on action
    const actionMessages: Record<string, string> = {
      'set-in-stock': 'set to In Stock',
      'set-out-of-stock': 'set to Out of Stock',
      'delete': 'deleted',
    };

    return NextResponse.json({
      message: `${result.count} product${result.count === 1 ? '' : 's'} ${actionMessages[action]} successfully`,
      count: result.count,
      action,
    });
  } catch (error) {
    console.error('[POST /api/tenant-admin/products/bulk] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
