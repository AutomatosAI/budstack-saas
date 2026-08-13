import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  NEWSLETTER_UNSUBSCRIBE_MAX_REQUESTS,
  NEWSLETTER_UNSUBSCRIBE_WINDOW_MS,
} from "@/lib/constants";
import {
  type UnsubscribeOutcome,
  unsubscribeOutcomeCopy,
  unsubscribePromptCopy,
} from "@/lib/email/newsletter-unsubscribe";
import { unsubscribeByToken } from "@/lib/email/unsubscribe-token";
import {
  UNSUBSCRIBE_PAGE_HEADERS,
  renderUnsubscribePrompt,
  renderUnsubscribeResult,
} from "@/lib/email/unsubscribe-page";
import { apiError } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getTenantFromRequest } from "@/lib/tenant/tenant";
import { runWithTenantContextAsync } from "@/lib/tenant/tenant-context";

/**
 * Unsubscribe (US-004) — GET shows a confirmation page, POST does the work.
 *
 * SECURITY: the tenant comes from the request HOST (the host the link was built
 * against) and the token is redeemed inside that tenant's context, so a token
 * can only ever be honoured on the store that issued it.
 *
 * The POST is the RFC 8058 one-click target named by US-020's
 * `List-Unsubscribe` header, so it must succeed with NO cookies, NO session and
 * NO custom headers — a mail provider sends it, not a browser the recipient
 * controls. That rules out any CSRF token, and it is safe here because the
 * 256-bit token in the URL is itself the credential and the only effect is one
 * the recipient always wants. It is also why the route is on the auth
 * allow-list rather than behind a wrapper.
 *
 * Every outcome renders a calm 200 page. Someone trying to leave a mailing list
 * must never be shown a failure, and a mail provider must never be handed a
 * non-2xx it will retry or surface as "unsubscribe didn't work".
 */

const ROUTE = "/api/storefront/newsletter/unsubscribe";

// Bounded and charset-pinned to what generateSubscriberToken() mints
// (base64url), so nothing else reaches the query.
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{20,200}$/);

function page(html: string): NextResponse {
  return new NextResponse(html, {
    status: 200,
    headers: { ...UNSUBSCRIBE_PAGE_HEADERS },
  });
}

function invalidPage(storeName: string): NextResponse {
  return page(
    renderUnsubscribeResult(storeName, unsubscribeOutcomeCopy("invalid", storeName)),
  );
}

/**
 * Shared preamble: meter by IP, resolve the store from the host, pin the token.
 * Returns the tenant + token, or the response to send instead.
 */
async function resolveRequest(
  request: NextRequest,
  method: "GET" | "POST",
): Promise<
  | { ok: true; storeName: string; tenantId: string; token: string }
  | { ok: false; response: NextResponse }
> {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  const rateLimit = await checkRateLimit(`newsletter-unsubscribe:${ip}`, {
    maxRequests: NEWSLETTER_UNSUBSCRIBE_MAX_REQUESTS,
    windowMs: NEWSLETTER_UNSUBSCRIBE_WINDOW_MS,
  });
  if (!rateLimit.success) {
    return { ok: false, response: rateLimit.response };
  }

  const tenant = await getTenantFromRequest(request);
  if (!tenant) {
    // No store means no branded page to render and nothing to unsubscribe
    // from, so this is the one case that cannot be a page.
    return {
      ok: false,
      response: apiError(new Error("Tenant not found for this request"), {
        route: `${method} ${ROUTE}`,
        status: 404,
        safeMessage: "Store not found for this request.",
      }),
    };
  }

  const token = tokenSchema.safeParse(request.nextUrl.searchParams.get("token"));
  if (!token.success) {
    return { ok: false, response: invalidPage(tenant.businessName) };
  }

  return {
    ok: true,
    storeName: tenant.businessName,
    tenantId: tenant.id,
    token: token.data,
  };
}

/**
 * The confirmation page. Deliberately does not unsubscribe: mail scanners and
 * link prefetchers follow every URL in a message, so acting on GET would remove
 * people who never clicked anything.
 */
export async function GET(request: NextRequest) {
  const resolved = await resolveRequest(request, "GET");
  if (!resolved.ok) return resolved.response;

  return page(
    renderUnsubscribePrompt(
      resolved.storeName,
      unsubscribePromptCopy(resolved.storeName),
      resolved.token,
    ),
  );
}

export async function POST(request: NextRequest) {
  const resolved = await resolveRequest(request, "POST");
  if (!resolved.ok) return resolved.response;

  let outcome: UnsubscribeOutcome;
  try {
    // Either token shape (subscriber, or US-019's per-campaign-recipient one)
    // resolves here — the person following the link cannot be expected to know
    // which list put the message in front of them.
    outcome = await runWithTenantContextAsync(resolved.tenantId, () =>
      unsubscribeByToken(resolved.token, resolved.tenantId),
    );
  } catch (error) {
    // A failed write must read as a failure, not as "you're unsubscribed" —
    // telling someone they are off the list when they are still on it is the
    // one lie this endpoint cannot tell.
    return apiError(error, {
      route: `POST ${ROUTE}`,
      safeMessage: "We couldn't unsubscribe you just now. Please try again.",
      logContext: { tenantId: resolved.tenantId },
    });
  }

  return page(
    renderUnsubscribeResult(
      resolved.storeName,
      unsubscribeOutcomeCopy(outcome, resolved.storeName),
    ),
  );
}
