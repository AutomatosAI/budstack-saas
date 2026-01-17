import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getTenantDrGreenConfig } from "@/lib/tenant-config";
import { submitOrder } from "@/lib/drgreen-orders";
import { triggerWebhook, WEBHOOK_EVENTS } from "@/lib/webhook";

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

    const dbUser = await prisma.users.findFirst({
      where: { email },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found in database" }, { status: 404 });
    }

    const body = await request.json();
    const { shippingInfo } = body;

    // Validate shipping info
    if (
      !shippingInfo ||
      !shippingInfo.address1 ||
      !shippingInfo.city ||
      !shippingInfo.state ||
      !shippingInfo.postalCode ||
      !shippingInfo.country
    ) {
      return NextResponse.json(
        { error: "Missing required shipping information" },
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

    // Check local verification first (manual override)
    const localQuestionnaire = await prisma.consultation_questionnaires.findFirst({
      where: {
        AND: [
          { tenantId: tenant.id },
          { email: { equals: dbUser.email, mode: 'insensitive' } },
          { isKycVerified: true }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    // Only verify with API if NOT locally verified
    if (!localQuestionnaire) {
      if (!dbUser.drGreenClientId) {
        return NextResponse.json(
          { error: "Account verification incomplete (Missing ID)." },
          { status: 403 },
        );
      }

      const { fetchClient } = await import("@/lib/doctor-green-api");
      try {
        const client = await fetchClient(dbUser.drGreenClientId, drGreenConfig);
        if (client.status !== "ACTIVE" || !client.verified) {
          return NextResponse.json(
            {
              error:
                "Medical verification required. Please complete your profile verification.",
            },
            { status: 403 },
          );
        }
      } catch (apiError) {
        console.error("KYC Check Failed during Order:", apiError);
        return NextResponse.json(
          { error: "Could not verify account status. Please try again." },
          { status: 500 },
        );
      }
    }

    // Submit order
    const orderResponse = await submitOrder({
      userId: dbUser.id,
      tenantId: tenant.id,
      shippingInfo,
      apiKey: drGreenConfig.apiKey,
      secretKey: drGreenConfig.secretKey,
    });

    // Trigger webhook for order creation
    await triggerWebhook({
      event: WEBHOOK_EVENTS.ORDER_CREATED,
      tenantId: tenant.id,
      data: {
        orderId: orderResponse.orderId,
        drGreenOrderId: orderResponse.drGreenOrderId,
        orderNumber: orderResponse.orderNumber,
        total: orderResponse.total,
        userId: dbUser.id,
        userEmail: email,
      },
    });

    return NextResponse.json({ order: orderResponse });
  } catch (error) {
    console.error("[Order Submit] Error:", error);

    // User-friendly error messages
    if (error instanceof Error) {
      if (error.message.includes("consultation")) {
        return NextResponse.json(
          {
            error:
              "Please complete your medical consultation before placing orders",
          },
          { status: 400 },
        );
      }

      if (error.message.includes("empty")) {
        return NextResponse.json(
          { error: "Your cart is empty. Add items before placing an order." },
          { status: 400 },
        );
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Failed to submit order" },
      { status: 500 },
    );
  }
}
