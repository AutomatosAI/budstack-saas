import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { parseSlug } from "@/lib/validation/parse-uuid";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const slug = parseSlug(params.slug);

    // Require authentication — this route exposes settings and branding
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return apiError(error, { route: "GET /api/tenant/[slug]" });
  }
}
