import { NextResponse } from "next/server";

import { withAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant/tenant";
import { getTenantDrGreenConfig } from "@/lib/tenant/tenant-config";
import { apiError } from "@/lib/api-error";
import { parseSlug } from "@/lib/validation/parse-uuid";
import {
  switchClientToIdVerification,
  mapDrGreenApiError,
} from "@/lib/drgreen-identity";
import {
  getTenantVerificationMode,
  isSaIdUploadEnabled,
} from "@/lib/verification-mode";
import { logger } from "@/lib/logger";

// Node runtime: the Dr Green client signs requests with node:crypto.
export const runtime = "nodejs";

/**
 * Map a Dr Green refusal to a customer response: 403 (feature off) and 404
 * get fixed copy, 400/409 surface Dr Green's own customer-safe reason
 * (already verified / not South African). Anything else stays a generic 500.
 */
function toCustomerError(
  error: unknown,
): { status: number; message: string } | null {
  const mapped = mapDrGreenApiError(error);
  if (!mapped) return null;
  if (mapped.status === 403) {
    return {
      status: 403,
      message: "Switching to ID verification is not available right now",
    };
  }
  if (mapped.status === 404) {
    return { status: 404, message: "We couldn't find your account" };
  }
  if (mapped.status === 409 || mapped.status === 400) {
    return {
      status: 409,
      message:
        mapped.message ?? "Your account can't be switched to ID verification",
    };
  }
  return null;
}

/**
 * Switch the signed-in customer's Dr Green client from the legacy First-AML
 * KYC path to SA ID-upload verification. Pure pass-through: eligibility
 * (feature flag, ZAF shipping, not already verified) is enforced by
 * Dr Green; nothing about the decision is persisted locally — the dashboard
 * re-reads the live client after switching.
 */
export const POST = withAuth(async (request, { user }, { slug }) => {
  try {
    parseSlug(slug);

    const email = user.email;
    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 401 });
    }

    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // Gate: global flag + tenant is in ID-upload mode (which is ZA-only) —
    // same gate as the ID-document upload proxy this flow feeds into.
    if (
      !isSaIdUploadEnabled() ||
      getTenantVerificationMode(tenant) !== "ID_UPLOAD"
    ) {
      return NextResponse.json(
        { error: "ID verification is not available for this store" },
        { status: 403 },
      );
    }

    const dbUser = await prisma.users.findFirst({
      where: { email },
      select: { id: true, drGreenClientId: true },
    });
    if (!dbUser?.drGreenClientId) {
      return NextResponse.json(
        { error: "No verification record found for your account" },
        { status: 400 },
      );
    }

    const config = await getTenantDrGreenConfig(tenant.id);

    try {
      const client = await switchClientToIdVerification({
        clientId: dbUser.drGreenClientId,
        config: { apiKey: config.apiKey, secretKey: config.secretKey },
        baseUrl: config.apiUrl,
      });
      logger.info("[SwitchToId] client switched to ID verification", {
        userId: dbUser.id,
        drGreenClientId: dbUser.drGreenClientId,
        adminApproval: client.adminApproval,
      });
      return NextResponse.json({ status: "SWITCHED" });
    } catch (switchError) {
      const mapped = toCustomerError(switchError);
      if (mapped) {
        logger.warn("[SwitchToId] Dr Green refused the switch", {
          userId: dbUser.id,
          status: mapped.status,
        });
        return NextResponse.json(
          { error: mapped.message },
          { status: mapped.status },
        );
      }
      throw switchError;
    }
  } catch (error) {
    return apiError(error, {
      route: "store.verify.switch-to-id",
      status: 500,
      safeMessage: "Failed to switch your verification method. Please try again.",
    });
  }
});
