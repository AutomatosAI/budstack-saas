import { NextRequest, NextResponse } from "next/server";
import { withTenantAuth } from "@/lib/api-auth";
import { fetchProducts } from "@/lib/doctor-green-api";
import { getTenantDrGreenConfig } from "@/lib/tenant-config";
import { prisma } from "@/lib/db";

/**
 * GET /api/tenant-admin/products/list
 *
 * Lightweight product list for the store editor product picker.
 * Returns Dr Green API products (what customers see) with minimal fields.
 */
export const GET = withTenantAuth(async (req, { tenantId }) => {
  try {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { countryCode: true },
    });

    const country = tenant?.countryCode || "ZA";
    const drGreenConfig = await getTenantDrGreenConfig(tenantId);
    const products = await fetchProducts(country, drGreenConfig);

    // Return only the fields the picker needs
    const slim = products.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      imageUrl: p.imageUrl || p.image_url,
      retailPrice: p.retailPrice ?? p.price ?? 0,
      isAvailable: p.isAvailable ?? p.in_stock ?? true,
    }));

    return NextResponse.json({ success: true, data: slim });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";

    if (msg.includes("MISSING_CREDENTIALS")) {
      return NextResponse.json({
        success: true,
        data: [],
        missingCredentials: true,
      });
    }

    console.error("[products/list] Error:", msg);
    return NextResponse.json(
      { success: false, error: "Failed to load products", data: [] },
      { status: 500 },
    );
  }
});
