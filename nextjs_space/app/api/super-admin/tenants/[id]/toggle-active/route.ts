import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";

/**
 * PATCH /api/super-admin/tenants/[id]/toggle-active
 * Toggle tenant active status
 * Authorization: SUPER_ADMIN only
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Check authentication and authorization
    const user = await currentUser();
    if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current tenant
    const tenant = await prisma.tenants.findUnique({
      where: { id: params.id },
      select: { id: true, businessName: true, subdomain: true, isActive: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Toggle active status
    const updatedTenant = await prisma.tenants.update({
      where: { id: params.id },
      data: {
        isActive: !tenant.isActive,
      },
    });

    // Create audit log
    await prisma.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        action: tenant.isActive ? "TENANT_DEACTIVATED" : "TENANT_ACTIVATED",
        entityType: "Tenant",
        entityId: params.id,
        userId: user.id,
        userEmail: user.emailAddresses[0]?.emailAddress,
        tenantId: params.id,
        metadata: {
          businessName: tenant.businessName,
          subdomain: tenant.subdomain,
          previousStatus: tenant.isActive,
          newStatus: !tenant.isActive,
        },
      },
    });

    return NextResponse.json({
      message: `Tenant ${updatedTenant.isActive ? "activated" : "deactivated"} successfully`,
      tenant: updatedTenant,
    });
  } catch (error) {
    console.error(
      `[PATCH /api/super-admin/tenants/${params.id}/toggle-active] Error:`,
      error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
