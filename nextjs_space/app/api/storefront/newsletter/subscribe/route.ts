import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { apiError, apiValidationError } from "@/lib/api-error";
import {
  NEWSLETTER_SOURCES,
  NEWSLETTER_SUBSCRIBE_ERROR,
} from "@/lib/email/newsletter-signup";
import { recordNewsletterSignup } from "@/lib/email/newsletter-subscriptions";
import {
  NEWSLETTER_SUBSCRIBE_MAX_REQUESTS,
  NEWSLETTER_SUBSCRIBE_WINDOW_MS,
} from "@/lib/constants";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getTenantFromRequest } from "@/lib/tenant/tenant";
import { runWithTenantContextAsync } from "@/lib/tenant/tenant-context";
import { resolveTenant } from "@/lib/tenant/tenant-resolver";

const ROUTE = "POST /api/storefront/newsletter/subscribe";

/**
 * Public storefront newsletter signup (US-002).
 *
 * SECURITY: the tenant is resolved from the request HOST, never from the body.
 * `tenantSlug` is accepted only as the localhost/path-based dev fallback (same
 * posture as /api/consultation/submit) — it is a subdomain slug, never a
 * tenant id, and a slug that disagrees with the resolved host is rejected.
 */
const subscribeSchema = z.object({
  // trim + lower-case BEFORE validating: the stored address is the dedupe key
  // for @@unique([tenantId, email]), which is case-sensitive in Postgres.
  email: z.string().trim().toLowerCase().email().max(254),
  source: z.enum(NEWSLETTER_SOURCES),
  tenantSlug: z.string().min(1).max(100).optional(),
});

/**
 * The single response every accepted signup gets, whatever the address's prior
 * state. New, already-pending, already-confirmed and previously-unsubscribed
 * are indistinguishable to the caller — otherwise the endpoint becomes a
 * subscriber-enumeration oracle for any tenant's list.
 */
function genericSuccess(): NextResponse {
  return NextResponse.json({ success: true });
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP — unauthenticated write, so the client identity is the
    // only thing available to meter on.
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "unknown";
    const rateLimitResult = await checkRateLimit(`newsletter-subscribe:${ip}`, {
      maxRequests: NEWSLETTER_SUBSCRIBE_MAX_REQUESTS,
      windowMs: NEWSLETTER_SUBSCRIBE_WINDOW_MS,
    });
    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    const parsed = subscribeSchema.safeParse(await request.json());
    if (!parsed.success) {
      const onEmail = parsed.error.issues.some(
        (issue) => issue.path[0] === "email",
      );
      return apiValidationError(
        onEmail ? "Please enter a valid email address." : "Invalid request.",
        ROUTE,
      );
    }
    const { email, source, tenantSlug } = parsed.data;

    let tenant = await getTenantFromRequest(request);
    if (!tenant && tenantSlug) {
      const resolved = await resolveTenant({ kind: "slug", slug: tenantSlug });
      tenant = resolved?.tenant ?? null;
    }
    if (
      tenant &&
      tenantSlug &&
      tenant.subdomain.toLowerCase() !== tenantSlug.toLowerCase()
    ) {
      return apiValidationError(
        "Tenant mismatch between request host and submitted slug",
        ROUTE,
      );
    }
    if (!tenant) {
      return apiError(new Error("Tenant not found for this request"), {
        route: ROUTE,
        status: 404,
        safeMessage: "Store not found for this request.",
      });
    }

    await runWithTenantContextAsync(tenant.id, () =>
      recordNewsletterSignup({ email, source }),
    );

    return genericSuccess();
  } catch (error) {
    return apiError(error, {
      route: ROUTE,
      safeMessage: NEWSLETTER_SUBSCRIBE_ERROR,
    });
  }
}
