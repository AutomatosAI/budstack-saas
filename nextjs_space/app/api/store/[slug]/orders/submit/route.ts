import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantDrGreenConfig } from "@/lib/tenant-config";
import { submitOrder } from "@/lib/drgreen-orders";
import { triggerWebhook, WEBHOOK_EVENTS } from "@/lib/webhook";

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

    // Check local verification (manual admin override)
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

    log('LOCAL_KYC', {
      found: !!localQuestionnaire,
      questionnaireId: localQuestionnaire?.id || 'NONE',
      isKycVerified: localQuestionnaire?.isKycVerified || false,
    });

    // KYC verification step
    if (!localQuestionnaire) {
      log('KYC_PATH: No local override, checking Dr Green API');

      if (!dbUser.drGreenClientId) {
        log('FAIL: No drGreenClientId');
        return NextResponse.json(
          { error: "Account verification incomplete (Missing ID)." },
          { status: 403 },
        );
      }

      const { fetchClient, fetchClientByEmail } = await import("@/lib/doctor-green-api");

      let client: any = null;
      let lookupSource = 'id';

      try {
        log('FETCHING_CLIENT', { clientId: dbUser.drGreenClientId });
        client = await fetchClient(dbUser.drGreenClientId, drGreenConfig);
      } catch (idLookupErr) {
        const msg = idLookupErr instanceof Error ? idLookupErr.message : String(idLookupErr);
        log('CLIENT_ID_LOOKUP_FAILED — trying email fallback', { message: msg });

        if (dbUser.email) {
          try {
            const byEmail = await fetchClientByEmail(dbUser.email, drGreenConfig);
            if (byEmail) {
              client = byEmail;
              lookupSource = 'email';
              log('CLIENT_FOUND_BY_EMAIL', {
                storedClientId: dbUser.drGreenClientId,
                drGreenClientId: byEmail.id,
                mismatch: dbUser.drGreenClientId !== byEmail.id,
              });

              // Backfill the correct clientId so next checkout skips the fallback
              if (dbUser.drGreenClientId !== byEmail.id) {
                try {
                  await prisma.users.update({
                    where: { id: dbUser.id },
                    data: { drGreenClientId: byEmail.id },
                  });
                  log('CLIENT_ID_BACKFILLED', { newClientId: byEmail.id });
                } catch (updateErr) {
                  log('CLIENT_ID_BACKFILL_FAILED', {
                    message: updateErr instanceof Error ? updateErr.message : String(updateErr),
                  });
                }
              }
            }
          } catch (emailLookupErr) {
            log('CLIENT_EMAIL_LOOKUP_FAILED', {
              message: emailLookupErr instanceof Error ? emailLookupErr.message : String(emailLookupErr),
            });
          }
        }

        if (!client) {
          log('KYC_API_ERROR', { message: msg, emailFallbackTried: !!dbUser.email });
          return NextResponse.json(
            { error: "Could not verify account status. Please try again." },
            { status: 500 },
          );
        }
      }

      log('CLIENT_RESPONSE', {
        source: lookupSource,
        rawKeys: Object.keys(client),
        isActive: client.isActive,
        isKYCVerified: client.isKYCVerified,
        adminApproval: client.adminApproval,
        id: client.id,
        email: client.email,
      });

      const isVerified = client.isActive === true &&
        (client.isKYCVerified === true || client.adminApproval === 'VERIFIED');
      if (!isVerified) {
        log('FAIL: Client not verified', { isActive: client.isActive, isKYCVerified: client.isKYCVerified, adminApproval: client.adminApproval });
        return NextResponse.json(
          { error: "Medical verification required. Please complete your profile verification." },
          { status: 403 },
        );
      }
      log('KYC_PASSED via Dr Green API', { source: lookupSource });
    } else {
      log('KYC_PATH: Using local admin override — skipping Dr Green API check');
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
