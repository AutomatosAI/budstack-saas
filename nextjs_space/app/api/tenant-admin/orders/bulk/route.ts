import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenantAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import crypto from "crypto";
import { apiError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";

const orderBulkSchema = z
  .object({
    action: z.enum(["mark-processing", "mark-completed"]),
    orderIds: z.array(z.string().min(1).max(200)).min(1).max(1000),
  })
  .strict();

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
export const POST = withTenantAuth(async (request, { user, tenantId }) => {
  try {
    // Rate limiting
    const rateLimitResult = await checkRateLimit(user.id);
    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    const { action, orderIds } = await parseJsonBody(request, orderBulkSchema);

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
        { error: "No valid orders found." },
        { status: 404 },
      );
    }

    // Determine new status
    const newStatus = action === "mark-processing" ? "PROCESSING" : "COMPLETED";

    // Update the orders
    const result = await prisma.orders.updateMany({
      where: {
        id: { in: ordersToUpdate.map((o: { id: string }) => o.id) },
        tenantId: tenantId,
      },
      data: { status: newStatus },
    });

    // Define audit action based on bulk action
    const auditAction =
      action === "mark-processing"
        ? "ORDER_BULK_MARK_PROCESSING"
        : "ORDER_BULK_MARK_COMPLETED";

    // Create audit logs for each order
    const auditLogs = ordersToUpdate.map(
      (order: {
        id: string;
        orderNumber: string;
        status: string;
        total: number;
      }) => ({
        id: crypto.randomUUID(),
        action: auditAction,
        entityType: "Order",
        entityId: order.id,
        userId: user.id,
        userEmail: user.email!,
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
      }),
    );

    await prisma.audit_logs.createMany({
      data: auditLogs,
    });

    // Build message based on action
    const actionMessages: Record<string, string> = {
      "mark-processing": "marked as Processing",
      "mark-completed": "marked as Completed",
    };

    return NextResponse.json({
      message: `${result.count} order${result.count === 1 ? "" : "s"} ${actionMessages[action]} successfully`,
      count: result.count,
      action,
    });
  } catch (error) {
    return apiError(error, { route: "POST /api/tenant-admin/orders/bulk" });
  }
});
