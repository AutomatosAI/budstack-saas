import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { withSuperAdmin } from "@/lib/api-auth";
import { ApiError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";
import { createAuditLog } from "@/lib/audit-log";

const bulkActionSchema = z
  .object({
    action: z.enum(["activate", "deactivate"]),
    tenantIds: z.array(z.string().min(1).max(200)).min(1).max(1000),
  })
  .strict();

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

  const { action, tenantIds } = await parseJsonBody(request, bulkActionSchema);

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
