import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

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

    // Parse request body
    const body = await request.json();
    const { products } = body;

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: "Invalid products array" },
        { status: 400 },
      );
    }

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

    // Update display order for each product
    await Promise.all(
      products.map((product: { id: string; displayOrder: number }) =>
        prisma.products.update({
          where: { id: product.id },
          data: { displayOrder: product.displayOrder },
        }),
      ),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating product order:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
