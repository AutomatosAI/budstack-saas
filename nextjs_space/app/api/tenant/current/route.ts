import { NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/tenant/tenant";
import { apiError } from "@/lib/api-error";

/**
 * Public endpoint — returns minimal tenant info for store pages.
 * Only exposes fields needed for public rendering (name, subdomain, template slug).
 * Sensitive settings, branding config, and internal IDs are excluded.
 */
export async function GET() {
  try {
    const tenant = await getCurrentTenant();

    if (!tenant) {
      return apiError(new Error("Tenant not found"), {
        route: "GET /api/tenant/current",
        status: 404,
        safeMessage: "Tenant not found",
      });
    }

    // Return only public-safe fields — no internal settings or config
    return NextResponse.json({
      id: tenant.id,
      businessName: tenant.businessName,
      subdomain: tenant.subdomain,
      country: tenant.country,
      isActive: tenant.isActive,
    });
  } catch (error) {
    console.error("Error fetching tenant:", error);
    return apiError(error, {
      route: "GET /api/tenant/current",
      safeMessage: "Failed to fetch tenant",
    });
  }
}
