import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantDrGreenConfig } from "@/lib/tenant-config";
import { removeFromCart } from "@/lib/drgreen-cart";
import { apiError } from "@/lib/api-error";
import { parseSlug } from "@/lib/validation/parse-uuid";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    parseSlug(params.slug);

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

    // Resolve tenant from middleware headers (works for subdomain, path, and custom domain routing)
    const tenant = await getCurrentTenant();

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
      apiUrl: drGreenConfig.apiUrl,
    });

    return NextResponse.json({ cart });
  } catch (error) {
    return apiError(error, {
      route: "DELETE /api/store/[slug]/cart/remove",
      safeMessage: "Failed to remove item from cart",
    });
  }
}
