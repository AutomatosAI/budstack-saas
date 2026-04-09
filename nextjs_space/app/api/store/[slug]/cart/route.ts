import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantDrGreenConfig } from "@/lib/tenant-config";
import { getCart } from "@/lib/drgreen-cart";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    console.error("[Cart GET] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get cart" },
      { status: 500 },
    );
  }
}
