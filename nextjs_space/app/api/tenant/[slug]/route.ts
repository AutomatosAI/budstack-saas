import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { parseSlug } from "@/lib/validation/parse-uuid";

export const GET = withAuth(async (_request, { user }, params) => {
  try {
    const slug = parseSlug(params.slug);

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
    return apiError(error, { route: "GET /api/tenant/[slug]" });
  }
});
