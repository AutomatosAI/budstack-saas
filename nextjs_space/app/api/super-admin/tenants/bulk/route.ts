import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { withSuperAdmin } from "@/lib/api-auth";
import { apiValidationError, ApiError } from "@/lib/api-error";
import { createAuditLog } from "@/lib/audit-log";

/**
 * POST /api/super-admin/tenants/bulk
 * Perform bulk actions on multiple tenants
 * Authorization: SUPER_ADMIN only
 *
 * Request body:
 * {
 *   action: 'activate' | 'deactivate',
 *   tenantIds: string[]
 * }
 */
export const POST = withSuperAdmin(async (request, { user }) => {
  const rateLimitResult = await checkRateLimit(user.id);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const body = await request.json();
  const { action, tenantIds } = body;

  if (!action || !["activate", "deactivate"].includes(action)) {
    return apiValidationError(
      'Invalid action. Must be "activate" or "deactivate".',
      "POST /api/super-admin/tenants/bulk",
    );
  }

  if (!tenantIds || !Array.isArray(tenantIds) || tenantIds.length === 0) {
    return apiValidationError(
      "No tenant IDs provided.",
      "POST /api/super-admin/tenants/bulk",
    );
  }

  const tenantsToUpdate = await prisma.tenants.findMany({
    where: { id: { in: tenantIds } },
    select: { id: true, businessName: true, subdomain: true, isActive: true },
  });

  if (tenantsToUpdate.length === 0) {
    throw new ApiError("No valid tenants found.", 404);
  }

  const newStatus = action === "activate";

  const updateResult = await prisma.tenants.updateMany({
    where: { id: { in: tenantIds } },
    data: { isActive: newStatus },
  });

  await Promise.all(
    tenantsToUpdate.map((tenant: { id: string; businessName: string; subdomain: string; isActive: boolean }) =>
      createAuditLog({
        action:
          action === "activate"
            ? "TENANT_BULK_ACTIVATED"
            : "TENANT_BULK_DEACTIVATED",
        entityType: "Tenant",
        entityId: tenant.id,
        userId: user.id,
        userEmail: user.email,
        tenantId: tenant.id,
        metadata: {
          businessName: tenant.businessName,
          subdomain: tenant.subdomain,
          previousStatus: tenant.isActive,
          newStatus: newStatus,
          bulkOperation: true,
          totalInBatch: tenantIds.length,
        },
      }),
    ),
  );

  return NextResponse.json({
    message: `${updateResult.count} tenant${updateResult.count === 1 ? "" : "s"} ${action}d successfully`,
    count: updateResult.count,
    action,
  });
});
