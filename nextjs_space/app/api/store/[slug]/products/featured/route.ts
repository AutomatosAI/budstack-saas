import { NextRequest, NextResponse } from "next/server";
import { fetchProducts } from "@/lib/doctor-green-api";
import { getTenantBySlug } from "@/lib/tenant";
import { getTenantDrGreenConfig } from "@/lib/tenant-config";
import { ApiError, apiError } from "@/lib/api-error";
import { parseSlug } from "@/lib/validation/parse-uuid";

/**
 * GET /api/store/[slug]/products/featured?ids=id1,id2,id3
 *
 * Returns a subset of products by ID for the ProductShowcase section.
 * If no ids param, returns nothing (not the full catalog).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");

    if (!idsParam) {
      return NextResponse.json({ success: true, data: [] });
    }

    const requestedIds = idsParam.split(",").filter(Boolean);
    if (requestedIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const slug = parseSlug(params.slug);
    const tenant = await getTenantBySlug(slug);
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: "Tenant not found", data: [] },
        { status: 404 },
      );
    }

    const country = tenant.countryCode || "ZA";
    const doctorGreenConfig = await getTenantDrGreenConfig(tenant.id);
    const allProducts = await fetchProducts(country, doctorGreenConfig);

    const idSet = new Set(requestedIds);
    const matched = allProducts.filter((p) => idSet.has(p.id));

    // Preserve the order from the ids param
    const ordered = requestedIds
      .map((id) => matched.find((p) => p.id === id))
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      data: ordered,
      count: ordered.length,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return apiError(error, { route: "GET /api/store/[slug]/products/featured" });
    }

    const msg = error instanceof Error ? error.message : "Unknown error";

    if (msg.includes("MISSING_CREDENTIALS")) {
      return NextResponse.json({
        success: false,
        missingCredentials: true,
        error: "Dr Green API not configured",
        data: [],
      });
    }

    console.error("[featured products] Error:", msg);
    return NextResponse.json(
      { success: false, error: "Failed to fetch featured products", data: [] },
      { status: 500 },
    );
  }
}
