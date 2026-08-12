import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  NEWSLETTER_CONFIRM_MAX_REQUESTS,
  NEWSLETTER_CONFIRM_WINDOW_MS,
} from "@/lib/constants";
import {
  NEWSLETTER_NOTICE_PARAM,
  type NewsletterNotice,
  noticeForOutcome,
} from "@/lib/email/newsletter-confirm";
import { confirmNewsletterSubscriber } from "@/lib/email/newsletter-subscriptions";
import { apiError } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getTenantFromRequest } from "@/lib/tenant/tenant";
import { runWithTenantContextAsync } from "@/lib/tenant/tenant-context";
import { getTenantBasePath } from "@/lib/tenant/tenant-utils";

const ROUTE = "GET /api/storefront/newsletter/confirm";

/**
 * Double opt-in confirmation (US-003).
 *
 * SECURITY: the tenant comes from the request HOST — the same host the link
 * was built against — and the token lookup runs inside that tenant's context,
 * so a token can only ever be redeemed on the store that issued it. There is
 * no slug fallback: the link in the email is always absolute and tenant-hosted.
 *
 * Every outcome ends in the same shape of redirect. The endpoint never says in
 * its response whether a token existed, only what the storefront should tell
 * the person who clicked.
 */
const tokenSchema = z
  // Bounded and charset-pinned to what generateSubscriberToken() mints
  // (base64url), so nothing else reaches the query.
  .string()
  .regex(/^[A-Za-z0-9_-]{20,200}$/);

/**
 * Relative `Location` on purpose. Behind the Cloudflare-for-SaaS proxy the Host
 * header is the Railway origin, so anything derived from `request.url` would
 * bounce the visitor off the storefront they were on; a relative target is
 * resolved by the browser against the address bar it already trusts.
 */
function noticeRedirect(
  basePath: string,
  notice: NewsletterNotice,
): NextResponse {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: `${basePath}/?${NEWSLETTER_NOTICE_PARAM}=${notice}`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  const rateLimitResult = await checkRateLimit(`newsletter-confirm:${ip}`, {
    maxRequests: NEWSLETTER_CONFIRM_MAX_REQUESTS,
    windowMs: NEWSLETTER_CONFIRM_WINDOW_MS,
  });
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const tenant = await getTenantFromRequest(request);
  if (!tenant) {
    // No storefront to send them back to, so this is the one case that cannot
    // be a notice.
    return apiError(new Error("Tenant not found for this request"), {
      route: ROUTE,
      status: 404,
      safeMessage: "Store not found for this request.",
    });
  }
  const basePath = getTenantBasePath(tenant.subdomain);

  const token = tokenSchema.safeParse(
    request.nextUrl.searchParams.get("token"),
  );
  if (!token.success) {
    return noticeRedirect(basePath, "invalid");
  }

  try {
    const outcome = await runWithTenantContextAsync(tenant.id, () =>
      confirmNewsletterSubscriber(token.data),
    );
    return noticeRedirect(basePath, noticeForOutcome(outcome));
  } catch (error) {
    // A failed confirm must not read as a rejected link — the subscriber would
    // sign up again and get a second mail for a row that is fine.
    return apiError(error, {
      route: ROUTE,
      safeMessage: "We couldn't confirm your subscription just now.",
      logContext: { tenantId: tenant.id },
    });
  }
}
