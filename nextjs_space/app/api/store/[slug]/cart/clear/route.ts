import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant/tenant";
import { getTenantDrGreenConfig } from "@/lib/tenant/tenant-config";
import { clearCart } from "@/lib/drgreen/drgreen-cart";
import { apiError } from "@/lib/api-error";
import { parseSlug } from "@/lib/validation/parse-uuid";

export const DELETE = withAuth(async (_request, { user }, params) => {
  try {
    parseSlug(params.slug);

    const email = user.email;
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find linked DB user
    const dbUser = await prisma.users.findFirst({ where: { email } });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Resolve tenant from middleware headers (works for subdomain, path, and custom domain routing)
    const tenant = await getCurrentTenant();

    if (!tenant) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // Get Dr. Green credentials
    const drGreenConfig = await getTenantDrGreenConfig(tenant.id);

    // Clear cart
    await clearCart({
      userId: dbUser.id,
      tenantId: tenant.id,
      apiKey: drGreenConfig.apiKey,
      secretKey: drGreenConfig.secretKey,
      apiUrl: drGreenConfig.apiUrl,
    });

    return NextResponse.json({ success: true, message: "Cart cleared" });
  } catch (error) {
    return apiError(error, {
      route: "DELETE /api/store/[slug]/cart/clear",
      safeMessage: "Failed to clear cart",
    });
  }
});
