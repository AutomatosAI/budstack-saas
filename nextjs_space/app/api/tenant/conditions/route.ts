import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantFromRequest, getTenantBySlug } from "@/lib/tenant/tenant";
import { apiError } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slugParam = searchParams.get("slug");

    let tenant;
    if (slugParam) {
      tenant = await getTenantBySlug(slugParam);
    } else {
      tenant = await getTenantFromRequest(request);
    }

    if (!tenant) {
      return apiError(new Error("Tenant not found"), {
        route: "GET /api/tenant/conditions",
        status: 404,
        safeMessage: "Tenant not found",
      });
    }

    const conditions = await prisma.conditions.findMany({
      where: {
        tenantId: tenant.id,
        published: true,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        image: true,
        category: true,
        categoryKey: true,
        description: true, // Needed for potential SEO description
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(conditions);
  } catch (error) {
    console.error("Error fetching conditions:", error);
    return apiError(error, {
      route: "GET /api/tenant/conditions",
      safeMessage: "Internal Server Error",
    });
  }
}
