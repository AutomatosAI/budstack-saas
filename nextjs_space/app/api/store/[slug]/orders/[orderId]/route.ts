import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTenantDrGreenConfig } from "@/lib/tenant-config";
import { getOrder } from "@/lib/drgreen-orders";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; orderId: string } },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get tenant by slug
    const tenant = await prisma.tenants.findUnique({
      where: { subdomain: params.slug },
      select: { id: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // Get Dr. Green credentials
    const drGreenConfig = await getTenantDrGreenConfig(tenant.id);

    // Get order (with Dr. Green sync)
    const order = await getOrder({
      orderId: params.orderId,
      userId: session.user.id,
      tenantId: tenant.id,
      apiKey: drGreenConfig.apiKey,
      secretKey: drGreenConfig.secretKey,
    });

    return NextResponse.json({ order });
  } catch (error) {
    console.error("[Order Get] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get order" },
      { status: 500 },
    );
  }
}
