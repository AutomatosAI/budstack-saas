import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";

const productReorderSchema = z
  .object({
    products: z
      .array(
        z.object({
          id: z.string().min(1).max(200),
          displayOrder: z.number().int(),
        }),
      )
      .min(1)
      .max(1000),
  })
  .strict();

/**
 * POST /api/tenant-admin/products/reorder
 * Update product display order
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (
      !user ||
      (user.role !== "TENANT_ADMIN" &&
        user.role !== "SUPER_ADMIN")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(user.id);
    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    const tenantId = user.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { products } = await parseJsonBody(request, productReorderSchema);

    // Validate all products belong to the tenant
    const productIds = products.map((p: { id: string }) => p.id);
    const existingProducts = await prisma.products.findMany({
      where: {
        id: { in: productIds },
        tenantId,
      },
      select: { id: true },
    });

    if (existingProducts.length !== productIds.length) {
      return NextResponse.json(
        { error: "Some products not found or unauthorized" },
        { status: 403 },
      );
    }

    // Update display order in a single transaction (atomic, reduces round trips)
    await prisma.$transaction(
      products.map((product: { id: string; displayOrder: number }) =>
        prisma.products.update({
          where: { id: product.id },
          data: { displayOrder: product.displayOrder },
        }),
      ),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, { route: "POST /api/tenant-admin/products/reorder" });
  }
}
