import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";

export const GET = withAuth(async (_req, { user }) => {
  try {
    const email = user.email;
    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 401 });
    }

    const dbUser = await prisma.users.findFirst({
      where: { email },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const tenant = await getCurrentTenant();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Get orders for the current user AND specific tenant
    const orders = await prisma.orders.findMany({
      where: {
        userId: dbUser.id,
        tenantId: tenant.id,
      },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Tenant orders fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 },
    );
  }
});
