/**
 * US-025 — reading and writing `segments`, and the two shapes the API answers
 * with.
 *
 * Split out of the routes because the list route, the create route and the
 * update route all return the same row and a column added to one copy and not
 * the others is a field the builder silently loses — the same reason
 * `campaign-fields.ts` exists for campaigns.
 *
 * `tenantId` is named in every `where` for the reason `segment-query.ts` gives:
 * these run inside a request today, and the resolver they feed runs in the
 * worker.
 */

import { prisma } from "@/lib/db";
import {
  audienceSegmentId,
  parseCampaignAudience,
} from "@/lib/email/campaign-audience";
import { CAMPAIGN_EDITABLE_STATUSES } from "@/lib/email/campaign-rules";
import {
  toSegmentSummary,
  type SegmentFilter,
  type SegmentSummary,
  type StoredSegmentRow,
} from "@/lib/email/segment-filter";

export const SEGMENT_NOT_FOUND_MESSAGE = "Segment not found or access denied";

export const DUPLICATE_NAME_MESSAGE =
  "A segment with that name already exists in this store.";

export const SEGMENT_IN_USE_MESSAGE =
  "This segment is the audience of a campaign that has not gone out yet. Point that campaign somewhere else first.";

/** Columns every segment response carries. */
export const SEGMENT_SELECT = {
  id: true,
  name: true,
  filter: true,
  updatedAt: true,
} as const;

/** Postgres unique-violation surfaced by Prisma — here, a duplicate name. */
export function isDuplicateSegmentName(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/** This tenant's segments, most-recently-touched first. */
export async function listSegments(tenantId: string): Promise<SegmentSummary[]> {
  const rows: StoredSegmentRow[] = await prisma.segments.findMany({
    where: { tenantId },
    orderBy: [{ updatedAt: "desc" }],
    select: SEGMENT_SELECT,
  });
  return rows.map(toSegmentSummary);
}

export interface SegmentWriteInput {
  readonly tenantId: string;
  readonly name: string;
  readonly filter: SegmentFilter;
}

export async function createSegment(
  input: SegmentWriteInput,
): Promise<SegmentSummary> {
  const row: StoredSegmentRow = await prisma.segments.create({
    data: {
      tenantId: input.tenantId,
      name: input.name,
      // Spread into a plain object: Prisma's Json input rejects the readonly
      // arrays the grammar hands back, and a stored rule should be the
      // parser's output rather than whatever the request happened to send.
      filter: { criteria: [...input.filter.criteria] },
    },
    select: SEGMENT_SELECT,
  });
  return toSegmentSummary(row);
}

export interface SegmentUpdateInput {
  readonly tenantId: string;
  readonly id: string;
  readonly name?: string;
  readonly filter?: SegmentFilter;
}

/**
 * Update a segment, or answer `null` when it is not this tenant's.
 *
 * `updateMany` keyed on (id, tenantId) rather than `update` on the id: a
 * single-row update by primary key would edit another store's segment if the
 * ownership read and the write ever disagreed. The count IS the ownership
 * check, evaluated by Postgres at the moment of the write.
 */
export async function updateSegment(
  input: SegmentUpdateInput,
): Promise<SegmentSummary | null> {
  const { count } = await prisma.segments.updateMany({
    where: { id: input.id, tenantId: input.tenantId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.filter !== undefined && {
        filter: { criteria: [...input.filter.criteria] },
      }),
    },
  });
  if (count === 0) return null;

  const row: StoredSegmentRow | null = await prisma.segments.findFirst({
    where: { id: input.id, tenantId: input.tenantId },
    select: SEGMENT_SELECT,
  });
  return row ? toSegmentSummary(row) : null;
}

/**
 * Names of the not-yet-sent campaigns pointing at this segment.
 *
 * Deleting a segment out from under a SCHEDULED campaign would leave a send
 * that fires at 9am, resolves to nobody and refuses itself — a loud failure,
 * but at the one moment nobody is watching. So the delete asks first.
 *
 * Matched in JS rather than with a Json path operator: the audience rule is
 * narrowed by `parseCampaignAudience` everywhere else, and a store's unsent
 * campaigns number in the tens. Reading them is cheaper than a second way of
 * reading the same column.
 *
 * SENT campaigns are deliberately not consulted — their recipients are already
 * materialized in `campaign_recipients`, so the segment they came from no
 * longer decides anything.
 */
export async function campaignsUsingSegment(
  segmentId: string,
  tenantId: string,
): Promise<string[]> {
  const rows: { name: string; audience: unknown }[] =
    await prisma.campaigns.findMany({
      where: { tenantId, status: { in: [...CAMPAIGN_EDITABLE_STATUSES] } },
      select: { name: true, audience: true },
    });

  return rows
    .filter((row) => {
      const audience = parseCampaignAudience(row.audience);
      return audience !== null && audienceSegmentId(audience) === segmentId;
    })
    .map((row) => row.name);
}

/** True when a row was deleted; false when the id is not this tenant's. */
export async function deleteSegment(
  id: string,
  tenantId: string,
): Promise<boolean> {
  const { count } = await prisma.segments.deleteMany({ where: { id, tenantId } });
  return count > 0;
}
