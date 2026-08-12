/**
 * The double opt-in contract (US-003): the confirm endpoint, the storefront
 * notice it redirects to, and the pure decision that says what a followed
 * token is allowed to do.
 *
 * Client-safe by construction — no prisma, no node builtins, no server-only
 * imports (the storefront notice banner bundles this module). The persistence
 * side lives in `lib/email/newsletter-subscriptions.ts` and the send side in
 * `lib/email/newsletter-confirm-email.ts`.
 */

import type { SubscriberStatus } from "@prisma/client";
import type { TenantUrlData } from "@/lib/tenant/tenant-utils";
import { getTenantBaseUrl } from "@/lib/tenant/tenant-utils";

export const NEWSLETTER_CONFIRM_PATH = "/api/storefront/newsletter/confirm";

/** Event type the worker maps to a tenant-overridable template. */
export const NEWSLETTER_CONFIRM_TEMPLATE = "newsletterConfirm";

/** Query param the confirm redirect uses to ask the storefront for a notice. */
export const NEWSLETTER_NOTICE_PARAM = "newsletter";

export const NEWSLETTER_NOTICES = ["confirmed", "expired", "invalid"] as const;
export type NewsletterNotice = (typeof NEWSLETTER_NOTICES)[number];

export function isNewsletterNotice(value: unknown): value is NewsletterNotice {
  return NEWSLETTER_NOTICES.includes(value as NewsletterNotice);
}

/**
 * Copy the storefront renders per outcome.
 *
 * `invalid` deliberately covers BOTH an unknown token and a spent one: the
 * token is rotated the moment it is followed, so a second click (a human
 * double-click, or a mailbox scanner that fetched the link first) arrives with
 * a token that no longer resolves. The wording therefore has to reassure a
 * subscriber who is in fact already confirmed, without confirming to a stranger
 * that any given address is on the list.
 */
export const NEWSLETTER_NOTICE_COPY: Record<
  NewsletterNotice,
  { readonly tone: "success" | "error"; readonly title: string; readonly body: string }
> = {
  confirmed: {
    tone: "success",
    title: "You're subscribed",
    body: "Thanks for confirming — you'll hear from us soon.",
  },
  expired: {
    tone: "error",
    title: "That confirmation link has expired",
    body: "Sign up again and we'll send you a fresh one.",
  },
  invalid: {
    tone: "error",
    title: "That confirmation link is no longer valid",
    body: "It may already have been used. If you've confirmed before, you're all set — otherwise sign up again.",
  },
};

/**
 * Absolute confirm link for an email body. Built from the tenant's canonical
 * public base URL (custom domain, else subdomain) so the click lands on the
 * same host that served the signup — which is also the host the endpoint
 * resolves the tenant from.
 */
export function buildNewsletterConfirmUrl(
  tenant: TenantUrlData,
  token: string,
): string {
  return `${getTenantBaseUrl(tenant)}${NEWSLETTER_CONFIRM_PATH}?token=${encodeURIComponent(token)}`;
}

export interface ConfirmCandidate {
  readonly status: SubscriberStatus;
  readonly consentAt: Date | null;
  readonly createdAt: Date;
}

/**
 * What following a token may do.
 *
 * `confirm` is the only branch that writes. UNSUBSCRIBED and SUPPRESSED are
 * `invalid`, never `confirm`: a confirmation link is not an opt-in oracle that
 * anyone holding an old email can use to overturn an opt-out. An already
 * CONFIRMED row is idempotent rather than an error, so a token that is still
 * live (it doubles as the unsubscribe token) never produces a scary page.
 */
export type ConfirmOutcome =
  | "confirm"
  | "already-confirmed"
  | "expired"
  | "invalid";

export function decideConfirmOutcome(
  candidate: ConfirmCandidate | null,
  now: Date,
  ttlMs: number,
): ConfirmOutcome {
  if (!candidate) return "invalid";
  if (candidate.status === "CONFIRMED") return "already-confirmed";
  if (candidate.status !== "PENDING") return "invalid";

  // consentAt is written on every signup; createdAt is the backstop for a row
  // seeded by some other path so a missing timestamp can never read as fresh.
  const consentedAt = candidate.consentAt ?? candidate.createdAt;
  const age = now.getTime() - consentedAt.getTime();
  return age > ttlMs ? "expired" : "confirm";
}

export function noticeForOutcome(outcome: ConfirmOutcome): NewsletterNotice {
  if (outcome === "confirm" || outcome === "already-confirmed") {
    return "confirmed";
  }
  return outcome;
}
