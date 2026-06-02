import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenantAuthParams } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { parseUuid } from "@/lib/validation/parse-uuid";
import { parseJsonBody } from "@/lib/validation/body";

const adminNotesSchema = z
  .object({
    adminNotes: z.string().max(5000),
  })
  .strict();

/**
 * PATCH: Update admin notes for an order
 * Only accessible to tenant admins and super admins
 * Notes are internal and not visible to customers
 */
export const PATCH = withTenantAuthParams(async (req, { tenantId }, params) => {
  try {
    const orderId = parseUuid(params.id);
    const { adminNotes } = await parseJsonBody(req, adminNotesSchema);

    // Verify the order belongs to this tenant
    const order = await prisma.orders.findFirst({
      where: {
        id: orderId,
        tenantId: tenantId,
      },
    });

    if (!order) {
      return apiError(new Error("Order not found or access denied"), {
        route: "PATCH /api/tenant-admin/orders/[id]/admin-notes",
        status: 404,
        safeMessage: "Order not found or access denied",
      });
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
    return apiError(error, { route: "PATCH /api/tenant-admin/orders/[id]/admin-notes" });
  }
});
