import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";

/**
 * GET /api/tenant-admin/tenant
 *
 * Fetch tenant data for the authenticated tenant admin.
 * Used to get business name for packing slips and other admin UI elements.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user || !user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch tenant details
    const tenant = await prisma.tenants.findUnique({
      where: { id: user.tenantId },
      select: {
        id: true,
        businessName: true,
        subdomain: true,
        customDomain: true,
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id: tenant.id,
      businessName: tenant.businessName,
      subdomain: tenant.subdomain,
      customDomain: tenant.customDomain,
    });
  } catch (error) {
    console.error("Error fetching tenant:", error);
    return NextResponse.json(
      { error: "Failed to fetch tenant" },
      { status: 500 },
    );
  }
}
