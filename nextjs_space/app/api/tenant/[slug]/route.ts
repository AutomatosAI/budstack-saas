import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const GET = withAuth(async (_request, { user }, { slug }) => {
  try {
    if (!slug) {
      return NextResponse.json({ error: "Slug is required" }, { status: 400 });
    }

    const tenant = await prisma.tenants.findUnique({
      where: {
        subdomain: slug,
      },
      include: {
        template: true,
        tenant_branding: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Only allow access to own tenant (or super admin)
    if (user.role !== "SUPER_ADMIN" && user.tenantId !== tenant.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      tenant: {
        id: tenant.id,
        businessName: tenant.businessName,
        subdomain: tenant.subdomain,
        settings: tenant.settings,
        template: tenant.template,
        branding: tenant.tenant_branding,
      },
    });
  } catch (error) {
    console.error("Error fetching tenant:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
});
