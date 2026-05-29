import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import { withTenantContext } from "@/lib/with-tenant-context";

async function getCustomerOrders(_req: NextRequest): Promise<NextResponse> {
  try {
    const user = await currentUser();

    if (!user?.emailAddresses?.[0]?.emailAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = user.emailAddresses[0]?.emailAddress;

    // PRD-202 AC-4: withTenantContext (see export below) resolves and binds the
    // request's tenant at the boundary, so read it from the confined context
    // instead of re-resolving here. A null id means no tenant resolved → 404.
    const tenantId = getTenantContext();
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const dbUser = await prisma.users.findFirst({
      where: { email, tenantId },
    });

    if (!dbUser) {
      return NextResponse.json({ orders: [] });
    }

    const orders = await prisma.orders.findMany({
      where: {
        userId: dbUser.id,
        tenantId,
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

// PRD-202 AC-4 pilot — bind tenant context at the request boundary. The whole
// handler runs inside runWithTenantContextAsync(resolvedTenantId, ...), so every
// tenant-scoped Prisma query executes under the correct, confined context and can
// never observe a concurrent request's tenant. PRD-203's withTenantAuth composes
// this same wrapper to migrate the rest of the routes.
export const GET = withTenantContext(getCustomerOrders);
