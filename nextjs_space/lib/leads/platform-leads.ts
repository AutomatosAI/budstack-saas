import { prisma } from "@/lib/db";

/**
 * Platform marketing leads — prospective operators/investors on budstacks.io.
 *
 * Distinct from newsletter_subscribers, which is tenant-scoped and cannot hold
 * a person who has no store yet.
 */

/** Every place an address can enter the list. Keep in step with the UI. */
export const PLATFORM_LEAD_SOURCES = [
  "homepage-cta",
  "pdf-101",
  "contact",
  "pricing",
] as const;

export type PlatformLeadSource = (typeof PLATFORM_LEAD_SOURCES)[number];

/**
 * The exact wording the visitor agreed to. Stored per-lead so a later change to
 * the form does not rewrite the consent history of addresses already captured.
 */
export const LEAD_CONSENT_TEXT =
  "I agree to BudStacks contacting me about operating a storefront, and to " +
  "the storage of my email address for that purpose. I can unsubscribe at any time.";

/**
 * Record a signup. Idempotent on email: a repeat submission refreshes the
 * source and consent evidence rather than failing on the unique index, and
 * revives an address that had previously unsubscribed only if they have
 * consented again (which submitting the form is).
 */
export async function recordPlatformLead(input: {
  email: string;
  source: PlatformLeadSource;
  name?: string;
  company?: string;
  country?: string;
}): Promise<void> {
  const now = new Date();

  await prisma.platform_leads.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      source: input.source,
      name: input.name || null,
      company: input.company || null,
      country: input.country || null,
      consentAt: now,
      consentText: LEAD_CONSENT_TEXT,
    },
    update: {
      // A fresh submission is fresh consent — clear any prior unsubscribe.
      consentAt: now,
      consentText: LEAD_CONSENT_TEXT,
      unsubscribedAt: null,
      // Never downgrade a lead that has already been worked.
      ...(input.name ? { name: input.name } : {}),
      ...(input.company ? { company: input.company } : {}),
      ...(input.country ? { country: input.country } : {}),
    },
  });
}
