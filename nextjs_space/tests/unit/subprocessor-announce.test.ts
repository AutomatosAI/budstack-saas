import { describe, expect, it } from "vitest";
import { buildAnnouncementEmail } from "@/lib/legal/subprocessor-announce";
import { addDays } from "@/lib/legal/subprocessor-notice";

/**
 * WS3 US-013 — the notice operators actually receive.
 *
 * The point of the email is that a controller can act on it. So it has to name
 * the vendor, say when processing starts, and state the objection deadline as a
 * date — a reader should not have to do arithmetic to find out how long they
 * have.
 */

const ENTRY = {
  id: "postmark",
  name: "Postmark",
  purpose: "Transactional email delivery",
  region: "United States",
  transferMechanism: "EU SCCs + UK addendum",
  effectiveFrom: new Date("2026-09-15T00:00:00Z"),
};

const DEADLINE = addDays(new Date("2026-08-01T00:00:00Z"), 14);

describe("buildAnnouncementEmail", () => {
  const { subject, html } = buildAnnouncementEmail(ENTRY, DEADLINE);

  it("names the vendor in the subject, so it is not mistaken for marketing", () => {
    expect(subject).toContain("Postmark");
    expect(subject.toLowerCase()).toContain("sub-processor");
  });

  it("states what the vendor does and where", () => {
    expect(html).toContain("Transactional email delivery");
    expect(html).toContain("United States");
  });

  it("states the transfer safeguard", () => {
    expect(html).toContain("EU SCCs + UK addendum");
  });

  it("gives the date processing starts", () => {
    expect(html).toContain("15 September 2026");
  });

  it("gives the objection deadline as a date, not a duration", () => {
    expect(html).toContain("15 August 2026");
    expect(html).not.toMatch(/within 14 days/i);
  });

  it("tells the operator how to object", () => {
    expect(html).toContain("legal@budstacks.io");
  });

  it("links the full register", () => {
    expect(html).toContain("/legal/subprocessors");
  });

  it("says the 30-day entitlement out loud", () => {
    expect(html).toContain("30 days");
  });
});
