import { describe, expect, it } from "vitest";

// Email Phase 2 US-025 — the segment filter grammar and the builder's own
// logic. Pure: no prisma, no DOM, no mocks.

import {
  SEGMENT_CRITERION_KINDS,
  SEGMENT_CRITERION_OPTIONS,
  SEGMENT_MAX_DAYS,
  SEGMENT_MAX_ORDER_COUNT,
  describeSegmentFilter,
  parseSegmentCriterion,
  parseSegmentFilter,
  toSegmentSummary,
  type SegmentCriterion,
} from "@/lib/email/segment-filter";
import { segmentFilterBodySchema } from "@/lib/email/segment-query";
import {
  defaultCriterion,
  formatSegmentCount,
  readySegmentFilter,
  segmentCountLine,
  withCriterion,
  withoutCriterion,
} from "@/components/admin/email/segment-client";

/** One valid criterion per axis — the fixture every axis test starts from. */
const ONE_PER_AXIS: SegmentCriterion[] = [
  { kind: "last-order-age", days: 60 },
  { kind: "order-count-min", count: 2 },
  { kind: "never-ordered" },
  { kind: "has-tag", tag: "vip" },
  { kind: "kyc-approved" },
  { kind: "marketing-consent" },
];

describe("parseSegmentCriterion — one test per filter axis", () => {
  it("reads a last-order age in days", () => {
    expect(parseSegmentCriterion({ kind: "last-order-age", days: 60 })).toEqual({
      kind: "last-order-age",
      days: 60,
    });
  });

  it("reads an order-count floor", () => {
    expect(parseSegmentCriterion({ kind: "order-count-min", count: 3 })).toEqual({
      kind: "order-count-min",
      count: 3,
    });
  });

  it("reads the = 0 operator as its own axis", () => {
    expect(parseSegmentCriterion({ kind: "never-ordered" })).toEqual({
      kind: "never-ordered",
    });
  });

  it("reads a tag, normalised the way US-024 stored it", () => {
    // "VIP" as typed would match nothing: customer_tags holds tags trimmed and
    // lowercased.
    expect(parseSegmentCriterion({ kind: "has-tag", tag: "  VIP " })).toEqual({
      kind: "has-tag",
      tag: "vip",
    });
  });

  it("reads the KYC axis", () => {
    expect(parseSegmentCriterion({ kind: "kyc-approved" })).toEqual({
      kind: "kyc-approved",
    });
  });

  it("reads the marketing-consent axis", () => {
    expect(parseSegmentCriterion({ kind: "marketing-consent" })).toEqual({
      kind: "marketing-consent",
    });
  });

  it("rebuilds the object, so unknown keys cannot ride along", () => {
    expect(
      parseSegmentCriterion({ kind: "never-ordered", exceptFor: "everyone" }),
    ).toEqual({ kind: "never-ordered" });
  });

  it.each([
    ["an unknown kind", { kind: "spent-over", amount: 100 }],
    ["a missing argument", { kind: "last-order-age" }],
    ["a non-integer day count", { kind: "last-order-age", days: 1.5 }],
    ["a zero day count", { kind: "last-order-age", days: 0 }],
    ["a negative day count", { kind: "last-order-age", days: -30 }],
    ["a day count past the cap", { kind: "last-order-age", days: SEGMENT_MAX_DAYS + 1 }],
    ["NaN", { kind: "last-order-age", days: Number.NaN }],
    ["a zero order floor", { kind: "order-count-min", count: 0 }],
    ["an order floor past the cap", { kind: "order-count-min", count: SEGMENT_MAX_ORDER_COUNT + 1 }],
    ["a blank tag", { kind: "has-tag", tag: "   " }],
    ["a non-string tag", { kind: "has-tag", tag: 7 }],
    ["a bare string", "never-ordered"],
    ["an array", [{ kind: "never-ordered" }]],
    ["null", null],
  ])("refuses %s", (_label, value) => {
    expect(parseSegmentCriterion(value)).toBeNull();
  });

  it("offers exactly one builder row per axis, in the declared order", () => {
    expect(SEGMENT_CRITERION_OPTIONS.map((option) => option.kind)).toEqual([
      ...SEGMENT_CRITERION_KINDS,
    ]);
  });
});

describe("parseSegmentFilter", () => {
  it("reads every axis together", () => {
    expect(parseSegmentFilter({ criteria: ONE_PER_AXIS })).toEqual({
      criteria: ONE_PER_AXIS,
    });
  });

  it("FAILS CLOSED on one unreadable criterion, rather than dropping it", () => {
    // Dropping the unknown row would leave "everyone who has ordered", which is
    // a WIDER audience than the author wrote — the only direction that costs
    // anything on a marketing send.
    expect(
      parseSegmentFilter({
        criteria: [
          { kind: "order-count-min", count: 2 },
          { kind: "spent-over", amount: 100 },
        ],
      }),
    ).toBeNull();
  });

  it("refuses a repeated axis rather than silently ANDing it", () => {
    expect(
      parseSegmentFilter({
        criteria: [
          { kind: "order-count-min", count: 2 },
          { kind: "order-count-min", count: 5 },
        ],
      }),
    ).toBeNull();
  });

  it.each([
    ["no criteria at all", { criteria: [] }],
    ["a missing criteria key", {}],
    ["criteria that are not a list", { criteria: { kind: "never-ordered" } }],
    ["more criteria than there are axes", {
      criteria: [...ONE_PER_AXIS, { kind: "never-ordered" }],
    }],
    ["null", null],
    ["an array", []],
  ])("reads %s as no rule at all", (_label, value) => {
    expect(parseSegmentFilter(value)).toBeNull();
  });

  it("keeps contradictions readable — the count is the honest answer", () => {
    // "never ordered" AND "no order in 60 days" reaches nobody. That is a live
    // 0 in the builder, not a validation error thrown at a half-written rule.
    const filter = parseSegmentFilter({
      criteria: [{ kind: "never-ordered" }, { kind: "last-order-age", days: 60 }],
    });
    expect(filter?.criteria).toHaveLength(2);
  });
});

describe("segmentFilterBodySchema", () => {
  it("accepts every filter the parser can read back", () => {
    // The property that matters: a filter the API stores must be one the
    // resolver can resolve. (The reverse does not hold, and should not — the
    // wire schema is strict, the column parser is tolerant of older rows.)
    for (const criterion of ONE_PER_AXIS) {
      const body = { criteria: [criterion] };
      expect(segmentFilterBodySchema.safeParse(body).success).toBe(true);
      expect(parseSegmentFilter(body)).not.toBeNull();
    }
  });

  it("refuses an unknown axis on the wire", () => {
    expect(
      segmentFilterBodySchema.safeParse({
        criteria: [{ kind: "spent-over", amount: 100 }],
      }).success,
    ).toBe(false);
  });

  it("refuses a repeated axis on the wire, as the parser does in the column", () => {
    expect(
      segmentFilterBodySchema.safeParse({
        criteria: [{ kind: "kyc-approved" }, { kind: "kyc-approved" }],
      }).success,
    ).toBe(false);
  });

  it("refuses an empty rule", () => {
    expect(segmentFilterBodySchema.safeParse({ criteria: [] }).success).toBe(false);
  });

  it("normalises the tag as it validates", () => {
    const parsed = segmentFilterBodySchema.safeParse({
      criteria: [{ kind: "has-tag", tag: " VIP " }],
    });
    expect(parsed.success && parsed.data.criteria[0]).toEqual({
      kind: "has-tag",
      tag: "vip",
    });
  });
});

describe("describeSegmentFilter", () => {
  it("joins the axes with 'and', because they are ANDed", () => {
    // A comma list would read as alternatives, describing a much larger
    // audience than the one that gets mailed.
    expect(
      describeSegmentFilter({
        criteria: [
          { kind: "last-order-age", days: 60 },
          { kind: "has-tag", tag: "vip" },
        ],
      }),
    ).toBe('no order in 60 days and tagged "vip"');
  });
});

describe("toSegmentSummary", () => {
  it("narrows the stored rule on the way out", () => {
    const summary = toSegmentSummary({
      id: "seg_1",
      name: "Reorder",
      filter: { criteria: [{ kind: "never-ordered" }] },
      updatedAt: new Date("2026-08-13T09:00:00.000Z"),
    });

    expect(summary.filter).toEqual({ criteria: [{ kind: "never-ordered" }] });
    expect(summary.updatedAt).toBe("2026-08-13T09:00:00.000Z");
  });

  it("hands back a null rule rather than an empty one it cannot read", () => {
    // An empty filter would look editable and save back as something else.
    expect(
      toSegmentSummary({
        id: "seg_1",
        name: "From the future",
        filter: { criteria: [{ kind: "spent-over" }] },
        updatedAt: "2026-08-13T09:00:00.000Z",
      }).filter,
    ).toBeNull();
  });
});

describe("builder list edits", () => {
  it("starts each axis on the default the option declares", () => {
    expect(defaultCriterion("last-order-age")).toEqual({
      kind: "last-order-age",
      days: 60,
    });
    expect(defaultCriterion("order-count-min")).toEqual({
      kind: "order-count-min",
      count: 2,
    });
    expect(defaultCriterion("kyc-approved")).toEqual({ kind: "kyc-approved" });
  });

  it("starts the tag axis unreadable, so an empty tag cannot be saved", () => {
    const criteria = [defaultCriterion("has-tag")];
    expect(readySegmentFilter(criteria)).toBeNull();
  });

  it("replaces an axis in place rather than adding a second one", () => {
    const criteria = withCriterion(
      [{ kind: "last-order-age", days: 60 }],
      { kind: "last-order-age", days: 90 },
    );
    expect(criteria).toEqual([{ kind: "last-order-age", days: 90 }]);
  });

  it("keeps the declared axis order however the rows were added", () => {
    const criteria = withCriterion(
      withCriterion([], { kind: "marketing-consent" }),
      { kind: "last-order-age", days: 30 },
    );
    expect(criteria.map((criterion) => criterion.kind)).toEqual([
      "last-order-age",
      "marketing-consent",
    ]);
  });

  it("mutates nothing it was handed", () => {
    const original: SegmentCriterion[] = [{ kind: "never-ordered" }];
    withCriterion(original, { kind: "kyc-approved" });
    withoutCriterion(original, "never-ordered");
    expect(original).toEqual([{ kind: "never-ordered" }]);
  });

  it("removes an axis by kind", () => {
    expect(
      withoutCriterion(
        [{ kind: "never-ordered" }, { kind: "kyc-approved" }],
        "never-ordered",
      ),
    ).toEqual([{ kind: "kyc-approved" }]);
  });

  it("treats a cleared number box as not-yet-a-rule", () => {
    // The box has to be clearable — refusing the edit would trap the cursor
    // behind the digit being replaced — so the rule simply stops being one.
    expect(
      readySegmentFilter([{ kind: "last-order-age", days: Number.NaN }]),
    ).toBeNull();
  });
});

describe("formatSegmentCount", () => {
  it("names the recipients, then why the rest are not", () => {
    expect(formatSegmentCount({ matched: 142, count: 118, suppressed: 2 })).toBe(
      "118 recipients · 22 without marketing consent · 2 excluded (unsubscribed, bounced or blocked)",
    );
  });

  it("says nothing about consent or suppression when neither removed anyone", () => {
    expect(formatSegmentCount({ matched: 5, count: 5, suppressed: 0 })).toBe(
      "5 recipients",
    );
  });

  it("calls zero out in words rather than printing '0 recipients'", () => {
    expect(formatSegmentCount({ matched: 9, count: 0, suppressed: 0 })).toBe(
      "Nobody — this rule reaches no one right now · 9 without marketing consent",
    );
  });

  it("agrees with itself in the singular", () => {
    expect(formatSegmentCount({ matched: 1, count: 1, suppressed: 0 })).toBe(
      "1 recipient",
    );
  });
});

describe("segmentCountLine", () => {
  const base = { hasRule: true, isCounting: false, error: null, result: null };

  it("asks for a rule before it asks for anything else", () => {
    expect(segmentCountLine({ ...base, hasRule: false }).text).toBe(
      "Add at least one rule to see who this reaches.",
    );
  });

  it("shows the spinner wording while counting, even holding an old answer", () => {
    // The previous rule's figure beside the newly-edited rule reads worse than
    // no figure at all.
    expect(
      segmentCountLine({
        ...base,
        isCounting: true,
        result: { matched: 9, count: 9, suppressed: 0 },
      }).text,
    ).toBe("Counting…");
  });

  it("shows the failure, in the tone that says it is one", () => {
    const line = segmentCountLine({ ...base, error: "Too many requests" });
    expect(line).toEqual({ text: "Too many requests", tone: "error" });
  });

  it("shows the count once there is one", () => {
    const line = segmentCountLine({
      ...base,
      result: { matched: 3, count: 3, suppressed: 0 },
    });
    expect(line).toEqual({ text: "3 recipients", tone: "count" });
  });
});
