import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTenantDrGreenConfig } from "@/lib/tenant-config";
import { submitOrder } from "@/lib/drgreen-orders";
import { triggerWebhook, WEBHOOK_EVENTS } from "@/lib/webhook";

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // Submit order
    const orderResponse = await submitOrder({
      userId: session.user.id,
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
        userId: session.user.id,
        userEmail: session.user.email,
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
