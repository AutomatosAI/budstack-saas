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
      return apiError(new Error("Tenant not found"), {
        route: "GET /api/tenant/[slug]",
        status: 404,
        safeMessage: "Tenant not found",
      });
    }

    // Only allow access to own tenant (or super admin)
    if (user.role !== "SUPER_ADMIN" && user.tenantId !== tenant.id) {
      return apiError(new Error("Forbidden"), {
        route: "GET /api/tenant/[slug]",
        status: 403,
        safeMessage: "Forbidden",
      });
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
