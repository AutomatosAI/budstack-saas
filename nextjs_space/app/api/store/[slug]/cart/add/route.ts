import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getTenantDrGreenConfig } from "@/lib/tenant-config";
import { addToCart } from "@/lib/drgreen-cart";

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = user.emailAddresses[0]?.emailAddress;
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

    // Add to cart
    const cart = await addToCart({
      userId: dbUser.id,
      tenantId: tenant.id,
      strainId,
      quantity,
      size,
      apiKey: drGreenConfig.apiKey,
      secretKey: drGreenConfig.secretKey,
    });

    return NextResponse.json({ cart });
  } catch (error) {
    console.error("[Cart Add] Error:", error);

    // User-friendly error messages
    if (error instanceof Error) {
      if (error.message.includes("consultation")) {
        return NextResponse.json(
          {
            error:
              "Please complete your medical consultation before adding items to cart",
          },
          { status: 400 },
        );
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Failed to add item to cart" },
      { status: 500 },
    );
  }
}
