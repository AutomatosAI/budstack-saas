import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant/tenant";
import { getTenantDrGreenConfig } from "@/lib/tenant/tenant-config";
import { submitOrder } from "@/lib/drgreen/drgreen-orders";
import { triggerWebhook, WEBHOOK_EVENTS } from "@/lib/integrations/webhook";
import { checkUserKycStatus } from "@/app/actions/kyc-check";
import { apiError, apiValidationError } from "@/lib/api-error";
import { parseSlug } from "@/lib/validation/parse-uuid";
import { parseJsonBody } from "@/lib/validation/body";
import { logger } from "@/lib/logger";

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

export const POST = withAuth(async (request, { user }, { slug }) => {
  const traceId = `order-${Date.now()}`;
  const log = (step: string, data?: any) => {
    logger.info(`[${traceId}] ${step}`, data !== undefined ? { data } : undefined);
  };

  try {
    parseSlug(slug);
    log('START', { slug });

    const email = user.email;
    if (!email) {
      log('FAIL: No email on Clerk user');
      return apiError(new Error("Email not found"), {
        route: "POST /api/store/[slug]/orders/submit",
        status: 401,
        safeMessage: "Email not found",
      });
    }

    const dbUser = await prisma.users.findFirst({ where: { email } });
    if (!dbUser) {
      log('FAIL: No DB user', { email });
      return apiError(new Error("User not found in database"), {
        route: "POST /api/store/[slug]/orders/submit",
        status: 404,
        safeMessage: "User not found in database",
      });
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
      return apiError(new Error("Store not found"), {
        route: "POST /api/store/[slug]/orders/submit",
        status: 404,
        safeMessage: "Store not found",
      });
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
      return apiError(new Error(message), {
        route: "POST /api/store/[slug]/orders/submit",
        status: httpStatus,
        safeMessage: message,
      });
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
        return apiValidationError(
          "Please complete your medical consultation before placing orders",
          "POST /api/store/[slug]/orders/submit",
        );
      }
      if (error.message.includes("empty")) {
        return apiValidationError(
          "Your cart is empty. Add items before placing an order.",
          "POST /api/store/[slug]/orders/submit",
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
      logContext: { traceId, slug },
    });
  }
});
