import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withSuperAdminParams } from "@/lib/api-auth";
import { ApiError } from "@/lib/api-error";
import { createAuditLog } from "@/lib/audit-log";

/**
 * PATCH /api/super-admin/tenants/[id]/toggle-active
 * Toggle tenant active status
 * Authorization: SUPER_ADMIN only
 */
export const PATCH = withSuperAdminParams(async (_req, { user }, params) => {
  const tenant = await prisma.tenants.findUnique({
    where: { id: params.id },
    select: { id: true, businessName: true, subdomain: true, isActive: true },
  });

  if (!tenant) {
    throw new ApiError("Tenant not found", 404);
  }

  const updatedTenant = await prisma.tenants.update({
    where: { id: params.id },
    data: {
      isActive: !tenant.isActive,
    },
  });

  await createAuditLog({
    action: tenant.isActive ? "TENANT_DEACTIVATED" : "TENANT_ACTIVATED",
    entityType: "Tenant",
    entityId: params.id,
    userId: user.id,
    userEmail: user.email,
    tenantId: params.id,
    metadata: {
      businessName: tenant.businessName,
      subdomain: tenant.subdomain,
      previousStatus: tenant.isActive,
      newStatus: !tenant.isActive,
    },
  });

  return NextResponse.json({
    message: `Tenant ${updatedTenant.isActive ? "activated" : "deactivated"} successfully`,
    tenant: updatedTenant,
  });
});
