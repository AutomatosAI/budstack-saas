import { NextResponse } from "next/server";
import { z } from "zod";

import { withAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant/tenant";
import { getTenantDrGreenConfig } from "@/lib/tenant/tenant-config";
import { apiError } from "@/lib/api-error";
import { parseSlug } from "@/lib/validation/parse-uuid";
import { parseJsonBody } from "@/lib/validation/body";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";
import {
  mapDrGreenApiError,
  updateClientMarketingConsent,
} from "@/lib/drgreen-identity";
import { CONSENT_SOURCE } from "@/lib/customers/marketing-consent";
import { logger } from "@/lib/logger";

// Node runtime: the Dr Green client signs requests with node:crypto.
export const runtime = "nodejs";

const ROUTE = "store.consent";

const consentBodySchema = z.object({ consent: z.boolean() }).strict();

const USER_SELECT = {
  id: true,
  email: true,
  drGreenClientId: true,
  marketingConsentAt: true,
} as const;

interface ConsentState {
  marketingConsent: boolean;
  marketingConsentAt: string | null;
}

function consentState(marketingConsentAt: Date | null): ConsentState {
  return {
    marketingConsent: marketingConsentAt !== null,
    marketingConsentAt: marketingConsentAt?.toISOString() ?? null,
  };
}

/**
 * Customer-safe explanation when Dr Green did not take the change. 404 is
 * either "no such client" or, until Phase 3 is on production, "no such
 * route"; both read the same to the customer.
 */
function forwardWarning(error: unknown): string {
  const mapped = mapDrGreenApiError(error);
  if (mapped?.status === 404) {
    return "Your choice is saved for this store. Dr Green's record of your account could not be updated yet.";
  }
  if (mapped?.status === 409 || mapped?.status === 400) {
    return mapped.message
      ? `Your choice is saved for this store. Dr Green replied: ${mapped.message}`
      : "Your choice is saved for this store, but Dr Green did not accept the change.";
  }
  return "Your choice is saved for this store. We could not reach Dr Green to update its record; we will keep your choice here.";
}

/**
 * GET /api/store/[slug]/consent — the signed-in customer's own marketing
 * consent state, read from the column every BudStacks send is gated on.
 */
export const GET = withAuth(async (_request, { user }, { slug }) => {
  try {
    parseSlug(slug);
    if (!user.email) {
      return NextResponse.json({ error: "Email not found" }, { status: 401 });
    }
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }
    const dbUser = await prisma.users.findFirst({
      where: { email: user.email },
      select: { marketingConsentAt: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    return NextResponse.json(consentState(dbUser.marketingConsentAt));
  } catch (error) {
    return apiError(error, {
      route: `GET ${ROUTE}`,
      status: 500,
      safeMessage: "Could not load your marketing preference.",
    });
  }
});

/**
 * PATCH /api/store/[slug]/consent — BS-304. The customer gives or withdraws
 * marketing consent from their settings page.
 *
 * ORDER MATTERS. The local column is written FIRST and unconditionally: it is
 * the consent test for every campaign BudStacks sends (the tenant's own POPIA
 * exposure), so a withdrawal must never depend on a partner API answering.
 * Dr Green (`PATCH /dapp/clients/:id/marketing-consent`, Phase 3 US-302) is
 * then updated best-effort so the KEY holder's export agrees; when it cannot
 * be — the route is not on production yet, the client is unknown, or Dr Green
 * refuses — the response still succeeds and says so in `warning`, with the
 * status logged. The audit row is written either way: who flipped it, when,
 * and from where.
 */
export const PATCH = withAuth(async (request, { user }, { slug }) => {
  try {
    parseSlug(slug);
    if (!user.email) {
      return NextResponse.json({ error: "Email not found" }, { status: 401 });
    }
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const { consent } = await parseJsonBody(request, consentBodySchema);

    const dbUser = await prisma.users.findFirst({
      where: { email: user.email },
      select: USER_SELECT,
    });
    if (!dbUser) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const now = new Date();
    const marketingConsentAt = consent ? now : null;
    await prisma.users.update({
      where: { id: dbUser.id },
      data: {
        marketingConsentAt,
        marketingConsentSource: CONSENT_SOURCE.STORE_SETTINGS,
        updatedAt: now,
      },
    });

    const { ipAddress, userAgent } = getClientInfo(request.headers);
    await createAuditLog({
      action: consent
        ? AUDIT_ACTIONS.CUSTOMER_MARKETING_CONSENT_GRANTED
        : AUDIT_ACTIONS.CUSTOMER_MARKETING_CONSENT_REVOKED,
      entityType: "User",
      entityId: dbUser.id,
      userId: dbUser.id,
      userEmail: dbUser.email,
      tenantId: tenant.id,
      metadata: {
        source: CONSENT_SOURCE.STORE_SETTINGS,
        previousConsentAt: dbUser.marketingConsentAt?.toISOString() ?? null,
        newConsentAt: marketingConsentAt?.toISOString() ?? null,
      },
      ipAddress,
      userAgent,
    });

    let forwarded = false;
    let warning: string | undefined;
    if (dbUser.drGreenClientId) {
      try {
        const config = await getTenantDrGreenConfig(tenant.id);
        await updateClientMarketingConsent({
          clientId: dbUser.drGreenClientId,
          consent,
          consentSource: CONSENT_SOURCE.STORE_SETTINGS,
          config: { apiKey: config.apiKey, secretKey: config.secretKey },
          baseUrl: config.apiUrl,
        });
        forwarded = true;
      } catch (forwardError) {
        const mapped = mapDrGreenApiError(forwardError);
        logger.warn("[Consent] Dr Green did not take the consent change", {
          userId: dbUser.id,
          drGreenClientId: dbUser.drGreenClientId,
          consent,
          status: mapped?.status ?? null,
          error:
            forwardError instanceof Error
              ? forwardError.message
              : String(forwardError),
        });
        warning = forwardWarning(forwardError);
      }
    } else {
      logger.info("[Consent] no Dr Green client on this account; local only", {
        userId: dbUser.id,
      });
    }

    return NextResponse.json({
      ...consentState(marketingConsentAt),
      forwarded,
      ...(warning ? { warning } : {}),
    });
  } catch (error) {
    return apiError(error, {
      route: `PATCH ${ROUTE}`,
      status: 500,
      safeMessage: "Could not update your marketing preference. Please try again.",
    });
  }
});
