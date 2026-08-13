/**
 * US-025 — the segment filter grammar, v1.
 *
 * A TYPED UNION, never free-form Json. `segments.filter` is a Json column
 * because Postgres has no union type, not because anything may be written into
 * it: every read goes through {@link parseSegmentFilter}, which rebuilds the
 * criteria it recognises and returns `null` for everything else.
 *
 * FAIL CLOSED IS THE WHOLE DESIGN. A criterion this version cannot read makes
 * the entire filter unreadable rather than being quietly dropped — dropping one
 * would leave a filter that is WIDER than the author wrote, and for a marketing
 * send "wider than intended" is the only direction that costs anything. The
 * same reasoning as `parseCampaignAudience`, where an unrecognised rule reads as
 * "nobody" and never as "everybody".
 *
 * PURE AND BROWSER-SAFE, like `campaign-audience.ts`: literals, types, and
 * folds. The segment builder needs the labels and the summary line; the count
 * and the send need the same grammar with a database behind it, and that is
 * `segment-query.ts`. The one import is `normalizeTag`, so a tag typed into the
 * builder is canonicalised exactly as US-024 stored it.
 */

import { TAG_MAX_LENGTH, normalizeTag } from "@/lib/customers/tag-format";

export const SEGMENT_NAME_MAX = 120;

/** Days are bounded so a filter cannot ask for a cutoff before Unix time. */
export const SEGMENT_MAX_DAYS = 3650;
export const SEGMENT_MIN_DAYS = 1;

/** Order counts above this are not a segment anybody means to write. */
export const SEGMENT_MAX_ORDER_COUNT = 1000;

export const SEGMENT_CRITERION_KINDS = [
  "last-order-age",
  "order-count-min",
  "never-ordered",
  "has-tag",
  "kyc-approved",
  "marketing-consent",
] as const;

export type SegmentCriterionKind = (typeof SEGMENT_CRITERION_KINDS)[number];

/**
 * One axis of the filter.
 *
 * `order-count-min` and `never-ordered` are the two operators of the ONE "order
 * count" axis (>= N and = 0). They are separate members rather than an operator
 * field because `>= 0` matches everybody and `= N` for N > 0 is a question
 * nobody asks — modelling the two useful operators as two shapes makes the
 * useless ones unrepresentable instead of merely invalid.
 */
export type SegmentCriterion =
  | { readonly kind: "last-order-age"; readonly days: number }
  | { readonly kind: "order-count-min"; readonly count: number }
  | { readonly kind: "never-ordered" }
  | { readonly kind: "has-tag"; readonly tag: string }
  | { readonly kind: "kyc-approved" }
  | { readonly kind: "marketing-consent" };

/**
 * The stored rule: criteria ANDed together.
 *
 * AT MOST ONE PER KIND, enforced by the parser — two `order-count-min` rows
 * would silently mean "the stricter one" and two `kyc-approved` rows mean
 * nothing at all. One row per axis is also exactly what the builder renders, so
 * the grammar and the screen describe the same object.
 *
 * Contradictions ARE representable (`never-ordered` + `last-order-age` matches
 * nobody) and are deliberately left alone: the live count says 0, which is a
 * truer answer than a validation error about a rule the author may be halfway
 * through writing.
 */
export interface SegmentFilter {
  readonly criteria: readonly SegmentCriterion[];
}

export const SEGMENT_MAX_CRITERIA = SEGMENT_CRITERION_KINDS.length;

export interface SegmentCriterionOption {
  readonly kind: SegmentCriterionKind;
  readonly label: string;
  /** One line telling the author who this axis keeps, in their words. */
  readonly description: string;
  /** The numeric argument this kind takes, if it takes one. */
  readonly value?: {
    readonly min: number;
    readonly max: number;
    readonly default: number;
    readonly unit: string;
  };
  /** True for `has-tag`, the one axis whose argument is text. */
  readonly takesTag?: boolean;
}

export const SEGMENT_CRITERION_OPTIONS: readonly SegmentCriterionOption[] = [
  {
    kind: "last-order-age",
    label: "Has not ordered recently",
    description:
      "Customers whose most recent order is at least this many days old. Customers who have never ordered are NOT included — use \"Has never ordered\" for those.",
    value: { min: SEGMENT_MIN_DAYS, max: SEGMENT_MAX_DAYS, default: 60, unit: "days" },
  },
  {
    kind: "order-count-min",
    label: "Has ordered at least",
    description:
      "Customers with at least this many orders in this store. Orders placed in another store never count.",
    value: { min: 1, max: SEGMENT_MAX_ORDER_COUNT, default: 2, unit: "orders" },
  },
  {
    kind: "never-ordered",
    label: "Has never ordered",
    description: "Customers with no orders at all in this store.",
  },
  {
    kind: "has-tag",
    label: "Carries the tag",
    description:
      "Customers tagged with this exact tag. Tags are matched in their stored form — trimmed and lowercased.",
    takesTag: true,
  },
  {
    kind: "kyc-approved",
    label: "Is KYC approved",
    description:
      "Customers whose most recent ID check came back verified. This mirrors Dr Green's answer for targeting; it is not an eligibility decision.",
  },
  {
    kind: "marketing-consent",
    label: "Has opted in to marketing",
    description:
      "Customers who ticked the marketing box. Every campaign applies this anyway — adding it here only changes how many customers the filter reports as matching.",
  },
];

const OPTIONS_BY_KIND = new Map(
  SEGMENT_CRITERION_OPTIONS.map((option) => [option.kind, option]),
);

export function segmentCriterionOption(
  kind: SegmentCriterionKind,
): SegmentCriterionOption | undefined {
  return OPTIONS_BY_KIND.get(kind);
}

/** A whole number inside [min, max]. Rejects NaN, Infinity and 1.5 alike. */
function boundedInteger(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value >= min && value <= max ? value : null;
}

/**
 * Narrow one untrusted object to a criterion, REBUILT rather than passed
 * through — so a key this version does not know about cannot ride along into a
 * later write, exactly as `parseCampaignAudience` rebuilds an audience.
 */
export function parseSegmentCriterion(value: unknown): SegmentCriterion | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const criterion = value as Record<string, unknown>;

  switch (criterion.kind) {
    case "last-order-age": {
      const days = boundedInteger(criterion.days, SEGMENT_MIN_DAYS, SEGMENT_MAX_DAYS);
      return days === null ? null : { kind: "last-order-age", days };
    }
    case "order-count-min": {
      const count = boundedInteger(criterion.count, 1, SEGMENT_MAX_ORDER_COUNT);
      return count === null ? null : { kind: "order-count-min", count };
    }
    case "never-ordered":
      return { kind: "never-ordered" };
    case "has-tag": {
      if (typeof criterion.tag !== "string") return null;
      // Normalised, not merely validated: US-024 stores tags trimmed and
      // lowercased, so a filter holding "VIP" would match nothing at all.
      const tag = normalizeTag(criterion.tag);
      return tag && tag.length <= TAG_MAX_LENGTH ? { kind: "has-tag", tag } : null;
    }
    case "kyc-approved":
      return { kind: "kyc-approved" };
    case "marketing-consent":
      return { kind: "marketing-consent" };
    default:
      return null;
  }
}

/**
 * Narrow a whole `segments.filter` column.
 *
 * Returns `null` — "this store cannot resolve that rule" — for an empty
 * criteria list, for a duplicated kind, and for ANY unreadable criterion. The
 * last of those is the important one: honouring the readable half of a filter
 * would send to a wider set of people than the author ever approved.
 */
export function parseSegmentFilter(value: unknown): SegmentFilter | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const { criteria } = value as { criteria?: unknown };
  if (!Array.isArray(criteria) || criteria.length === 0) return null;
  if (criteria.length > SEGMENT_MAX_CRITERIA) return null;

  const parsed: SegmentCriterion[] = [];
  const seen = new Set<SegmentCriterionKind>();
  for (const entry of criteria) {
    const criterion = parseSegmentCriterion(entry);
    if (!criterion || seen.has(criterion.kind)) return null;
    seen.add(criterion.kind);
    parsed.push(criterion);
  }
  return { criteria: parsed };
}

/** One stored row as it comes off the column — `filter` still unknown. */
export interface StoredSegmentRow {
  readonly id: string;
  readonly name: string;
  readonly filter: unknown;
  readonly updatedAt: Date | string;
}

/** One row as the API answers with it, and as every screen reads it. */
export interface SegmentSummary {
  readonly id: string;
  readonly name: string;
  /**
   * `null` when the stored rule is one this version cannot read. Shown as "this
   * rule can't be displayed" rather than as an empty filter, because an empty
   * filter looks editable and would save as something else entirely.
   */
  readonly filter: SegmentFilter | null;
  readonly updatedAt: string;
}

/**
 * Narrow a stored row on its way out.
 *
 * Declared HERE, beside the grammar, so the builder and the audience picker can
 * import the shape the API returns without importing the module that has
 * Prisma in it.
 */
export function toSegmentSummary(row: StoredSegmentRow): SegmentSummary {
  return {
    id: row.id,
    name: row.name,
    filter: parseSegmentFilter(row.filter),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

/** One criterion as a phrase, for the summary line under a segment's name. */
export function describeSegmentCriterion(criterion: SegmentCriterion): string {
  switch (criterion.kind) {
    case "last-order-age":
      return `no order in ${criterion.days} days`;
    case "order-count-min":
      return criterion.count === 1
        ? "has ordered at least once"
        : `has at least ${criterion.count} orders`;
    case "never-ordered":
      return "has never ordered";
    case "has-tag":
      return `tagged "${criterion.tag}"`;
    case "kyc-approved":
      return "KYC approved";
    case "marketing-consent":
      return "opted in to marketing";
  }
}

/**
 * The whole filter as one sentence.
 *
 * "and" rather than commas: the criteria are ANDed, and a list that reads like
 * alternatives would describe a much larger audience than the one that will be
 * mailed.
 */
export function describeSegmentFilter(filter: SegmentFilter): string {
  return filter.criteria.map(describeSegmentCriterion).join(" and ");
}
