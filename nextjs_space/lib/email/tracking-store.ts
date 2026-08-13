/**
 * US-027 — recording an open or a click against the recipient it belongs to.
 *
 * SERVER ONLY, and every path through it is allowed to record NOTHING. The two
 * public routes must answer a pixel and a redirect whatever happens here: a
 * recipient reading their mail is not asking us a question, and a missing
 * statistic is not worth a broken image or a dead link.
 *
 * THE SETTING IS RE-READ HERE, at the moment of the event. The render path
 * decided whether the artifacts exist and the fan-out decided whether a token
 * was minted, but both of those happened in the past — a message sent last week
 * is still in an inbox, and turning tracking off has to stop it counting
 * without being able to un-send it.
 *
 * TWO READS RATHER THAN ONE UPDATE, and deliberately: `campaign_recipients`
 * carries no tenantId and is not in the scope set (lib/db.ts), so proving the
 * row belongs to the store whose host served the request means a relation
 * filter through `campaigns` — the same shape `unsubscribe-token.ts` uses. The
 * write is then keyed on the id that came out of that read.
 */

import { prisma } from "@/lib/db";
import { isEmailTrackingEnabled } from "@/lib/email/email-tracking";

/** What a recipient did. One column each. */
export type TrackingEvent = "open" | "click";

/**
 * FIRST occurrence only, per event.
 *
 * `openedAt: null` in the where is what makes it first-write-wins. An inbox
 * re-fetches images every time a message is scrolled past and a link stays live
 * in it for years; without this, "opened" would drift into "how often this
 * person looks at their mail", which is more than the feature needs and more
 * than the privacy notice discloses.
 */
const EVENT_COLUMN: Readonly<Record<TrackingEvent, "openedAt" | "clickedAt">> = {
  open: "openedAt",
  click: "clickedAt",
};

export interface RecordTrackingEventInput {
  readonly tenantId: string;
  readonly recipientId: string;
  readonly event: TrackingEvent;
  readonly now?: Date;
}

/**
 * Whether this store currently wants engagement recorded.
 *
 * Read straight from `tenants.settings` and nothing else — `tenants` is not a
 * tenant-scoped model, so this is safe from a public route with no session, and
 * the id it is keyed on came from resolving the request's own host.
 */
export async function tenantWantsTracking(tenantId: string): Promise<boolean> {
  const tenant: { settings: unknown } | null = await prisma.tenants.findFirst({
    where: { id: tenantId },
    select: { settings: true },
  });
  return tenant ? isEmailTrackingEnabled(tenant.settings, tenantId) : false;
}

/**
 * Stamp a recipient's first open or click, if everything lines up.
 *
 * Returns whether a row was written, which the routes use for nothing but a
 * test assertion: neither of them changes its answer on the strength of it.
 */
export async function recordTrackingEvent({
  tenantId,
  recipientId,
  event,
  now = new Date(),
}: RecordTrackingEventInput): Promise<boolean> {
  if (!(await tenantWantsTracking(tenantId))) return false;

  const column = EVENT_COLUMN[event];

  // The relation filter is the tenant boundary: a token minted by one store
  // cannot stamp a row belonging to another, even though the id it names is
  // globally unique and the signature over it verifies anywhere.
  const recipient: { id: string } | null =
    await prisma.campaign_recipients.findFirst({
      where: { id: recipientId, campaigns: { tenantId } },
      select: { id: true },
    });

  if (!recipient) return false;

  const { count } = await prisma.campaign_recipients.updateMany({
    where: { id: recipient.id, [column]: null },
    data: { [column]: now },
  });

  return count > 0;
}
