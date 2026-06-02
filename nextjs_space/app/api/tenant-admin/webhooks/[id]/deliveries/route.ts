import { NextResponse } from "next/server";
import { withTenantAuthParams } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { parseUuid } from "@/lib/validation/parse-uuid";

/**
 * GET /api/tenant-admin/webhooks/[id]/deliveries
 *
 * Get delivery logs for a specific webhook
 */
export const GET = withTenantAuthParams(async (req, { tenantId }, params) => {
  try {
    const id = parseUuid(params.id);

    // Verify webhook belongs to tenant
    const webhook = await prisma.webhooks.findFirst({
      where: { id, tenantId },
    });

    if (!webhook) {
      return apiError(new Error("Webhook not found"), {
        route: "GET /api/tenant-admin/webhooks/[id]/deliveries",
        status: 404,
        safeMessage: "Webhook not found",
      });
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
    return apiError(error, { route: "GET /api/tenant-admin/webhooks/[id]/deliveries" });
  }
});
