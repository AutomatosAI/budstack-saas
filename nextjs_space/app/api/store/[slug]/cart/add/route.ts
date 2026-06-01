import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant/tenant";
import { getTenantDrGreenConfig } from "@/lib/tenant/tenant-config";
import { addToCart } from "@/lib/drgreen/drgreen-cart";
import { apiError } from "@/lib/api-error";
import { parseSlug } from "@/lib/validation/parse-uuid";
import { parseJsonBody } from "@/lib/validation/body";

const cartAddSchema = z
  .object({
    strainId: z.string().min(1).max(200),
    quantity: z.number().int().min(1).max(1000),
    size: z.union([z.literal(2), z.literal(5), z.literal(10)]),
  })
  .strict();

export const POST = withAuth(async (request, { user }, { slug }) => {
  try {
    parseSlug(slug);

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

    const { strainId, quantity, size } = await parseJsonBody(
      request,
      cartAddSchema,
    );

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
