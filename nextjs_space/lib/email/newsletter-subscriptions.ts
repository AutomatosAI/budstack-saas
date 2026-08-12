import crypto from "crypto";
import type { SubscriberStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { NewsletterSource } from "@/lib/email/newsletter-signup";

/**
 * Persistence for storefront newsletter signups (US-002). Runs inside the
 * caller's bound tenant context, so the lib/db.ts scope layer injects
 * `tenantId` on create and constrains every read — the row can only ever
 * belong to the tenant whose host served the request.
 *
 * The double opt-in email that consumes `token` is US-003; this module only
 * records consent and mints the token it will carry.
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

/**
 * Record a signup for the bound tenant. Idempotent and non-destructive: the
 * caller gets no signal about which branch ran, because the route's response
 * must not reveal whether the address was already known.
 */
export async function recordNewsletterSignup(
  input: RecordSignupInput,
): Promise<SubscribeAction> {
  const existing = await prisma.newsletter_subscribers.findFirst({
    where: { email: input.email },
    select: { id: true, status: true },
  });

  const action = decideSubscribeAction(existing?.status ?? null);
  const now = new Date();

  if (action === "refresh" && existing) {
    await prisma.newsletter_subscribers.update({
      // `id` is unique; the scope layer adds `tenantId` to this where.
      where: { id: existing.id },
      data: {
        source: input.source,
        consentAt: now,
        token: generateSubscriberToken(),
      },
    });
    return action;
  }

  if (action === "create") {
    try {
      await prisma.newsletter_subscribers.create({
        data: {
          email: input.email,
          status: "PENDING",
          source: input.source,
          consentAt: now,
          token: generateSubscriberToken(),
        },
      });
    } catch (error) {
      // A concurrent signup for the same (tenantId, email) won the race. The
      // row now exists in a state this request is not allowed to overwrite,
      // so treat it exactly like the `ignore` branch rather than clobbering it.
      if (!isUniqueViolation(error)) throw error;
      return "ignore";
    }
    return action;
  }

  return "ignore";
}
