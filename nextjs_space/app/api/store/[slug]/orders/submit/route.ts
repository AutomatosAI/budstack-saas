import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantDrGreenConfig } from "@/lib/tenant-config";
import { submitOrder } from "@/lib/drgreen-orders";
import { triggerWebhook, WEBHOOK_EVENTS } from "@/lib/webhook";
import { checkUserKycStatus } from "@/app/actions/kyc-check";

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const traceId = `order-${Date.now()}`;
  const log = (step: string, data?: any) => {
    console.log(`[${traceId}] ${step}`, data !== undefined ? JSON.stringify(data) : '');
  };

  try {
    log('START', { slug: params.slug });

    const user = await currentUser();
    if (!user) {
      log('FAIL: No Clerk user');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = user.emailAddresses[0]?.emailAddress;
    if (!email) {
      log('FAIL: No email on Clerk user');
      return NextResponse.json({ error: "Email not found" }, { status: 401 });
    }

    const dbUser = await prisma.users.findFirst({ where: { email } });
    if (!dbUser) {
      log('FAIL: No DB user', { email });
      return NextResponse.json({ error: "User not found in database" }, { status: 404 });
    }

    log('USER', {
      email,
      dbUserId: dbUser.id,
      drGreenClientId: dbUser.drGreenClientId || 'NONE',
    });

    const body = await request.json();
    const { shippingInfo, cartItems } = body;
    log('REQUEST_BODY', {
      hasShippingInfo: !!shippingInfo,
      cartItemCount: cartItems?.length || 0,
      shippingCountry: shippingInfo?.country,
    });

    if (
      !shippingInfo ||
      !shippingInfo.address1 ||
      !shippingInfo.city ||
      !shippingInfo.state ||
      !shippingInfo.postalCode ||
      !shippingInfo.country
    ) {
      log('FAIL: Missing shipping info');
      return NextResponse.json(
        { error: "Missing required shipping information" },
        { status: 400 },
      );
    }

    const tenant = await getCurrentTenant();
    if (!tenant) {
      log('FAIL: Tenant not found');
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }
    log('TENANT', { tenantId: tenant.id });

    const drGreenConfig = await getTenantDrGreenConfig(tenant.id);
    log('DR_GREEN_CONFIG', {
      apiUrl: drGreenConfig.apiUrl || 'DEFAULT',
      hasApiKey: !!drGreenConfig.apiKey,
      hasSecretKey: !!drGreenConfig.secretKey,
    });

    // KYC verification — reuse the exact same function the dashboard uses.
    // If the dashboard shows this user as Verified, this call returns ACTIVE
    // from the local cache without hitting Dr Green. No duplicated logic, no
    // second Dr Green scan at checkout.
    const kyc = await checkUserKycStatus();
    log('KYC_STATUS', { status: kyc.status, verified: kyc.kycVerified });

    if (!kyc.kycVerified) {
      log('FAIL: KYC not verified', { status: kyc.status, message: kyc.message });
      const message =
        kyc.status === 'API_ERROR'
          ? "Could not verify account status. Please try again."
          : "Medical verification required. Please complete your profile verification.";
      const httpStatus = kyc.status === 'API_ERROR' ? 500 : 403;
      return NextResponse.json({ error: message }, { status: httpStatus });
    }

    // Submit order
    log('SUBMITTING_ORDER', {
      userId: dbUser.id,
      tenantId: tenant.id,
      apiUrl: drGreenConfig.apiUrl,
      clientCartItems: cartItems?.length || 0,
    });

    const orderResponse = await submitOrder({
      userId: dbUser.id,
      tenantId: tenant.id,
      shippingInfo,
      apiKey: drGreenConfig.apiKey,
      secretKey: drGreenConfig.secretKey,
      apiUrl: drGreenConfig.apiUrl,
      clientCartItems: cartItems,
    });

    log('ORDER_RESULT', {
      orderId: orderResponse.orderId,
      drGreenOrderId: orderResponse.drGreenOrderId,
      orderNumber: orderResponse.orderNumber,
      total: orderResponse.total,
    });

    // Trigger webhook
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

    log('SUCCESS');
    return NextResponse.json({ order: orderResponse });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack?.split('\n').slice(0, 3).join(' | ') : '';
    log('UNHANDLED_ERROR', { message: msg, stack });

    if (error instanceof Error) {
      if (error.message.includes("consultation")) {
        return NextResponse.json(
          { error: "Please complete your medical consultation before placing orders" },
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
