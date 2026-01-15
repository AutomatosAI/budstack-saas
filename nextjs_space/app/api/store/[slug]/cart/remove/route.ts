import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getTenantDrGreenConfig } from "@/lib/tenant-config";
import { removeFromCart } from "@/lib/drgreen-cart";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } },
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

    const { searchParams } = new URL(request.url);
    const strainId = searchParams.get("strainId");

    if (!strainId) {
      return NextResponse.json(
        { error: "Missing required parameter: strainId" },
        { status: 400 },
      );
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

    // Remove from cart
    const cart = await removeFromCart({
      userId: dbUser.id,
      tenantId: tenant.id,
      strainId,
      apiKey: drGreenConfig.apiKey,
      secretKey: drGreenConfig.secretKey,
    });

    return NextResponse.json({ cart });
  } catch (error) {
    console.error("[Cart Remove] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to remove item from cart",
      },
      { status: 500 },
    );
  }
}
