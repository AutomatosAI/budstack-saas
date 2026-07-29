import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant/tenant";
import { getTenantDrGreenConfig } from "@/lib/tenant/tenant-config";
import { submitOrder, createDirectCheckout } from "@/lib/drgreen/drgreen-orders";
import { getPublicClientIp } from "@/lib/client-ip";
import { syncOrderById } from "@/lib/orders/storefront-orders";
import { isDirectPaySupported } from "@/lib/payments/direct-pay";
import { storefrontUrl } from "@/lib/storefront-url";
import { fetchProducts } from "@/lib/drgreen/doctor-green-api";
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

    // ── Cart reconciliation (guard) ──────────────────────────────────────
    // A persisted cart can hold strain ids that were removed, went out of
    // stock, or were recreated with a new id. Sending a dead id makes Dr Green
    // 400 the WHOLE order. Validate against the live catalog and drop anything
    // no longer available, so a stale item can never fail a customer's order.
    let itemsToOrder = cartItems;
    if (cartItems && cartItems.length > 0) {
      const country = tenant.countryCode || "ZA";
      const liveProducts = await fetchProducts(country, drGreenConfig);
      const availableIds = new Set(
        liveProducts.filter((p) => p.isAvailable !== false).map((p) => p.id),
      );
      itemsToOrder = cartItems.filter((i) => availableIds.has(i.strainId));
      const dropped = cartItems.filter((i) => !availableIds.has(i.strainId));
      if (dropped.length > 0) {
        log('CART_RECONCILE_DROPPED', { dropped: dropped.map((d) => d.strainId) });
      }
      if (itemsToOrder.length === 0) {
        log('FAIL: all cart items unavailable', { sent: cartItems.map((c) => c.strainId) });
        return apiValidationError(
          "The items in your cart are no longer available. Please refresh your cart and add them again.",
          "POST /api/store/[slug]/orders/submit",
        );
      }
    }

    // Submit order
    log('SUBMITTING_ORDER', {
      userId: dbUser.id,
      tenantId: tenant.id,
      apiUrl: drGreenConfig.apiUrl,
      clientCartItems: itemsToOrder?.length || 0,
    });

    // Decide the payment flow BEFORE creating the order so Dr Green can gate the
    // "order placed" admin email at creation: DIRECT (pay-at-checkout) defers it
    // to payment success; LINK (email-link fallback) emails the orders team now.
    const directPayEnabled =
      isDirectPaySupported(tenant.countryCode) &&
      (tenant.settings as any)?.directPayments !== false;

    const orderResponse = await submitOrder({
      userId: dbUser.id,
      tenantId: tenant.id,
      shippingInfo,
      apiKey: drGreenConfig.apiKey,
      secretKey: drGreenConfig.secretKey,
      apiUrl: drGreenConfig.apiUrl,
      clientCartItems: itemsToOrder,
      paymentFlow: directPayEnabled ? "DIRECT" : "LINK",
    });

    log('ORDER_RESULT', {
      orderId: orderResponse.orderId,
      drGreenOrderId: orderResponse.drGreenOrderId,
      orderNumber: orderResponse.orderNumber,
      total: orderResponse.total,
    });

    // ── Direct pay-at-checkout ───────────────────────────────────────────
    // Budstacks is direct-pay-first: the customer pays upfront wherever a
    // provider is wired for their market (ZA/ZAR via PayCloud today); other
    // markets fall back to the email-link flow. Per-tenant opt-out via
    // settings.directPayments===false; global kill via DIRECT_PAY_DISABLED.
    let payUrl: string | undefined;
    // DIRECT stores are pay-upfront: an order with no minted checkout is a
    // FAILED checkout, not a placed order. Reported to the caller so the
    // storefront can say so instead of showing a confirmation. Always false on
    // email-link stores, where an unminted order is the normal, correct state.
    let paymentStartFailed = false;
    if (directPayEnabled && orderResponse.drGreenOrderId) {
      const host = request.headers.get("host") || "";
      const origin =
        request.headers.get("origin") || (host ? `https://${host}` : "");
      // Retry the mint. A single backend blip must not strand a pay-upfront
      // order: on 2026-07-29 a production task exited mid-request, the ALB
      // returned a 502 in 87ms, and one LekkerWeed order was created with no
      // payment ever started. Transient by nature — the replacement task was
      // healthy ~2 minutes later.
      const MINT_ATTEMPTS = 3;
      for (let attempt = 1; attempt <= MINT_ATTEMPTS; attempt++) {
        try {
          const checkout = await createDirectCheckout({
            drGreenOrderId: orderResponse.drGreenOrderId,
            // Tenant hosts ({slug}.budstacks.io / custom domains) serve the
            // store at root; the legacy "/store/<slug>" path 404s there.
            returnUrl: storefrontUrl(
              origin,
              host,
              slug,
              `/payment/return/${orderResponse.orderId}`,
            ),
            apiKey: drGreenConfig.apiKey,
            secretKey: drGreenConfig.secretKey,
            apiUrl: drGreenConfig.apiUrl,
            // US-008: the shopper's IP becomes PayCloud's term_ip fraud hint —
            // without it the transaction is attributed to this server's egress.
            customerIp: getPublicClientIp(request.headers),
          });
          payUrl = checkout.payUrl;
          log("DIRECT_CHECKOUT", {
            hasPayUrl: !!payUrl,
            expiresAt: checkout.expiresAt,
            attempt,
          });
          break;
        } catch (e) {
          const lastAttempt = attempt === MINT_ATTEMPTS;
          log("DIRECT_CHECKOUT_ATTEMPT_FAILED", {
            attempt,
            lastAttempt,
            error: e instanceof Error ? e.message : String(e),
          });
          if (!lastAttempt) {
            await new Promise((r) => setTimeout(r, 400 * attempt));
            continue;
          }
          // Out of attempts on a pay-upfront store. The Dr Green order stays:
          // it is still payable by retrying via /orders/{id}/pay, or through
          // the email-link flow on admin approval. But the customer must NOT
          // be told the order is placed. The abandoned-order sweep releases
          // its stock if nobody ever pays.
          paymentStartFailed = true;
          log("DIRECT_CHECKOUT_FAILED", {
            error: e instanceof Error ? e.message : String(e),
            attempts: MINT_ATTEMPTS,
          });
        }
      }
    }

    // The PayCloud mint (re)writes Dr Green's invoiceNumber; capture it now so
    // our stored order number matches Dr Green admin + the customer emails,
    // without waiting for the customer to re-open the dashboard. Best-effort.
    if (orderResponse.drGreenOrderId) {
      await syncOrderById(orderResponse.orderId, {
        apiKey: drGreenConfig.apiKey,
        secretKey: drGreenConfig.secretKey,
        apiUrl: drGreenConfig.apiUrl,
      }).catch(() => {});
    }

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

    log(paymentStartFailed ? 'ORDER_CREATED_PAYMENT_NOT_STARTED' : 'SUCCESS');
    return NextResponse.json({
      order: { ...orderResponse, payUrl, paymentStartFailed },
    });
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
      if (error.message.includes("still available")) {
        return apiValidationError(
          error.message,
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
