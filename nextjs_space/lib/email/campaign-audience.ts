/**
 * US-018 — who a campaign goes to, expressed as a RULE rather than a list.
 *
 * `campaigns.audience` stores one of these objects and never a resolved set of
 * addresses. That is the model-level half of "recipients are materialized at
 * send time, not draft time": a draft saved in March and sent in April reaches
 * the people who are consented in April, and there is nowhere to persist a
 * stale address list even if a later screen wanted one. The resolution itself
 * lives in `campaign-audience-query.ts`, which is where the database is.
 *
 * PURE AND BROWSER-SAFE, like `campaign-rules.ts`: literals, types and the two
 * folds below. The picker needs the option labels and the count needs the
 * dedupe rule, and neither should drag Prisma or zod into a client bundle. The
 * one import is `normalizeEmail`, itself declared pure for exactly this reason.
 */

import { normalizeEmail } from "@/lib/email/suppression";

export const CAMPAIGN_AUDIENCE_TYPES = [
  "subscribers",
  "customers",
  "both",
  "segment",
] as const;

export type CampaignAudienceType = (typeof CAMPAIGN_AUDIENCE_TYPES)[number];

/** The three flat sources — the audiences that carry no argument. */
export type CampaignAudienceSourceType = Exclude<CampaignAudienceType, "segment">;

/**
 * An object rather than a bare string, which is what let US-025 add `segment`
 * without rewriting a single row already stored — an unknown extra key narrows
 * away here rather than breaking the read.
 *
 * A DISCRIMINATED UNION, so "a segment audience naming no segment" cannot be
 * constructed at all. The picker holds a half-made selection in its own state
 * and only emits an audience once it is whole.
 */
export type CampaignAudience =
  | { readonly type: CampaignAudienceSourceType }
  | { readonly type: "segment"; readonly segmentId: string };

export interface CampaignAudienceOption {
  readonly type: CampaignAudienceType;
  readonly label: string;
  /** One line telling the author exactly who this reaches, and who it does not. */
  readonly description: string;
}

export const CAMPAIGN_AUDIENCE_OPTIONS: readonly CampaignAudienceOption[] = [
  {
    type: "subscribers",
    label: "Newsletter subscribers",
    description:
      "People who signed up on your storefront and confirmed the opt-in email. Sign-ups that were never confirmed are not included.",
  },
  {
    type: "customers",
    label: "Consented customers",
    description:
      "Customers who ticked the marketing box when they ordered. Customers who never opted in are never mailed a campaign.",
  },
  {
    type: "both",
    label: "Both",
    description:
      "Confirmed subscribers and consented customers together. Anyone on both lists is counted — and mailed — once.",
  },
  {
    type: "segment",
    label: "Saved segment",
    description:
      "One of your saved audience rules (US-025) — customers only, and always narrowed to the ones who opted in to marketing.",
  },
];

export function isCampaignAudienceType(
  value: unknown,
): value is CampaignAudienceType {
  return (CAMPAIGN_AUDIENCE_TYPES as readonly unknown[]).includes(value);
}

/**
 * Narrow an untrusted value — a Json column, a query string — to an audience.
 *
 * Returns `null` for anything unrecognised, which every caller reads as "no
 * audience chosen", never as "everybody". A rule this code cannot understand
 * must not resolve to a send.
 */
export function parseCampaignAudience(value: unknown): CampaignAudience | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const { type, segmentId } = value as { type?: unknown; segmentId?: unknown };
  if (!isCampaignAudienceType(type)) return null;

  // Rebuilt rather than returned as-is, so keys this version does not know
  // about cannot ride along into the response or into a later write —
  // `segmentId` survives only on the one type that means anything by it.
  if (type !== "segment") return { type };
  return typeof segmentId === "string" && segmentId !== ""
    ? { type, segmentId }
    : null;
}

/**
 * True when this audience draws from that source.
 *
 * A segment draws from NEITHER: it is customers narrowed by a saved rule, and
 * resolving it is a different query (US-025). Returning true for "customers"
 * here would make a segment audience mail every consented customer in the
 * store — the widest possible reading of the narrowest possible audience.
 */
export function audienceIncludes(
  audience: CampaignAudience,
  source: "subscribers" | "customers",
): boolean {
  return audience.type === source || audience.type === "both";
}

/** The segment this audience names, or null when it names none. */
export function audienceSegmentId(audience: CampaignAudience): string | null {
  return audience.type === "segment" ? audience.segmentId : null;
}

export interface AudienceRecipient {
  /** Normalized address — the form the suppression list is keyed on. */
  readonly email: string;
  /** The customer this address belongs to, when it is one. */
  readonly userId: string | null;
  /**
   * What to call this person in `{{userName}}` (US-019). Known only for a
   * customer, and not for all of them — a subscriber gave an address and
   * nothing else, so this is absent far more often than it is set.
   */
  readonly name?: string | null;
}

export interface AudienceResolution {
  readonly recipients: readonly AudienceRecipient[];
  /** How many distinct addresses the tenant's suppression list removed. */
  readonly suppressedCount: number;
}

/**
 * One entry per person, keyed on the normalized address.
 *
 * Case matters here and is the reason this normalizes rather than trusting its
 * input: `users.email` and `newsletter_subscribers.email` are unique per tenant
 * in POSTGRES, which compares case-sensitively — so `Jane@x.com` as a customer
 * and `jane@x.com` as a subscriber are two rows and one human being. Deduping
 * on the raw strings would mail her twice.
 *
 * FIRST OCCURRENCE WINS, and callers order the sources deliberately: the
 * customer record carries the `userId` that US-019 writes onto
 * `campaign_recipients`, so it is listed first and a subscriber row for the
 * same address adds nothing that would be lost.
 */
export function dedupeAudienceRecipients(
  candidates: readonly AudienceRecipient[],
): AudienceRecipient[] {
  const byEmail = new Map<string, AudienceRecipient>();
  for (const candidate of candidates) {
    const email = normalizeEmail(candidate.email);
    if (!email || byEmail.has(email)) continue;
    byEmail.set(email, {
      email,
      userId: candidate.userId,
      name: candidate.name ?? null,
    });
  }
  return [...byEmail.values()];
}

/**
 * Drop everyone this tenant may no longer mail (US-004).
 *
 * Suppression is applied to the DEDUPED set, so the excluded count is a number
 * of people rather than a number of rows — the figure the compose screen shows
 * next to the recipient count.
 */
export function excludeSuppressedRecipients(
  recipients: readonly AudienceRecipient[],
  suppressed: readonly string[],
): AudienceResolution {
  const blocked = new Set(suppressed.map(normalizeEmail));
  const kept = recipients.filter((recipient) => !blocked.has(recipient.email));
  return { recipients: kept, suppressedCount: recipients.length - kept.length };
}
