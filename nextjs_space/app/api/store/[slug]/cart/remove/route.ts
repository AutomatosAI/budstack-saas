import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant/tenant";
import { getTenantDrGreenConfig } from "@/lib/tenant/tenant-config";
import { removeFromCart } from "@/lib/drgreen/drgreen-cart";
import { apiError, apiValidationError } from "@/lib/api-error";
import { parseSlug } from "@/lib/validation/parse-uuid";

export const DELETE = withAuth(async (request, { user }, params) => {
  try {
    parseSlug(params.slug);

    const email = user.email;
    if (!email) {
      return apiError(new Error("Unauthorized"), {
        route: "DELETE /api/store/[slug]/cart/remove",
        status: 401,
        safeMessage: "Unauthorized",
      });
    }

    // Find linked DB user
    const dbUser = await prisma.users.findFirst({ where: { email } });
    if (!dbUser) {
      return apiError(new Error("User not found"), {
        route: "DELETE /api/store/[slug]/cart/remove",
        status: 404,
        safeMessage: "User not found",
      });
    }

    const { searchParams } = new URL(request.url);
    const strainId = searchParams.get("strainId");

    if (!strainId) {
      return apiValidationError(
        "Missing required parameter: strainId",
        "DELETE /api/store/[slug]/cart/remove",
      );
    }

    // Resolve tenant from middleware headers (works for subdomain, path, and custom domain routing)
    const tenant = await getCurrentTenant();

    if (!tenant) {
      return apiError(new Error("Store not found"), {
        route: "DELETE /api/store/[slug]/cart/remove",
        status: 404,
        safeMessage: "Store not found",
      });
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
});
