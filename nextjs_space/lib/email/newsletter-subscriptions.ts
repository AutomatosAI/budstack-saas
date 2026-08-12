import crypto from "crypto";
import type { SubscriberStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { NEWSLETTER_CONFIRM_TTL_MS } from "@/lib/constants";
import {
  type ConfirmOutcome,
  decideConfirmOutcome,
} from "@/lib/email/newsletter-confirm";
import type { NewsletterSource } from "@/lib/email/newsletter-signup";
import {
  type UnsubscribeOutcome,
  decideUnsubscribeOutcome,
} from "@/lib/email/newsletter-unsubscribe";
import { suppressEmail } from "@/lib/email/suppression-store";

/**
 * Persistence for storefront newsletter signups (US-002) and their double
 * opt-in confirmation (US-003). Runs inside the caller's bound tenant context,
 * so the lib/db.ts scope layer injects `tenantId` on create and constrains
 * every read — a row can only ever belong to the tenant whose host served the
 * request, and a token minted for one tenant cannot be redeemed on another.
 */

/** Cryptographically-strong, URL-safe confirm/unsubscribe token. */
export function generateSubscriberToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export type SubscribeAction = "create" | "refresh" | "ignore";

/**
 * What a public signup may do to an existing row.
 *
 * A public, unauthenticated endpoint must never be able to move a subscriber
 * BACKWARDS: CONFIRMED must not fall back to PENDING (that would silently
 * suspend a live subscription pending a second click), and UNSUBSCRIBED /
 * SUPPRESSED must not be revived by anyone who can type the address — that is
 * how an opt-out gets overturned by a third party. Only an absent row or one
 * still PENDING is writable, and PENDING is refreshed (not recreated) so the
 * visitor can request a fresh confirmation link.
 */
export function decideSubscribeAction(
  currentStatus: SubscriberStatus | null,
): SubscribeAction {
  if (currentStatus === null) return "create";
  return currentStatus === "PENDING" ? "refresh" : "ignore";
}

/** Postgres unique-violation surfaced by Prisma. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export interface RecordSignupInput {
  readonly email: string;
  readonly source: NewsletterSource;
}

export interface RecordSignupResult {
  readonly action: SubscribeAction;
  /**
   * The confirmation token to mail out — set ONLY when this request actually
   * wrote one. `null` on `ignore`, so a caller can never re-send a live
   * subscriber's token to whoever typed their address into the form.
   */
  readonly token: string | null;
}

/**
 * Record a signup for the bound tenant. Idempotent and non-destructive: the
 * caller gets no signal about which branch ran, because the route's response
 * must not reveal whether the address was already known.
 */
export async function recordNewsletterSignup(
  input: RecordSignupInput,
): Promise<RecordSignupResult> {
  const existing = await prisma.newsletter_subscribers.findFirst({
    where: { email: input.email },
    select: { id: true, status: true },
  });

  const action = decideSubscribeAction(existing?.status ?? null);
  const now = new Date();
  const token = generateSubscriberToken();

  if (action === "refresh" && existing) {
    await prisma.newsletter_subscribers.update({
      // `id` is unique; the scope layer adds `tenantId` to this where.
      where: { id: existing.id },
      data: {
        source: input.source,
        consentAt: now,
        token,
      },
    });
    return { action, token };
  }

  if (action === "create") {
    try {
      await prisma.newsletter_subscribers.create({
        data: {
          email: input.email,
          status: "PENDING",
          source: input.source,
          consentAt: now,
          token,
        },
      });
    } catch (error) {
      // A concurrent signup for the same (tenantId, email) won the race. The
      // row now exists in a state this request is not allowed to overwrite,
      // so treat it exactly like the `ignore` branch rather than clobbering it.
      if (!isUniqueViolation(error)) throw error;
      return { action: "ignore", token: null };
    }
    return { action, token };
  }

  return { action: "ignore", token: null };
}

/**
 * Redeem a confirmation token for the bound tenant (US-003).
 *
 * The token is rotated on a successful confirm, which is what makes the link
 * single-use: the value that arrived can never be replayed, and the fresh value
 * becomes the subscriber's durable unsubscribe token. Every non-`confirm`
 * outcome writes nothing at all.
 */
export async function confirmNewsletterSubscriber(
  token: string,
  now: Date = new Date(),
): Promise<ConfirmOutcome> {
  const subscriber = await prisma.newsletter_subscribers.findFirst({
    // The scope layer adds `tenantId`, so a token belonging to another tenant
    // simply does not resolve here.
    where: { token },
    select: { id: true, status: true, consentAt: true, createdAt: true },
  });

  const outcome = decideConfirmOutcome(
    subscriber,
    now,
    NEWSLETTER_CONFIRM_TTL_MS,
  );
  if (outcome !== "confirm" || !subscriber) return outcome;

  await prisma.newsletter_subscribers.update({
    where: { id: subscriber.id },
    data: {
      status: "CONFIRMED",
      confirmedAt: now,
      token: generateSubscriberToken(),
    },
  });

  return outcome;
}

/**
 * Redeem an unsubscribe token for the bound tenant (US-004).
 *
 * Two writes, and the second is the load-bearing one: flipping the subscriber
 * row only stops NEWSLETTER sends, while the suppression row is what every
 * future marketing send is checked against — campaigns address customers and
 * imported addresses that may have no subscriber row at all.
 *
 * The token is deliberately NOT rotated. It is the durable address of this
 * subscriber's opt-out: it lives in the footer of every message already in
 * people's inboxes, and those links have to keep working. Re-following one is
 * idempotent, which is also why an already-terminal row still (re-)asserts the
 * suppression instead of returning early — a row that reached UNSUBSCRIBED by
 * some other path is repaired by the first click rather than staying mailable.
 */
export async function unsubscribeNewsletterSubscriber(
  token: string,
  now: Date = new Date(),
): Promise<UnsubscribeOutcome> {
  const subscriber = await prisma.newsletter_subscribers.findFirst({
    // The scope layer adds `tenantId`, so a token belonging to another tenant
    // simply does not resolve here.
    where: { token },
    select: { id: true, tenantId: true, email: true, status: true },
  });

  const outcome = decideUnsubscribeOutcome(subscriber);
  if (!subscriber) return outcome;

  if (outcome === "unsubscribe") {
    await prisma.newsletter_subscribers.update({
      where: { id: subscriber.id },
      data: { status: "UNSUBSCRIBED", unsubscribedAt: now },
    });
  }

  await suppressEmail({
    tenantId: subscriber.tenantId,
    email: subscriber.email,
    reason: "unsubscribed",
  });

  return outcome;
}
