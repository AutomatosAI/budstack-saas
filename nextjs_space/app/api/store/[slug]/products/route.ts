import { NextRequest, NextResponse } from "next/server";
import { fetchProducts } from "@/lib/doctor-green-api";
import { getTenantBySlug } from "@/lib/tenant";
import { getTenantDrGreenConfig } from "@/lib/tenant-config";

/**
 * GET /api/store/[slug]/products
 * Fetch products for a specific tenant's country
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  // Declare tenant outside try block for error handling scope
  let tenant = null;

  try {
    const { slug } = params;
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("id");

    tenant = await getTenantBySlug(slug);

    if (!tenant) {
      return NextResponse.json(
        {
          success: false,
          error: "Tenant not found",
          data: [],
          count: 0,
        },
        { status: 404 },
      );
    }

    const country = tenant.countryCode || "ZA";
    const doctorGreenConfig = await getTenantDrGreenConfig(tenant.id);

    // Single product: fetch all products once, find the one we need + similar
    if (productId) {
      const allProducts = await fetchProducts(country, doctorGreenConfig);
      const product = allProducts.find((p) => p.id === productId);

      if (!product) {
        return NextResponse.json(
          { success: false, error: "Product not found", data: null },
          { status: 404 },
        );
      }

      const similarProducts = allProducts
        .filter((p) => p.id !== productId && p.type === product.type && p.isAvailable)
        .slice(0, 4);

      return NextResponse.json({
        success: true,
        data: product,
        similarProducts,
        country,
        tenant: { businessName: tenant.businessName, subdomain: tenant.subdomain },
        source: "api",
      });
    }

    // All products
    const products = await fetchProducts(country, doctorGreenConfig);
    return NextResponse.json({
      success: true,
      data: products,
      count: products.length,
      country: country,
      tenant: {
        businessName: tenant.businessName,
        subdomain: tenant.subdomain,
      },
      source: "api",
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Doctor Green API Error:", errorMessage);

    // Return specific error for missing credentials
    if (
      errorMessage.includes("MISSING_CREDENTIALS") ||
      errorMessage.includes("Dr Green API credentials are not configured")
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Dr Green API Keys missing. Please configure them in the Tenant Admin Dashboard.",
          data: [],
          count: 0,
          source: "api_error",
          tenant: tenant
            ? {
                businessName: tenant.businessName,
                subdomain: tenant.subdomain,
              }
            : undefined,
        },
        { status: 500 },
      ); // Or 400? Keeping 500 for server config error
    }

    // Return generic error - NO MOCK FALLBACK (API ONLY)
    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch products: ${errorMessage}`,
        data: [],
        count: 0,
        source: "api_error",
        tenant: tenant
          ? {
              businessName: tenant.businessName,
              subdomain: tenant.subdomain,
            }
          : undefined,
      },
      { status: 500 },
    );
  }
}
