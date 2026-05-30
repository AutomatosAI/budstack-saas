import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantDrGreenConfig } from "@/lib/tenant-config";
import { addToCart } from "@/lib/drgreen-cart";
import { apiError } from "@/lib/api-error";

export const POST = withAuth(async (request, { user }, { slug }) => {
  try {
    const email = user.email;
    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 401 });
    }

    const dbUser = await prisma.users.findUnique({
      where: { email },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found in database" }, { status: 404 });
    }

    const body = await request.json();
    const { strainId, quantity, size } = body;

    // Validate input
    if (!strainId || !quantity || !size) {
      return NextResponse.json(
        { error: "Missing required fields: strainId, quantity, size" },
        { status: 400 },
      );
    }

    if (![2, 5, 10].includes(size)) {
      return NextResponse.json(
        { error: "Size must be 2, 5, or 10 grams" },
        { status: 400 },
      );
    }

    if (quantity < 1) {
      return NextResponse.json(
        { error: "Quantity must be at least 1" },
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

    // Add to cart
    const cart = await addToCart({
      userId: dbUser.id,
      tenantId: tenant.id,
      strainId,
      quantity,
      size,
      apiKey: drGreenConfig.apiKey,
      secretKey: drGreenConfig.secretKey,
      apiUrl: drGreenConfig.apiUrl,
    });

    return NextResponse.json({ cart });
  } catch (error) {
    // Pass through known-safe user-facing message.
    if (error instanceof Error && error.message.includes("consultation")) {
      return NextResponse.json(
        {
          error:
            "Please complete your medical consultation before adding items to cart",
        },
        { status: 400 },
      );
    }

    // SECURITY (H_e1): generic message — Dr Green API errors may include
    // internal endpoints, IDs, or stack traces.
    return apiError(error, {
      route: "store.cart.add",
      status: 500,
      safeMessage: "Failed to add item to cart",
      logContext: { slug },
    });
  }
});
