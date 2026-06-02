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
      return apiError(new Error("Unauthorized"), {
        route: "DELETE /api/store/[slug]/cart/clear",
        status: 401,
        safeMessage: "Unauthorized",
      });
    }

    // Find linked DB user
    const dbUser = await prisma.users.findFirst({ where: { email } });
    if (!dbUser) {
      return apiError(new Error("User not found"), {
        route: "DELETE /api/store/[slug]/cart/clear",
        status: 404,
        safeMessage: "User not found",
      });
    }

    // Resolve tenant from middleware headers (works for subdomain, path, and custom domain routing)
    const tenant = await getCurrentTenant();

    if (!tenant) {
      return apiError(new Error("Store not found"), {
        route: "DELETE /api/store/[slug]/cart/clear",
        status: 404,
        safeMessage: "Store not found",
      });
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
