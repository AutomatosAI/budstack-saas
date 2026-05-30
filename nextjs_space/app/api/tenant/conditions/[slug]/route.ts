import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantFromRequest, getTenantBySlug } from "@/lib/tenant";
import { apiError } from "@/lib/api-error";
import { parseSlug } from "@/lib/validation/parse-uuid";

export async function GET(
  request: Request,
  { params }: { params: { slug: string } },
) {
  try {
    const slug = parseSlug(params.slug);
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get("tenantSlug");

    let tenant;
    if (tenantSlug) {
      tenant = await getTenantBySlug(tenantSlug);
    } else {
      tenant = await getTenantFromRequest(request);
    }

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // First, try to find condition for the current tenant
    let condition = await prisma.conditions.findUnique({
      where: {
        tenantId_slug: {
          tenantId: tenant.id,
          slug,
        },
      },
    });

    // If not found and a master tenant is configured, fallback to shared conditions
    const masterSlug = process.env.PLATFORM_MASTER_TENANT_SLUG;
    if (!condition && masterSlug) {
      const masterTenant = await prisma.tenants.findUnique({
        where: { subdomain: masterSlug },
        select: { id: true },
      });

      if (masterTenant && masterTenant.id !== tenant.id) {
        condition = await prisma.conditions.findUnique({
          where: {
            tenantId_slug: {
              tenantId: masterTenant.id,
              slug,
            },
          },
        });
      }
    }

    if (!condition) {
      return NextResponse.json(
        { error: "Condition not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(condition);
  } catch (error) {
    return apiError(error, { route: "GET /api/tenant/conditions/[slug]" });
  }
}
