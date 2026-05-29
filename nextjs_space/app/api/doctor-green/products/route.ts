import { NextRequest, NextResponse } from "next/server";
import { fetchProducts } from "@/lib/doctor-green-api";
import { getTenantDrGreenConfig } from "@/lib/tenant-config";

/**
 * GET /api/doctor-green/products?country=PT
 * Fetch products from Doctor Green API - API ONLY (no mock fallback)
 */
export async function GET(request: NextRequest) {
  try {
    // Get country code from query parameter (default to PT)
    const { searchParams } = new URL(request.url);
    const country = searchParams.get("country") || "PT";

    // Get tenant from request to resolve credentials
    const { getTenantFromRequest } = await import("@/lib/tenant");
    const tenant = await getTenantFromRequest(request);

    if (!tenant) {
      return NextResponse.json(
        {
          success: false,
          error: "Tenant not found",
          data: [],
          count: 0,
          source: "api_error",
        },
        { status: 404 },
      );
    }

    const doctorGreenConfig = await getTenantDrGreenConfig(tenant.id);

    // Fetch from Doctor Green API with country code (or tenant default) and config
    const targetCountry = country || tenant.countryCode || "SA";
    const products = await fetchProducts(targetCountry, doctorGreenConfig);

    return NextResponse.json({
      success: true,
      data: products,
      count: products.length,
      country: country,
      source: "api",
    });
  } catch (error) {
    console.error(
      "Doctor Green API Error:",
      error instanceof Error ? error.message : "Unknown error",
    );

    // Return error - NO MOCK FALLBACK (API ONLY). Detail logged above;
    // never echo the raw upstream error to the client.
    return NextResponse.json(
      {
        success: false,
        error: "Doctor Green API unavailable",
        data: [],
        count: 0,
        source: "api_error",
      },
      { status: 500 },
    );
  }
}
