import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import crypto from "crypto";

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
export async function POST(request: NextRequest) {
  try {
    // Check authentication and authorization
    const user = await currentUser();
    if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(user.id);
    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    const body = await request.json();
    const { action, tenantIds } = body;

    // Validate request
    if (!action || !["activate", "deactivate"].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "activate" or "deactivate".' },
        { status: 400 },
      );
    }

    if (!tenantIds || !Array.isArray(tenantIds) || tenantIds.length === 0) {
      return NextResponse.json(
        { error: "No tenant IDs provided." },
        { status: 400 },
      );
    }

    // Get tenants to update (for audit log)
    const tenantsToUpdate = await prisma.tenants.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, businessName: true, subdomain: true, isActive: true },
    });

    if (tenantsToUpdate.length === 0) {
      return NextResponse.json(
        { error: "No valid tenants found." },
        { status: 404 },
      );
    }

    const newStatus = action === "activate";

    // Update all tenants
    const updateResult = await prisma.tenants.updateMany({
      where: { id: { in: tenantIds } },
      data: { isActive: newStatus },
    });

    // Create audit logs for each tenant
    const auditLogs = tenantsToUpdate.map(
      (tenant: {
        id: string;
        businessName: string;
        subdomain: string;
        isActive: boolean;
      }) => ({
        id: crypto.randomUUID(),
        action:
          action === "activate"
            ? "TENANT_BULK_ACTIVATED"
            : "TENANT_BULK_DEACTIVATED",
        entityType: "Tenant",
        entityId: tenant.id,
        userId: user.id,
        userEmail: user.emailAddresses[0]?.emailAddress,
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
    );

    await prisma.audit_logs.createMany({
      data: auditLogs,
    });

    return NextResponse.json({
      message: `${updateResult.count} tenant${updateResult.count === 1 ? "" : "s"} ${action}d successfully`,
      count: updateResult.count,
      action,
    });
  } catch (error) {
    console.error("[POST /api/super-admin/tenants/bulk] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
