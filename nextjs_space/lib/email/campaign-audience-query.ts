/**
 * US-018 — resolving a campaign's audience RULE into the addresses it reaches,
 * right now.
 *
 * SERVER ONLY: this is where the audience meets Prisma. The grammar, the labels
 * and the two folds are in `campaign-audience.ts`, which the compose screen
 * imports; nothing here belongs in a browser bundle.
 *
 * Every query takes `tenantId` explicitly and puts it in the `where` itself
 * rather than leaning on the lib/db.ts scope layer — the same rule
 * `suppression-store.ts` follows, and for the same reason: US-019's fan-out
 * runs in the worker, outside any request, where there is no bound tenant
 * context to inherit. Inside a request the scope layer merges the identical
 * tenantId, so both callers issue the same SQL.
 */

import { z } from "zod";

import { prisma } from "@/lib/db";
import { ERASURE_EMAIL_DOMAIN } from "@/lib/gdpr/erasure";
import {
  audienceIncludes,
  audienceSegmentId,
  dedupeAudienceRecipients,
  excludeSuppressedRecipients,
  type AudienceRecipient,
  type AudienceResolution,
  type CampaignAudience,
} from "@/lib/email/campaign-audience";
import { resolveSegmentById } from "@/lib/email/segment-query";
import { normalizeEmail } from "@/lib/email/suppression";
import { findSuppressedRecipients } from "@/lib/email/suppression-store";

/**
 * The `audience` field as it arrives on a campaign create/update body.
 *
 * A discriminated union, so `{ type: "segment" }` with no segment is rejected
 * at the boundary rather than stored as a rule nobody can resolve. The three
 * flat types keep exactly the shape they had before US-025.
 */
export const campaignAudienceBodySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("subscribers") }).strict(),
  z.object({ type: z.literal("customers") }).strict(),
  z.object({ type: z.literal("both") }).strict(),
  z.object({ type: z.literal("segment"), segmentId: z.string().uuid() }).strict(),
]);

/**
 * Resolving an audience is two unbounded reads plus a suppression lookup, and
 * the compose screen fires one every time the author changes the selection.
 * Metered per user so a held-down key cannot turn the picker into a table-scan
 * loop.
 *
 * DELIBERATELY TIGHTER than the sibling preview endpoint's 90/min (US-015),
 * because the cost profile is not the same: a preview is two indexed lookups by
 * id, while this scans the tenant's subscribers and — `users` carries only
 * `@@index([tenantId])` — its whole customer set. There are three options to
 * compare, so 20 a minute is far more than an author picking between them can
 * use, and far less than a script can.
 *
 * Fail-open all the same: this is an authenticated, permission-gated READ, and
 * blinding an author to their own recipient count during a Redis outage is the
 * worse failure of the two.
 */
export const AUDIENCE_COUNT_RATE_LIMIT = {
  maxRequests: 20,
  windowMs: 60_000,
  failMode: "open",
} as const;

/** Namespaced so a count never shares a counter with another endpoint. */
export function audienceCountRateLimitKey(scope: string): string {
  return `campaign-audience-count:${scope}`;
}

/**
 * Confirmed newsletter subscribers (US-001/US-003).
 *
 * CONFIRMED only: PENDING is someone who asked for the opt-in mail and never
 * followed it, and UNSUBSCRIBED/SUPPRESSED are people who left. Mailing any of
 * them a campaign is the double opt-in being decorative.
 */
async function confirmedSubscribers(
  tenantId: string,
): Promise<AudienceRecipient[]> {
  const rows: { email: string }[] = await prisma.newsletter_subscribers.findMany(
    {
      where: { tenantId, status: "CONFIRMED" },
      select: { email: true },
    },
  );
  return rows.map((row) => ({
    email: normalizeEmail(row.email),
    userId: null,
  }));
}

/**
 * Customers who opted in to marketing (US-023 writes the column).
 *
 * `marketingConsentAt: { not: null }` is the whole test — consent is never
 * inferred from having ordered. GDPR-erased rows are excluded exactly as the
 * customer list excludes them (app/api/tenant-admin/customers/route.ts:20-22):
 * the row survives for order history, but `deleted-<id>@deleted.local` is not
 * an address and mailing it would be a bounce at best.
 */
async function consentedCustomers(
  tenantId: string,
): Promise<AudienceRecipient[]> {
  const rows: { id: string; email: string; name: string | null }[] =
    await prisma.users.findMany({
      where: {
        tenantId,
        role: "PATIENT",
        marketingConsentAt: { not: null },
        NOT: { email: { endsWith: `@${ERASURE_EMAIL_DOMAIN}` } },
      },
      // `name` is only for the `{{userName}}` merge tag US-019 fills per
      // recipient; the count endpoint never returns it.
      select: { id: true, email: true, name: true },
    });
  return rows.map((row) => ({
    email: normalizeEmail(row.email),
    userId: row.id,
    name: row.name,
  }));
}

/**
 * Who this campaign would reach if it went out now — deduped, and with the
 * tenant's suppression list applied.
 *
 * READ ONLY. Nothing here writes `campaign_recipients`: the rule is resolved
 * for a count on the compose screen and again, independently, when US-019
 * materializes the send. Two resolutions of the same rule can legitimately
 * differ, and the send's answer is the one that counts.
 *
 * The unqueried source costs nothing: a `subscribers` audience never touches
 * the users table at all.
 */
export async function resolveCampaignAudience(
  audience: CampaignAudience,
  tenantId: string,
): Promise<AudienceResolution> {
  // US-025. A segment is customers narrowed by a saved rule, so it replaces the
  // two reads below rather than joining them — and it applies consent and
  // suppression itself. A segment that has been deleted resolves to nobody,
  // which US-019 turns into a refusal to send rather than a wider send.
  const segmentId = audienceSegmentId(audience);
  if (segmentId) {
    return resolveSegmentById(segmentId, tenantId);
  }

  const [customers, subscribers] = await Promise.all([
    audienceIncludes(audience, "customers")
      ? consentedCustomers(tenantId)
      : Promise.resolve<AudienceRecipient[]>([]),
    audienceIncludes(audience, "subscribers")
      ? confirmedSubscribers(tenantId)
      : Promise.resolve<AudienceRecipient[]>([]),
  ]);

  // Customers first: dedupe keeps the first occurrence, and that is the record
  // carrying the userId US-019 needs on the recipient row.
  const recipients = dedupeAudienceRecipients([...customers, ...subscribers]);

  const suppressed = await findSuppressedRecipients(
    tenantId,
    recipients.map((recipient) => recipient.email),
  );

  return excludeSuppressedRecipients(recipients, suppressed);
}
