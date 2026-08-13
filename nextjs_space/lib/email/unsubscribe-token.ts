/**
 * Redeeming an unsubscribe token, whichever kind it is.
 *
 * There are two, because there are two ways to end up on a marketing list:
 *
 *   - a `newsletter_subscribers` token (US-002/US-003) — someone who signed up
 *     on the storefront and confirmed;
 *   - a `campaign_recipients` token (US-019) — anyone a campaign was fanned out
 *     to, which includes consented customers who never subscribed to anything
 *     and therefore have no subscriber row to hold a token.
 *
 * The storefront route does not care which it was handed: both arrive as
 * `?token=` on the same URL, and both must end in the same place — a suppression
 * row, which is what every future marketing send is actually checked against.
 *
 * SERVER ONLY, and every query names the tenant explicitly. The route resolves
 * the tenant from the request HOST, so a token minted for one store still
 * cannot be redeemed on another.
 */

import { prisma } from "@/lib/db";
import type { UnsubscribeOutcome } from "@/lib/email/newsletter-unsubscribe";
import { unsubscribeNewsletterSubscriber } from "@/lib/email/newsletter-subscriptions";
import { normalizeEmail } from "@/lib/email/suppression";
import { suppressEmail } from "@/lib/email/suppression-store";

/** Statuses an unsubscribe must not overwrite — SUPPRESSED outranks it. */
const TERMINAL_SUBSCRIBER_STATUSES = ["UNSUBSCRIBED", "SUPPRESSED"] as const;

/**
 * Redeem a per-recipient campaign token.
 *
 * Two writes, and the first is the load-bearing one: the suppression row is
 * what stops the next campaign, while flipping a subscriber row only stops the
 * newsletter — and this recipient may well have no subscriber row at all. The
 * flip still happens when there is one, so the two lists cannot disagree about
 * somebody who has left.
 *
 * The token is NOT cleared. It lives in the footer of a message already in
 * someone's inbox; re-following that link has to keep working, and doing so is
 * idempotent.
 */
async function unsubscribeCampaignRecipient(
  token: string,
  tenantId: string,
  now: Date,
): Promise<UnsubscribeOutcome> {
  // `campaign_recipients` carries no tenantId and is not in the scope set
  // (lib/db.ts); the relation filter is what keeps this inside the tenant whose
  // host served the request.
  const recipient: { email: string } | null =
    await prisma.campaign_recipients.findFirst({
      where: { unsubscribeToken: token, campaigns: { tenantId } },
      select: { email: true },
    });

  if (!recipient) return "invalid";

  const email = normalizeEmail(recipient.email);

  await suppressEmail({ tenantId, email, reason: "unsubscribed" });

  await prisma.newsletter_subscribers.updateMany({
    where: {
      tenantId,
      email,
      status: { notIn: [...TERMINAL_SUBSCRIBER_STATUSES] },
    },
    data: { status: "UNSUBSCRIBED", unsubscribedAt: now },
  });

  return "unsubscribe";
}

/**
 * The storefront route's one entry point: try the subscriber token, then the
 * campaign token, and only then call it invalid.
 *
 * Subscriber first because it is the older and far commoner shape, and because
 * its path carries the extra behaviour (`already-unsubscribed`) that a campaign
 * token has no equivalent of.
 */
export async function unsubscribeByToken(
  token: string,
  tenantId: string,
  now: Date = new Date(),
): Promise<UnsubscribeOutcome> {
  const outcome = await unsubscribeNewsletterSubscriber(token, now);
  if (outcome !== "invalid") return outcome;

  return unsubscribeCampaignRecipient(token, tenantId, now);
}
