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
 *   - a `users.reorderReminderToken` (US-028) — a customer the reorder
 *     automation mailed, who by definition has neither of the above: they never
 *     signed up to a newsletter and no campaign chose them.
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
 * Three writes, and the first is the load-bearing one: the suppression row is
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
  const recipient: { id: string; email: string } | null =
    await prisma.campaign_recipients.findFirst({
      where: { unsubscribeToken: token, campaigns: { tenantId } },
      select: { id: true, email: true },
    });

  if (!recipient) return "invalid";

  const email = normalizeEmail(recipient.email);

  await suppressEmail({ tenantId, email, reason: "unsubscribed" });

  // US-026: attribute the opt-out to the campaign that prompted it. Only the
  // token knows — a suppression row records that this address left, never which
  // message it left from. `unsubscribedAt: null` in the where keeps the FIRST
  // redemption: the link outlives the campaign in somebody's inbox, and a
  // second click months later must not restate it as a fresh opt-out. Keyed on
  // the id that came out of the tenant-scoped read above.
  await prisma.campaign_recipients.updateMany({
    where: { id: recipient.id, unsubscribedAt: null },
    data: { unsubscribedAt: now },
  });

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
 * Redeem a reorder-reminder token (US-028).
 *
 * The same two writes as the campaign path, minus the attribution one — there is
 * no campaign to attribute the opt-out to, only an automation that will now stop
 * for this address like it stops for every other suppressed one.
 *
 * `marketingConsentAt` is cleared as well as the address suppressed, which the
 * campaign path deliberately does not do. The difference is what the person was
 * leaving: a campaign is one message from a store they consented to hear from,
 * while this reminder IS the consent being exercised on a schedule. Somebody who
 * opts out of it is withdrawing the tick they gave at checkout, and leaving that
 * timestamp set would show them on the customers list as still opted in.
 *
 * The token is NOT cleared, for the reason it is never rotated: it lives in the
 * footer of a message already in an inbox, and following that link again has to
 * keep working. Doing so is idempotent — `suppressEmail` already is, and the
 * consent write matches nothing the second time.
 */
async function unsubscribeReorderReminder(
  token: string,
  tenantId: string,
  now: Date,
): Promise<UnsubscribeOutcome> {
  // findFirst with flat fields, not findUnique on the unique token: the
  // tenant-scope $extends rewrite is only safe over a flat `where` (repo-wide
  // convention), and naming the tenant here is what stops a token minted for one
  // store being redeemed on another's host.
  const customer: { id: string; email: string } | null =
    await prisma.users.findFirst({
      where: { reorderReminderToken: token, tenantId },
      select: { id: true, email: true },
    });

  if (!customer) return "invalid";

  const email = normalizeEmail(customer.email);

  await suppressEmail({ tenantId, email, reason: "unsubscribed" });

  await prisma.users.updateMany({
    where: { id: customer.id, tenantId, marketingConsentAt: { not: null } },
    data: { marketingConsentAt: null, updatedAt: now },
  });

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
 * campaign token, then the reorder-reminder token, and only then call it
 * invalid.
 *
 * Subscriber first because it is the older and far commoner shape, and because
 * its path carries the extra behaviour (`already-unsubscribed`) that neither of
 * the others has an equivalent of. The reorder token is last because it is the
 * narrowest population — one row per customer the automation has ever mailed.
 *
 * Each lookup is keyed on a column with a unique index, so the ordering costs an
 * index probe per miss and nothing else.
 */
export async function unsubscribeByToken(
  token: string,
  tenantId: string,
  now: Date = new Date(),
): Promise<UnsubscribeOutcome> {
  const outcome = await unsubscribeNewsletterSubscriber(token, now);
  if (outcome !== "invalid") return outcome;

  const campaign = await unsubscribeCampaignRecipient(token, tenantId, now);
  if (campaign !== "invalid") return campaign;

  return unsubscribeReorderReminder(token, tenantId, now);
}
