import { NextResponse } from "next/server";
// Force rebuild: 1
import { z } from "zod";
import { withSuperAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";
import crypto from "crypto";

const createTenantSchema = z
  .object({
    businessName: z.string().min(1).max(200),
    subdomain: z.string().min(1).max(100),
    countryCode: z.string().max(10).optional().nullable(),
    adminEmail: z.string().min(1).max(320),
    adminFirstName: z.string().max(120).optional().nullable(),
    adminLastName: z.string().max(120).optional().nullable(),
    adminPassword: z.string().min(1).max(200),
  })
  .strict();

/**
 * GET /api/super-admin/tenants
 * List all tenants with pagination and filtering
 * Authorization: SUPER_ADMIN only
 */
export const GET = withSuperAdmin(async (request, { user }) => {
  try {
    const rateLimitResult = await checkRateLimit(user.id);
    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    const { searchParams } = new URL(request.url);
    let page = parseInt(searchParams.get("page") || "1", 10);
    let limit = parseInt(searchParams.get("limit") || "10", 10);

    // Enforce safety defaults to prevent NaN or division by zero
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 10;
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");
    const country = searchParams.get("country") || "";

    const where: Prisma.tenantsWhereInput = {};

    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: "insensitive" } },
        { subdomain: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status === "active") {
      where.isActive = true;
    } else if (status === "inactive") {
      where.isActive = false;
    }

    if (country) {
      where.countryCode = country;
    }

    const total = await prisma.tenants.count({ where });

    const tenants = await prisma.tenants.findMany({
      where,
      include: {
        users: {
          where: { role: "TENANT_ADMIN" },
          select: {
            id: true,
            email: true,
            name: true,
            firstName: true,
            lastName: true,
            createdAt: true,
          },
          take: 1,
        },
        _count: {
          select: {
            users: true,
            products: true,
            orders: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json({
      tenants,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return apiError(error, {
      route: "GET /api/super-admin/tenants",
      safeMessage: "Internal server error",
    });
  }
});

/**
 * POST /api/super-admin/tenants
 * Create a new tenant with admin user
 * Authorization: SUPER_ADMIN only
 */
export const POST = withSuperAdmin(async (request, { user }) => {
  try {
    const rateLimitResult = await checkRateLimit(user.id);
    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    const {
      businessName,
      subdomain,
      countryCode,
      adminEmail,
      adminFirstName,
      adminLastName,
      adminPassword,
    } = await parseJsonBody(request, createTenantSchema);

    const existingTenant = await prisma.tenants.findUnique({
      where: { subdomain },
    });

    if (existingTenant) {
      return NextResponse.json(
        { error: "Subdomain already exists" },
        { status: 400 },
      );
    }

    const existingUser = await prisma.users.findFirst({
      where: { email: adminEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 400 },
      );
    }

    // Use placeholder password as auth is handled by Clerk
    const placeholderPassword = `clerk_managed_${crypto.randomUUID()}`;

    const tenant = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const newTenant = await tx.tenants.create({
          data: {
            id: crypto.randomUUID(),
            businessName,
            subdomain,
            countryCode: countryCode || "PT",
            isActive: true,
            updatedAt: new Date(),
          },
        });

        await tx.users.create({
          data: {
            id: crypto.randomUUID(),
            email: adminEmail,
            password: placeholderPassword,
            name:
              `${adminFirstName || ""} ${adminLastName || ""}`.trim() ||
              adminEmail,
            firstName: adminFirstName,
            lastName: adminLastName,
            role: "TENANT_ADMIN",
            tenantId: newTenant.id,
            isActive: true,
            updatedAt: new Date(),
          },
        });

        await tx.tenant_branding.create({
          data: {
            id: crypto.randomUUID(),
            tenantId: newTenant.id,
            updatedAt: new Date(),
          },
        });

        return newTenant;
      },
    );

    await prisma.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        action: "TENANT_CREATED",
        entityType: "Tenant",
        entityId: tenant.id,
        userId: user.id,
        userEmail: user.email,
        metadata: {
          businessName,
          subdomain,
          adminEmail,
        },
      },
    });

    return NextResponse.json(
      {
        message: "Tenant created successfully",
        tenant,
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error, {
      route: "POST /api/super-admin/tenants",
      safeMessage: "Internal server error",
    });
  }
});
