import { describe, expect, it } from "vitest";

import {
  EMAIL_MERGE_TAG_EVENT_TYPES,
  EMAIL_MERGE_TAG_MAX_LENGTH,
  EMAIL_TEMPLATE_HELPERS,
  EVENT_MERGE_TAG_CATEGORY,
  isKnownMergeTag,
  mergeTagGroupsForEvent,
  mergeTagLabel,
  mergeTagText,
  normaliseMergeTagName,
} from "@/lib/email/email-merge-tags";
import { sampleVariablesForEvent } from "@/lib/email/sample-variables";

// Email Phase 2 US-013 — the merge-tag catalogue.
//
// Two things here are load-bearing and neither is the wording of a label:
//
//   1. EVERY TAG ON OFFER HAS A VALUE. The catalogue and US-006's sample data are
//      two halves of one source, keyed by the same event type. Offer a tag that
//      lib/email/sample-variables.ts does not populate and the "send me a test"
//      button delivers an email with a raw {{tag}} sitting in it — the author's
//      only proof that personalisation works, showing it not working.
//   2. WHAT MAY BECOME A TAG NAME. Whatever normaliseMergeTagName returns is
//      wrapped in {{ }} inside contentHtml, which scripts/email-worker.ts hands
//      to Handlebars.compile. The character rule is the only thing standing
//      between an authored document and arbitrary Handlebars.

describe("every tag the editor offers has a sample value", () => {
  // null covers the common case: a template nobody has mapped to an event yet.
  const EVENTS = [null, ...EMAIL_MERGE_TAG_EVENT_TYPES];

  it.each(EVENTS)("covers every tag offered for %s", (eventType) => {
    const samples = sampleVariablesForEvent(eventType);
    const offered = mergeTagGroupsForEvent(eventType).flatMap((group) =>
      group.tags.map((tag) => tag.name),
    );

    expect(offered.length).toBeGreaterThan(0);
    for (const name of offered) {
      expect(samples).toHaveProperty(name);
    }
  });
});

describe("which tags an event puts on offer", () => {
  it("offers the common set when nothing is mapped", () => {
    const categories = mergeTagGroupsForEvent(null).map((group) => group.category);

    expect(categories).toEqual(["Global", "Customer", "Order"]);
  });

  it("adds the event's own tags on top of the common set", () => {
    const groups = mergeTagGroupsForEvent("teamInvite");
    const extras = groups.find(
      (group) => group.category === EVENT_MERGE_TAG_CATEGORY,
    );

    expect(extras?.tags.map((tag) => tag.name)).toEqual([
      "inviterName",
      "role",
      "inviteUrl",
    ]);
    // The common set is still there — an invite email still says who it is from.
    expect(groups.map((group) => group.category)).toContain("Global");
  });

  // An event type arrives from an email_event_mappings row, which a tenant can
  // point at anything. An unrecognised one is not an error, it is just no extras.
  it("falls back to the common set for an event it does not know", () => {
    expect(mergeTagGroupsForEvent("not-an-event")).toEqual(
      mergeTagGroupsForEvent(null),
    );
  });

  // Block helpers are half of a pair, so they are reference-only and must never
  // reach the chip catalogue — a chip is one self-contained {{tag}}.
  it("keeps block helpers out of the tag groups", () => {
    const offered = mergeTagGroupsForEvent(null).flatMap((group) =>
      group.tags.map((tag) => tag.name),
    );

    for (const helper of EMAIL_TEMPLATE_HELPERS) {
      expect(offered).not.toContain(helper);
    }
    expect(EMAIL_TEMPLATE_HELPERS).toContain("#each items");
  });
});

describe("what may become a tag name", () => {
  it.each([
    ["a plain name", "userName", "userName"],
    ["a name in braces, as copied from the reference", "{{orderNumber}}", "orderNumber"],
    ["surrounding whitespace", "  total  ", "total"],
    ["whitespace inside the braces", "{{ total }}", "total"],
    ["a property path", "order.number", "order.number"],
    ["an underscore lead", "_internalRef", "_internalRef"],
  ])("accepts %s", (_label, input, expected) => {
    expect(normaliseMergeTagName(input)).toBe(expected);
  });

  // Each of these is a way into Handlebars rather than a typo: a space opens a
  // helper invocation, `#` and `/` open and close blocks, and an unbalanced brace
  // reaches the triple-stache that prints unescaped HTML.
  it.each([
    ["a helper invocation", "toFixed price"],
    ["a block opener", "#each items"],
    ["a block closer", "/each"],
    ["an escape into a triple-stache", "userName}}{{{evil"],
    ["a partial", "> header"],
    ["a leading digit", "1stName"],
    ["a dangling dot", "order."],
    ["an empty string", "   "],
    ["nothing at all", ""],
    ["a value that is not a string", 42],
    ["a null", null],
  ])("refuses %s", (_label, input) => {
    expect(normaliseMergeTagName(input)).toBeNull();
  });

  it("refuses a name longer than a chip can carry", () => {
    const long = "a".repeat(EMAIL_MERGE_TAG_MAX_LENGTH + 1);

    expect(normaliseMergeTagName(long)).toBeNull();
    expect(normaliseMergeTagName("a".repeat(EMAIL_MERGE_TAG_MAX_LENGTH))).not.toBeNull();
  });
});

describe("what a tag reads as", () => {
  it("wraps a name in the braces the worker compiles", () => {
    expect(mergeTagText("userName")).toBe("{{userName}}");
  });

  it("labels a known tag with the words an author picked it by", () => {
    expect(mergeTagLabel("userName")).toBe("Customer name");
    expect(isKnownMergeTag("userName")).toBe(true);
  });

  // A custom tag has no label of its own. Wearing its own name tells the author
  // what they typed; "Unknown" would tell them nothing.
  it("labels a custom tag with its own name", () => {
    expect(mergeTagLabel("order_reference")).toBe("order_reference");
    expect(isKnownMergeTag("order_reference")).toBe(false);
  });
});
