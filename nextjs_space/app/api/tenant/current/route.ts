import { NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/tenant/tenant";

/**
 * Public endpoint — returns minimal tenant info for store pages.
 * Only exposes fields needed for public rendering (name, subdomain, template slug).
 * Sensitive settings, branding config, and internal IDs are excluded.
 */
export async function GET() {
  try {
    const tenant = await getCurrentTenant();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
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
    return NextResponse.json(
      { error: "Failed to fetch tenant" },
      { status: 500 },
    );
  }
}
