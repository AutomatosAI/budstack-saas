import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant/tenant";
import { getTenantDrGreenConfig } from "@/lib/tenant/tenant-config";
import { fetchDeliveryQuote } from "@/lib/drgreen/delivery-quote";
import { apiError } from "@/lib/api-error";
import { parseSlug } from "@/lib/validation/parse-uuid";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const ROUTE = "GET /api/store/[slug]/checkout/quote";
const NO_QUOTE = { deliveryCharge: null, currency: null } as const;

/**
 * GET /api/store/[slug]/checkout/quote — Dr Green's delivery charge for the
 * signed-in customer (BS-F01), read off their Dr Green server cart.
 *
 * Best-effort by design: no quote is a normal answer (no server cart yet, no
 * Dr Green client, Dr Green unreachable) and checkout then shows "calculated
 * by Dr Green". It never invents a number — the charge is Dr Green's.
 */
export const GET = withAuth(async (_request, { user }, { slug }) => {
  try {
    parseSlug(slug);

    const email = user.email;
    if (!email) return NextResponse.json(NO_QUOTE);

    // Resolve the local row by email, as the order-submit route does — the
    // auth user's id is not guaranteed to be users.id.
    const dbUser = await prisma.users.findFirst({
      where: { email },
      select: { drGreenClientId: true },
    });
    const clientId = dbUser?.drGreenClientId;
    if (!clientId) return NextResponse.json(NO_QUOTE);

    const tenant = await getCurrentTenant();
    if (!tenant) {
      return apiError(new Error("Store not found"), {
        route: ROUTE,
        status: 404,
        safeMessage: "Store not found",
      });
    }

    const config = await getTenantDrGreenConfig(tenant.id);
    try {
      const quote = await fetchDeliveryQuote({
        clientId,
        email,
        apiKey: config.apiKey,
        secretKey: config.secretKey,
        apiUrl: config.apiUrl,
      });
      return NextResponse.json(quote ?? NO_QUOTE);
    } catch (quoteError) {
      logger.warn("[checkout-quote] Dr Green cart read failed", {
        tenantId: tenant.id,
        error:
          quoteError instanceof Error ? quoteError.message : String(quoteError),
      });
      return NextResponse.json(NO_QUOTE);
    }
  } catch (error) {
    return apiError(error, {
      route: ROUTE,
      safeMessage: "Failed to get delivery quote",
    });
  }
});
