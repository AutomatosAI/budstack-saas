/**
 * The unsubscribe contract (US-004): the link that goes in an email, and the
 * pure decision that says what following it is allowed to do.
 *
 * Client-safe by construction — no prisma, no node builtins. The persistence
 * side lives in `lib/email/newsletter-subscriptions.ts` and the page the route
 * serves in `lib/email/unsubscribe-page.ts`.
 *
 * Unlike confirmation (US-003) this flow does NOT bounce back to the storefront
 * with a notice: RFC 8058 one-click requires the URL in `List-Unsubscribe` to
 * accept a bare POST, and a Next.js page cannot handle POST. So one API route
 * owns both halves — GET renders the confirmation page, POST does the work —
 * and the URL a mail client is handed is the same one a human clicks.
 */

import type { SubscriberStatus } from "@prisma/client";
import type { TenantUrlData } from "@/lib/tenant/tenant-utils";
import { getTenantBaseUrl } from "@/lib/tenant/tenant-utils";

export const NEWSLETTER_UNSUBSCRIBE_PATH =
  "/api/storefront/newsletter/unsubscribe";

/**
 * Absolute unsubscribe link for an email body, built from the tenant's
 * canonical public base URL — the same host the endpoint resolves the tenant
 * from, so a token minted for one store cannot be redeemed on another.
 */
export function buildNewsletterUnsubscribeUrl(
  tenant: TenantUrlData,
  token: string,
): string {
  return `${getTenantBaseUrl(tenant)}${NEWSLETTER_UNSUBSCRIBE_PATH}?token=${encodeURIComponent(token)}`;
}

/**
 * Statuses that already mean "not mailable". Following an unsubscribe link on
 * one of these must not rewrite the row: SUPPRESSED carries stronger
 * provenance than UNSUBSCRIBED (a hard bounce, or an operator decision), and
 * downgrading it would lose that.
 */
const TERMINAL_STATUSES: readonly SubscriberStatus[] = [
  "UNSUBSCRIBED",
  "SUPPRESSED",
];

/**
 * What following an unsubscribe token may do. `invalid` is the unknown-token
 * case; it is still shown as a calm page rather than an error, because the
 * person on the other end is trying to leave a list and must never be made to
 * feel they failed.
 */
export type UnsubscribeOutcome =
  | "unsubscribe"
  | "already-unsubscribed"
  | "invalid";

export function decideUnsubscribeOutcome(
  candidate: { readonly status: SubscriberStatus } | null,
): UnsubscribeOutcome {
  if (!candidate) return "invalid";
  return TERMINAL_STATUSES.includes(candidate.status)
    ? "already-unsubscribed"
    : "unsubscribe";
}

export interface UnsubscribeCopy {
  readonly title: string;
  readonly body: string;
}

/**
 * Copy for the page, per outcome. `unsubscribe` and `already-unsubscribed`
 * deliberately read identically — whether this click or an earlier one did the
 * work is not the visitor's problem, and telling them apart would confirm to a
 * stranger holding a copied link that the address is on the list.
 */
export function unsubscribeOutcomeCopy(
  outcome: UnsubscribeOutcome,
  storeName: string,
): UnsubscribeCopy {
  if (outcome === "invalid") {
    return {
      title: "That unsubscribe link is no longer valid",
      body: `It may have been copied incompletely. If you keep getting marketing email from ${storeName} you didn't ask for, reply to any of it and we'll take you off the list.`,
    };
  }
  return {
    title: "You're unsubscribed",
    body: `You won't receive marketing email from ${storeName} again. Messages about your own orders and account are unaffected.`,
  };
}

/** Copy for the GET confirmation page, before anything has been written. */
export function unsubscribePromptCopy(storeName: string): UnsubscribeCopy {
  return {
    title: `Unsubscribe from ${storeName} emails?`,
    body: `You'll stop receiving marketing email from ${storeName}. Messages about your own orders and account will still be sent.`,
  };
}
