import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantDrGreenConfig } from "@/lib/tenant-config";
import { submitOrder } from "@/lib/drgreen-orders";
import { triggerWebhook, WEBHOOK_EVENTS } from "@/lib/webhook";
import { checkUserKycStatus } from "@/app/actions/kyc-check";
import { apiError } from "@/lib/api-error";
import { parseSlug } from "@/lib/validation/parse-uuid";
import { parseJsonBody } from "@/lib/validation/body";

const orderSubmitSchema = z
  .object({
    shippingInfo: z
      .object({
        address1: z.string().min(1).max(200),
        address2: z.string().max(200).optional(),
        city: z.string().min(1).max(120),
        state: z.string().min(1).max(120),
        postalCode: z.string().min(1).max(20),
        country: z.string().min(1).max(120),
        countryCode: z.string().max(10).optional(),
      })
      .strict(),
    cartItems: z
      .array(
        z
          .object({
            strainId: z.string().min(1).max(200),
            quantity: z.number().int().min(1).max(10000),
          })
          .passthrough(),
      )
      .max(500)
      .optional(),
  })
  .strict();

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const traceId = `order-${Date.now()}`;
  const log = (step: string, data?: any) => {
    console.log(`[${traceId}] ${step}`, data !== undefined ? JSON.stringify(data) : '');
  };

  try {
    parseSlug(params.slug);
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

    const { shippingInfo, cartItems } = await parseJsonBody(
      request,
      orderSubmitSchema,
    );
    log('REQUEST_BODY', {
      hasShippingInfo: !!shippingInfo,
      cartItemCount: cartItems?.length || 0,
      shippingCountry: shippingInfo?.country,
    });

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
    log('UNHANDLED_ERROR', { message: msg });

    // Pass through known-safe user-facing messages — these are cases
    // where the user can self-correct (no consultation, empty cart).
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
    }

    // SECURITY (H_e1): generic internal error message — orders flow may
    // raise Dr Green API errors with internal endpoints/IDs in the
    // message; never propagate them to the storefront client.
    return apiError(error, {
      route: "store.orders.submit",
      status: 500,
      safeMessage: "Failed to submit order",
      logContext: { traceId, slug: params.slug },
    });
  }
}
