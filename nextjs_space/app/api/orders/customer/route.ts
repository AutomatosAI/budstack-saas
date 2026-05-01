import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getTenantFromRequest } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const user = await currentUser();

    if (!user?.emailAddresses?.[0]?.emailAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = user.emailAddresses[0]?.emailAddress;

    const tenant = await getTenantFromRequest(req);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const dbUser = await prisma.users.findFirst({
      where: { email, tenantId: tenant.id },
    });

    if (!dbUser) {
      return NextResponse.json({ orders: [] });
    }

    const orders = await prisma.orders.findMany({
      where: {
        userId: dbUser.id,
        tenantId: tenant.id,
      },
      include: {
        items: true,
        tenant: {
          select: {
            businessName: true,
            subdomain: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Error fetching customer orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 },
    );
  }
}
