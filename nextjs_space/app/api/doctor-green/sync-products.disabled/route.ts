import { NextRequest, NextResponse } from "next/server";
import { fetchProducts } from "@/lib/doctor-green-api";
import { prisma } from "@/lib/db";

/**
 * POST /api/doctor-green/sync-products
 * Sync products from Doctor Green API to database
 */
export async function POST(request: NextRequest) {
  try {
    // Get tenant ID from request (will be from auth session in production)
    const { tenantId } = await request.json();

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "Tenant ID required" },
        { status: 400 },
      );
    }

    // Fetch tenant-specific Dr Green Config
    const { getTenantDrGreenConfig } = await import("@/lib/tenant-config");
    const doctorGreenConfig = await getTenantDrGreenConfig(tenantId);

    // Fetch products from Doctor Green
    const dgProducts = await fetchProducts("SA", doctorGreenConfig); // Default to SA if country not in sync payload

    // Sync products to database
    const syncedProducts = [];

    for (const dgProduct of dgProducts) {
      // Map Doctor Green product to our schema
      const productData = {
        tenantId,
        doctorGreenId: dgProduct.id,
        doctorGreenData: dgProduct as any,
        name: dgProduct.name,
        slug: dgProduct.name
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^\w-]/g, ""),
        description: dgProduct.description || "",
        strainType: dgProduct.strain_type || "HYBRID",
        thcContent: dgProduct.thc_content || 0,
        cbdContent: dgProduct.cbd_content || 0,
        price: dgProduct.price || 0,
        image: dgProduct.image_url || null,
        images: dgProduct.images || [],
        inStock: dgProduct.in_stock ?? true,
        stockQuantity: dgProduct.stock_quantity || 0,
        lastSyncedAt: new Date(),
      };

      // Check if product exists
      const existingProduct = await prisma.products.findFirst({
        where: {
          tenantId,
          doctorGreenId: dgProduct.id,
        },
      });

      // Upsert product
      const product = existingProduct
        ? await prisma.products.update({
            where: { id: existingProduct.id },
            data: {
              ...productData,
              updatedAt: new Date(),
            },
          })
        : await prisma.products.create({
            data: productData,
          });

      syncedProducts.push(product);
    }

    // Update tenant's last sync time
    await prisma.tenants.update({
      where: { id: tenantId },
      data: { lastProductSync: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${syncedProducts.length} products`,
      data: syncedProducts,
    });
  } catch (error) {
    console.error("Error syncing Doctor Green products:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to sync products",
      },
      { status: 500 },
    );
  }
}
