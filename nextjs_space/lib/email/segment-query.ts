/**
 * US-025 — resolving a segment RULE into the customers it reaches, right now.
 *
 * SERVER ONLY: this is where the grammar in `segment-filter.ts` meets Prisma.
 * The builder imports the grammar; nothing here belongs in a browser bundle.
 *
 * Every query takes `tenantId` explicitly and puts it in the `where` itself
 * rather than leaning on the lib/db.ts scope layer — the rule
 * `campaign-audience-query.ts` follows, and for the same reason: a segment is
 * resolved again inside US-019's fan-out, which runs in the worker under
 * `bypassTenantScope` where there is no bound context to inherit. That
 * explicitness matters twice over here, because a criterion filters a RELATION
 * (`orders`, `customer_tags`) and the scope layer rewrites only the top-level
 * `where` of the model being queried — a relation predicate without its own
 * tenantId would reach across stores.
 */

import { z } from "zod";

import { tagSchema } from "@/lib/customers/tag-format";
import { prisma } from "@/lib/db";
import {
  dedupeAudienceRecipients,
  excludeSuppressedRecipients,
  type AudienceResolution,
} from "@/lib/email/campaign-audience";
import {
  SEGMENT_MAX_CRITERIA,
  SEGMENT_MAX_DAYS,
  SEGMENT_MAX_ORDER_COUNT,
  SEGMENT_MIN_DAYS,
  SEGMENT_NAME_MAX,
  parseSegmentFilter,
  type SegmentFilter,
} from "@/lib/email/segment-filter";
import { normalizeEmail } from "@/lib/email/suppression";
import { findSuppressedRecipients } from "@/lib/email/suppression-store";
import { ERASURE_EMAIL_DOMAIN } from "@/lib/gdpr/erasure";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const DUPLICATE_AXIS_MESSAGE =
  "Each rule can be used once — combine different rules instead of repeating one.";

/**
 * The wire form of a criterion.
 *
 * A zod restatement of the union in `segment-filter.ts` rather than a reuse of
 * it: that module is browser-safe and stays that way. `segment-filter.test.ts`
 * fails if the two ever disagree about what is valid, which is the check that
 * matters — a filter this schema accepts but `parseSegmentFilter` cannot read
 * would be a segment that saves and then resolves to nobody.
 */
const segmentCriterionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("last-order-age"),
      days: z.number().int().min(SEGMENT_MIN_DAYS).max(SEGMENT_MAX_DAYS),
    })
    .strict(),
  z
    .object({
      kind: z.literal("order-count-min"),
      count: z.number().int().min(1).max(SEGMENT_MAX_ORDER_COUNT),
    })
    .strict(),
  z.object({ kind: z.literal("never-ordered") }).strict(),
  // `tagSchema` normalises as it validates, so the stored filter holds the tag
  // in the exact form US-024 wrote to `customer_tags`.
  z.object({ kind: z.literal("has-tag"), tag: tagSchema }).strict(),
  z.object({ kind: z.literal("kyc-approved") }).strict(),
  z.object({ kind: z.literal("marketing-consent") }).strict(),
]);

export const segmentFilterBodySchema = z
  .object({
    criteria: z.array(segmentCriterionSchema).min(1).max(SEGMENT_MAX_CRITERIA),
  })
  .strict()
  // One row per axis, matching the parser and the builder. Two
  // `order-count-min` rows would silently mean "the stricter one".
  .refine(
    (filter) =>
      new Set(filter.criteria.map((criterion) => criterion.kind)).size ===
      filter.criteria.length,
    { message: DUPLICATE_AXIS_MESSAGE },
  );

export const segmentNameSchema = z.string().trim().min(1).max(SEGMENT_NAME_MAX);

/**
 * Counting a segment is an unbounded customer read plus up to three more
 * queries, and the builder asks for a fresh one every time the author nudges a
 * number. Metered per user on the same terms as the audience count it feeds
 * (`AUDIENCE_COUNT_RATE_LIMIT`), and fail-open for the same reason: this is an
 * authenticated, permission-gated READ, and blinding an author to their own
 * segment size during a Redis outage is the worse of the two failures.
 */
export const SEGMENT_COUNT_RATE_LIMIT = {
  maxRequests: 20,
  windowMs: 60_000,
  failMode: "open",
} as const;

export function segmentCountRateLimitKey(scope: string): string {
  return `segment-count:${scope}`;
}

/** What the users query returns for one candidate. */
interface SegmentCandidate {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly marketingConsentAt: Date | null;
}

export const SEGMENT_CANDIDATE_SELECT = {
  id: true,
  email: true,
  name: true,
  // Read rather than filtered on, because consent is applied unconditionally
  // below — the count has to be able to report both figures.
  marketingConsentAt: true,
} as const;

export interface SegmentResolution extends AudienceResolution {
  /** Customers matching the filter, BEFORE consent and suppression. */
  readonly matchedCount: number;
}

const NOBODY: SegmentResolution = {
  recipients: [],
  suppressedCount: 0,
  matchedCount: 0,
};

/** The instant `days` before `now`. */
function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * MS_PER_DAY);
}

/**
 * The `users` predicate for everything the database can answer on its own.
 *
 * `kyc-approved` is absent by necessity — `consultation_questionnaires` carries
 * no userId and is joined by email — and `order-count-min` is only half here:
 * Prisma can ask "has any order" but not "has at least three", so this narrows
 * to customers who have ordered at all and the exact count is checked against
 * the candidate set afterwards.
 *
 * Every relation predicate names `tenantId` itself. A customer's orders are
 * their own store's, but stating it is what makes the query correct in the
 * worker, where nothing merges a tenant in.
 */
export function buildSegmentUserWhere(
  filter: SegmentFilter,
  tenantId: string,
  now: Date,
): Record<string, unknown> {
  const and: Record<string, unknown>[] = [];

  for (const criterion of filter.criteria) {
    switch (criterion.kind) {
      case "last-order-age":
        // Two predicates, not one: "no order since the cutoff" alone would also
        // match every customer who has never ordered, which is a different
        // segment (and the reason `never-ordered` exists).
        and.push({ orders: { some: { tenantId } } });
        and.push({
          orders: {
            none: { tenantId, createdAt: { gte: daysBefore(now, criterion.days) } },
          },
        });
        break;
      case "order-count-min":
        and.push({ orders: { some: { tenantId } } });
        break;
      case "never-ordered":
        and.push({ orders: { none: { tenantId } } });
        break;
      case "has-tag":
        and.push({ customer_tags: { some: { tenantId, tag: criterion.tag } } });
        break;
      case "kyc-approved":
        break;
      case "marketing-consent":
        and.push({ marketingConsentAt: { not: null } });
        break;
    }
  }

  return {
    tenantId,
    role: "PATIENT",
    // GDPR-erased rows are excluded exactly as the customer list and the
    // consented-customers audience exclude them: the row survives for order
    // history, but `deleted-<id>@deleted.local` is not an address.
    NOT: { email: { endsWith: `@${ERASURE_EMAIL_DOMAIN}` } },
    ...(and.length > 0 && { AND: and }),
  };
}

/** Which of `userIds` have at least `count` orders in this tenant. */
async function usersWithOrderCount(
  tenantId: string,
  userIds: readonly string[],
  count: number,
): Promise<Set<string>> {
  const rows: { userId: string; _count: { _all: number } }[] =
    await prisma.orders.groupBy({
      by: ["userId"],
      where: { tenantId, userId: { in: [...userIds] } },
      _count: { _all: true },
    });

  return new Set(
    rows.filter((row) => row._count._all >= count).map((row) => row.userId),
  );
}

/**
 * Addresses whose most recent ID check came back verified.
 *
 * Read for the whole tenant and matched in JS because
 * `consultation_questionnaires` is keyed by (tenantId, email) with no userId,
 * and Prisma's `in` has no insensitive mode — the same shape the customers list
 * uses for failed ID uploads. `isKycVerified` is a MIRROR of Dr Green's answer
 * (app/actions/kyc-check.ts), written in both directions; a segment is
 * targeting metadata, so reading the mirror is right here in a way it would not
 * be for an eligibility decision.
 */
async function kycApprovedEmails(tenantId: string): Promise<Set<string>> {
  const rows: { email: string }[] =
    await prisma.consultation_questionnaires.findMany({
      where: { tenantId, isKycVerified: true },
      select: { email: true },
    });

  return new Set(rows.map((row) => normalizeEmail(row.email)));
}

/** The two axes the `users` query cannot answer, applied to its result. */
async function applySegmentPostFilters(
  candidates: readonly SegmentCandidate[],
  filter: SegmentFilter,
  tenantId: string,
): Promise<readonly SegmentCandidate[]> {
  let kept = candidates;

  const minOrders = filter.criteria.find(
    (criterion) => criterion.kind === "order-count-min",
  );
  // `>= 1` was already asserted by `orders: { some: ... }` in the where.
  if (minOrders?.kind === "order-count-min" && minOrders.count > 1 && kept.length > 0) {
    const enough = await usersWithOrderCount(
      tenantId,
      kept.map((candidate) => candidate.id),
      minOrders.count,
    );
    kept = kept.filter((candidate) => enough.has(candidate.id));
  }

  if (
    filter.criteria.some((criterion) => criterion.kind === "kyc-approved") &&
    kept.length > 0
  ) {
    const approved = await kycApprovedEmails(tenantId);
    kept = kept.filter((candidate) => approved.has(normalizeEmail(candidate.email)));
  }

  return kept;
}

/**
 * Who this segment reaches if a campaign went out now.
 *
 * READ ONLY, and consent is applied WHETHER OR NOT the author asked for it. The
 * `marketing-consent` axis changes `matchedCount` — how many customers the rule
 * describes — and can never change who is mailed, because a segment is a
 * targeting rule and consent is not one of the axes an author may leave off.
 * Suppression (US-004) is applied after the dedupe, so its figure is a number of
 * people rather than a number of rows.
 */
export async function resolveSegmentFilter(
  filter: SegmentFilter,
  tenantId: string,
  now: Date = new Date(),
): Promise<SegmentResolution> {
  const candidates: SegmentCandidate[] = await prisma.users.findMany({
    where: buildSegmentUserWhere(filter, tenantId, now),
    select: SEGMENT_CANDIDATE_SELECT,
  });

  const matched = await applySegmentPostFilters(candidates, filter, tenantId);

  const recipients = dedupeAudienceRecipients(
    matched
      .filter((candidate) => candidate.marketingConsentAt !== null)
      .map((candidate) => ({
        email: candidate.email,
        userId: candidate.id,
        name: candidate.name,
      })),
  );

  const suppressed = await findSuppressedRecipients(
    tenantId,
    recipients.map((recipient) => recipient.email),
  );

  return {
    ...excludeSuppressedRecipients(recipients, suppressed),
    matchedCount: matched.length,
  };
}

export interface StoredSegment {
  readonly id: string;
  readonly name: string;
  /** `null` when the stored rule is one this version cannot resolve. */
  readonly filter: SegmentFilter | null;
}

/** One of this tenant's segments, with its rule narrowed on the way out. */
export async function findSegment(
  segmentId: string,
  tenantId: string,
): Promise<StoredSegment | null> {
  const row: { id: string; name: string; filter: unknown } | null =
    await prisma.segments.findFirst({
      where: { id: segmentId, tenantId },
      select: { id: true, name: true, filter: true },
    });

  return row
    ? { id: row.id, name: row.name, filter: parseSegmentFilter(row.filter) }
    : null;
}

/**
 * Resolve a saved segment by id.
 *
 * A segment that has been deleted, belongs to another tenant, or holds a rule
 * this version cannot read resolves to NOBODY. That is the fail-closed answer a
 * campaign needs: US-019 refuses to send to an empty audience, so a broken
 * reference stops a send instead of widening one.
 */
export async function resolveSegmentById(
  segmentId: string,
  tenantId: string,
  now: Date = new Date(),
): Promise<SegmentResolution> {
  const segment = await findSegment(segmentId, tenantId);
  if (!segment?.filter) return NOBODY;
  return resolveSegmentFilter(segment.filter, tenantId, now);
}
