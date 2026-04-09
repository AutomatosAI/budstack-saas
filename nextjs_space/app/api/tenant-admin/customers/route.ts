import { NextRequest, NextResponse } from "next/server";
import { withTenantAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/tenant-admin/customers
 * List customers for current tenant
 */
export const GET = withTenantAuth(async (request: NextRequest, { tenantId }) => {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status");

  const where: any = {
    role: "PATIENT",
    tenantId,
  };

  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status === "active") {
    where.isActive = true;
  } else if (status === "inactive") {
    where.isActive = false;
  }

  const [total, customers] = await Promise.all([
    prisma.users.count({ where }),
    prisma.users.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        phone: true,
        address: true,
        isActive: true,
        createdAt: true,
        tenantId: true,
        _count: {
          select: {
            orders: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    customers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});
