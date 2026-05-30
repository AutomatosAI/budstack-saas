import { NextResponse } from "next/server";
import { withTenantAuthParams } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/tenant-admin/webhooks/[id]/deliveries
 *
 * Get delivery logs for a specific webhook
 */
export const GET = withTenantAuthParams(async (req, { tenantId }, params) => {
  try {
    const { id } = params;

    // Verify webhook belongs to tenant
    const webhook = await prisma.webhooks.findFirst({
      where: { id, tenantId },
    });

    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const [deliveries, total] = await Promise.all([
      prisma.webhookDelivery.findMany({
        where: { webhookId: id },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      prisma.webhookDelivery.count({ where: { webhookId: id } }),
    ]);

    return NextResponse.json({
      deliveries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[API] Error fetching webhook deliveries:", error);
    return NextResponse.json(
      { error: "Failed to fetch webhook deliveries" },
      { status: 500 },
    );
  }
});
