import { NextResponse } from "next/server";
import { withTenantAuth } from "@/lib/api-auth";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/security/rate-limit";
import crypto from "crypto";
import { apiError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";

const productBulkSchema = z
  .object({
    action: z.enum(["set-in-stock", "set-out-of-stock", "delete"]),
    productIds: z.array(z.string().min(1).max(200)).min(1).max(1000),
  })
  .strict();

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
export const POST = withTenantAuth(async (request, { user, tenantId }) => {
  try {
    // Rate limiting
    const rateLimitResult = await checkRateLimit(user.id);
    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    const { action, productIds } = await parseJsonBody(
      request,
      productBulkSchema,
    );

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
        { error: "No valid products found." },
        { status: 404 },
      );
    }

    let result: { count: number };
    let auditAction: string;

    if (action === "delete") {
      // Delete the products
      result = await prisma.products.deleteMany({
        where: {
          id: { in: productsToUpdate.map((p: { id: string }) => p.id) },
          tenantId: tenantId,
        },
      });
      auditAction = "PRODUCT_BULK_DELETED";
    } else {
      // Set stock status
      const newStock = action === "set-in-stock" ? 1 : 0;
      result = await prisma.products.updateMany({
        where: {
          id: { in: productsToUpdate.map((p: { id: string }) => p.id) },
          tenantId: tenantId,
        },
        data: { stock: newStock },
      });
      auditAction =
        action === "set-in-stock"
          ? "PRODUCT_BULK_SET_IN_STOCK"
          : "PRODUCT_BULK_SET_OUT_OF_STOCK";
    }

    // Create audit logs for each product
    const auditLogs = productsToUpdate.map(
      (product: {
        id: string;
        name: string;
        stock: number;
        category: string | null;
      }) => ({
        id: crypto.randomUUID(),
        action: auditAction,
        entityType: "Product",
        entityId: product.id,
        userId: user.id,
        userEmail: user.email,
        tenantId: tenantId,
        metadata: {
          productName: product.name,
          category: product.category,
          previousStock: product.stock,
          newStock:
            action === "delete" ? null : action === "set-in-stock" ? 1 : 0,
          bulkOperation: true,
          totalInBatch: productIds.length,
          action: action,
        },
      }),
    );

    await prisma.audit_logs.createMany({
      data: auditLogs,
    });

    // Build message based on action
    const actionMessages: Record<string, string> = {
      "set-in-stock": "set to In Stock",
      "set-out-of-stock": "set to Out of Stock",
      delete: "deleted",
    };

    return NextResponse.json({
      message: `${result.count} product${result.count === 1 ? "" : "s"} ${actionMessages[action]} successfully`,
      count: result.count,
      action,
    });
  } catch (error) {
    return apiError(error, { route: "POST /api/tenant-admin/products/bulk" });
  }
});
