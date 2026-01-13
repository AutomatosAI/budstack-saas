import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantFromRequest, getTenantBySlug } from "@/lib/tenant";

export async function GET(
  request: Request,
  { params }: { params: { slug: string } },
) {
  try {
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
          slug: params.slug,
        },
      },
    });

    // If not found and this isn't already the master tenant, fallback to healingbuds
    if (!condition) {
      const masterTenant = await prisma.tenants.findUnique({
        where: { subdomain: "healingbuds" },
        select: { id: true },
      });

      if (masterTenant && masterTenant.id !== tenant.id) {
        condition = await prisma.conditions.findUnique({
          where: {
            tenantId_slug: {
              tenantId: masterTenant.id,
              slug: params.slug,
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
    console.error("Error fetching condition:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
