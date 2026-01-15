import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getTenantDrGreenConfig } from "@/lib/tenant-config";
import { getOrder } from "@/lib/drgreen-orders";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; orderId: string } },
) {
  try {
    const user = await currentUser();

    if (!user?.emailAddresses?.[0]?.emailAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = user.emailAddresses[0].emailAddress;

    // Find linked DB user
    const dbUser = await prisma.users.findFirst({ where: { email } });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
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
      userId: dbUser.id,
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
