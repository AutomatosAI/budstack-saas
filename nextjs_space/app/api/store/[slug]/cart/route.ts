import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getCurrentTenant } from "@/lib/tenant/tenant";
import { getTenantDrGreenConfig } from "@/lib/tenant/tenant-config";
import { getCart } from "@/lib/drgreen/drgreen-cart";
import { apiError } from "@/lib/api-error";
import { parseSlug } from "@/lib/validation/parse-uuid";

export const GET = withAuth(async (_request, { user }, params) => {
  try {
    parseSlug(params.slug);

    // Resolve tenant from middleware headers (works for subdomain, path, and custom domain routing)
    const tenant = await getCurrentTenant();

    if (!tenant) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // Get Dr. Green credentials
    const drGreenConfig = await getTenantDrGreenConfig(tenant.id);

    // Get cart
    const cart = await getCart({
      userId: user.id,
      tenantId: tenant.id,
      apiKey: drGreenConfig.apiKey,
      secretKey: drGreenConfig.secretKey,
      apiUrl: drGreenConfig.apiUrl,
    });

    return NextResponse.json({ cart });
  } catch (error) {
    return apiError(error, {
      route: "GET /api/store/[slug]/cart",
      safeMessage: "Failed to get cart",
    });
  }
});
