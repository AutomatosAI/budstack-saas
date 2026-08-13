import { describe, expect, it } from "vitest";

// Email Phase 2 US-026 — the rules the results page and the recipient CSV are
// folded by, asserted without a database.
//
// The failure classifier is the interesting half: the worker marks its own
// refusals with a machine-matchable prefix precisely so "we declined to send
// this" can be told apart from "the mail server said no", and the constants are
// imported rather than restated so the two cannot drift.

import {
  csvField,
  csvRow,
  streamCsv,
  type CsvPage,
} from "@/lib/admin/csv-stream";
import {
  CAMPAIGN_EXPORT_MAX_ROWS,
  CAMPAIGN_RECIPIENT_CSV_HEADER,
  campaignExportRateLimitKey,
  campaignRecipientCsvFilename,
  campaignRecipientCsvRow,
  type CampaignRecipientExportRow,
} from "@/lib/email/campaign-export";
import {
  CAMPAIGN_FAILURE_LABELS,
  classifyCampaignFailure,
  summariseCampaignFailures,
} from "@/lib/email/campaign-results";
import { hasCampaignResults } from "@/lib/email/campaign-rules";
import {
  CAMPAIGN_CANCELLED_LOG_MESSAGE,
  CAMPAIGN_MAX_RECIPIENTS,
  CAMPAIGN_MISSING_LOG_MESSAGE,
} from "@/lib/email/campaign-send";
import { MISSING_FOOTER_LOG_MESSAGE } from "@/lib/email/marketing-headers";
import { SUPPRESSED_LOG_MESSAGE } from "@/lib/email/suppression";

const SMTP_REJECTION = "550 5.1.1 <nobody@example.com>: user unknown";

describe("classifyCampaignFailure", () => {
  it("recognises every refusal the worker writes, from its own constant", () => {
    // Each of these is the EXACT string scripts/email-worker.ts puts in
    // email_logs.errorMessage — imported, so rewording one fails here rather
    // than quietly reclassifying a whole column as an SMTP problem.
    expect(
      classifyCampaignFailure({ errorMessage: SUPPRESSED_LOG_MESSAGE }),
    ).toBe("suppressed");
    expect(
      classifyCampaignFailure({ errorMessage: CAMPAIGN_CANCELLED_LOG_MESSAGE }),
    ).toBe("cancelled");
    expect(
      classifyCampaignFailure({ errorMessage: CAMPAIGN_MISSING_LOG_MESSAGE }),
    ).toBe("campaign-missing");
    expect(
      classifyCampaignFailure({ errorMessage: MISSING_FOOTER_LOG_MESSAGE }),
    ).toBe("missing-footer");
  });

  it("recognises the PRD-220 expiry, which carries no colon-token", () => {
    expect(
      classifyCampaignFailure({
        errorMessage:
          "Expired unsent (PRD-220): enqueued 2026-08-01T00:00:00.000Z, exceeds EMAIL_MAX_JOB_AGE_MS=172800000",
      }),
    ).toBe("expired");
  });

  it("treats anything else with a message as the mail server's own answer", () => {
    expect(classifyCampaignFailure({ errorMessage: SMTP_REJECTION })).toBe(
      "smtp",
    );
    // A colon in an SMTP response must not be read as a refusal token.
    expect(
      classifyCampaignFailure({
        errorMessage: "Connection timeout: no response from smtp.example.com",
      }),
    ).toBe("smtp");
  });

  it("says unknown rather than inventing a cause", () => {
    expect(classifyCampaignFailure({ errorMessage: null })).toBe("unknown");
    expect(classifyCampaignFailure({ errorMessage: "   " })).toBe("unknown");
  });

  it("falls back to the SMTP response when no message was recorded", () => {
    expect(
      classifyCampaignFailure({
        errorMessage: null,
        smtpResponse: SMTP_REJECTION,
      }),
    ).toBe("smtp");
  });
});

describe("summariseCampaignFailures", () => {
  it("groups by reason, commonest first, keeping one real example", () => {
    const summary = summariseCampaignFailures([
      { errorMessage: SMTP_REJECTION },
      { errorMessage: "550 5.1.1 <other@example.com>: user unknown" },
      { errorMessage: SUPPRESSED_LOG_MESSAGE },
      { errorMessage: SMTP_REJECTION },
    ]);

    expect(summary.map((row) => [row.code, row.count])).toEqual([
      ["smtp", 3],
      ["suppressed", 1],
    ]);
    // The FIRST message of the group, not the last — a representative example
    // rather than "whichever failure happened to be read most recently".
    expect(summary[0].example).toBe(SMTP_REJECTION);
    expect(summary[0].label).toBe(CAMPAIGN_FAILURE_LABELS.smtp);
  });

  it("orders ties deterministically so a poll cannot reshuffle the list", () => {
    const input = [
      { errorMessage: SMTP_REJECTION },
      { errorMessage: SUPPRESSED_LOG_MESSAGE },
    ];
    const first = summariseCampaignFailures(input).map((row) => row.code);
    const second = summariseCampaignFailures([...input].reverse()).map(
      (row) => row.code,
    );

    expect(first).toEqual(second);
    expect(first).toEqual(["smtp", "suppressed"]);
  });

  it("clamps a long example rather than printing a log dump", () => {
    const [group] = summariseCampaignFailures([
      { errorMessage: `550 ${"x".repeat(400)}` },
    ]);
    expect(group.example).toHaveLength(201); // 200 chars + the ellipsis
    expect(group.example?.endsWith("…")).toBe(true);
  });

  it("is empty for a campaign that failed nobody", () => {
    expect(summariseCampaignFailures([])).toEqual([]);
  });
});

describe("hasCampaignResults", () => {
  it("opens only once a fan-out has produced a delivery record", () => {
    expect(hasCampaignResults("DRAFT")).toBe(false);
    expect(hasCampaignResults("SCHEDULED")).toBe(false);
    expect(hasCampaignResults("SENDING")).toBe(true);
    expect(hasCampaignResults("SENT")).toBe(true);
    // Stopped half way still mailed the first part of the list.
    expect(hasCampaignResults("CANCELLED")).toBe(true);
  });
});

const BASE_ROW: CampaignRecipientExportRow = {
  email: "jane@example.com",
  status: "SENT",
  createdAt: new Date("2026-08-13T09:00:00.000Z"),
  unsubscribedAt: null,
  error: null,
  deliveredAt: new Date("2026-08-13T09:01:00.000Z"),
  logError: null,
  logResponse: "250 OK",
};

describe("campaignRecipientCsvRow", () => {
  it("lays a delivered recipient out in header order with no failure text", () => {
    expect(campaignRecipientCsvRow(BASE_ROW)).toEqual([
      "jane@example.com",
      "SENT",
      "2026-08-13T09:00:00.000Z",
      "2026-08-13T09:01:00.000Z",
      "",
      "",
      "",
    ]);
    expect(CAMPAIGN_RECIPIENT_CSV_HEADER).toHaveLength(7);
  });

  it("carries both the plain-English reason and the server's own sentence", () => {
    const row = campaignRecipientCsvRow({
      ...BASE_ROW,
      status: "FAILED",
      deliveredAt: null,
      logError: SMTP_REJECTION,
    });

    expect(row[5]).toBe(CAMPAIGN_FAILURE_LABELS.smtp);
    // Unclamped: the whole point of the export is the detail the page summarises.
    expect(row[6]).toBe(SMTP_REJECTION);
  });

  it("prefers the linked log's message over the worker's copy", () => {
    const row = campaignRecipientCsvRow({
      ...BASE_ROW,
      status: "FAILED",
      error: "stale copy",
      logError: SMTP_REJECTION,
    });
    expect(row[6]).toBe(SMTP_REJECTION);
  });

  it("falls back to the recipient row when the log has been pruned", () => {
    const row = campaignRecipientCsvRow({
      ...BASE_ROW,
      status: "FAILED",
      error: SMTP_REJECTION,
      logError: null,
      logResponse: null,
    });
    expect(row[6]).toBe(SMTP_REJECTION);
  });

  it("explains a suppressed recipient instead of leaving the reason blank", () => {
    const row = campaignRecipientCsvRow({
      ...BASE_ROW,
      status: "SUPPRESSED",
      deliveredAt: null,
      logError: SUPPRESSED_LOG_MESSAGE,
    });
    expect(row[5]).toBe(CAMPAIGN_FAILURE_LABELS.suppressed);
  });

  it("records the opt-out this campaign caused", () => {
    const row = campaignRecipientCsvRow({
      ...BASE_ROW,
      unsubscribedAt: new Date("2026-08-14T12:00:00.000Z"),
    });
    expect(row[4]).toBe("2026-08-14T12:00:00.000Z");
  });
});

describe("campaign export naming and metering", () => {
  it("names the file from the id and the date, never the campaign name", () => {
    const name = campaignRecipientCsvFilename(
      "33333333-3333-3333-3333-333333333333",
      new Date("2026-08-13T22:00:00.000Z"),
    );
    // Tenant-authored text here would be header injection in
    // Content-Disposition, so the filename is built from constrained values.
    expect(name).toBe(
      "campaign-33333333-3333-3333-3333-333333333333-recipients-2026-08-13.csv",
    );
    expect(name).not.toMatch(/["\r\n]/);
  });

  it("namespaces the rate-limit key so an export shares no counter", () => {
    expect(campaignExportRateLimitKey("admin_1")).toBe(
      "campaign-export:admin_1",
    );
  });

  it("sets the runaway guard well above what one campaign can hold", () => {
    expect(CAMPAIGN_EXPORT_MAX_ROWS).toBeGreaterThan(CAMPAIGN_MAX_RECIPIENTS);
  });
});

describe("csvField", () => {
  it("quotes every field and doubles embedded quotes", () => {
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField("line\nbreak")).toBe('"line\nbreak"');
  });

  it("neutralises a spreadsheet formula", () => {
    // An address like this in a CSV opened in Excel would execute. The leading
    // apostrophe renders it as text and every CSV parser ignores it.
    expect(csvField("=1+1")).toBe("\"'=1+1\"");
    expect(csvField("@SUM(A1)")).toBe("\"'@SUM(A1)\"");
    expect(csvField("-2+3")).toBe("\"'-2+3\"");
  });

  it("writes an empty field for null and undefined", () => {
    expect(csvField(null)).toBe('""');
    expect(csvField(undefined)).toBe('""');
  });

  it("renders a Date as ISO rather than a locale string", () => {
    expect(csvField(new Date("2026-08-13T09:00:00.000Z"))).toBe(
      '"2026-08-13T09:00:00.000Z"',
    );
  });

  it("joins a row with commas", () => {
    expect(csvRow(["a", 1, null])).toBe('"a","1",""');
  });
});

/**
 * Drain a stream to the exact text that goes on the wire.
 *
 * NOT `Response.text()`: the fetch spec's "UTF-8 decode" strips a leading BOM,
 * so that reader cannot see the byte this export exists to send. `ignoreBOM`
 * keeps it — and the browser half is safe for the same reason, because
 * `campaign-export-download.ts` saves a `blob()`, which does no such decoding.
 */
async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const buffer = await new Response(stream).arrayBuffer();
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(buffer);
}

describe("streamCsv", () => {
  it("emits a BOM, the header, then every page in order", async () => {
    const pages: CsvPage<{ id: string }>[] = [
      { rows: [{ id: "a" }, { id: "b" }], nextCursor: "b" },
      { rows: [{ id: "c" }], nextCursor: null },
    ];
    let call = 0;
    const cursors: (string | null)[] = [];

    const text = await readAll(
      streamCsv({
        header: ["id"],
        fetchPage: async (cursor) => {
          cursors.push(cursor);
          return pages[call++];
        },
        toRow: (row) => [row.id],
        maxRows: 100,
      }),
    );

    expect(text).toBe('﻿"id"\n"a"\n"b"\n"c"\n');
    // Page one is asked for with no cursor; page two resumes from where it ended.
    expect(cursors).toEqual([null, "b"]);
  });

  it("holds one page at a time — a page is only fetched when it is pulled", async () => {
    let fetched = 0;
    const stream = streamCsv({
      header: ["id"],
      fetchPage: async () => {
        fetched += 1;
        return { rows: [{ id: "a" }], nextCursor: null };
      },
      toRow: (row: { id: string }) => [row.id],
      maxRows: 100,
    });

    // Constructing the stream must not have run a query. This is the whole
    // reason the export streams rather than building the file up front.
    expect(fetched).toBe(0);
    await readAll(stream);
    expect(fetched).toBe(1);
  });

  it("stops at the runaway guard instead of paging forever", async () => {
    const text = await readAll(
      streamCsv({
        header: ["id"],
        // A page function that never advances its cursor — the shape the guard
        // exists for.
        fetchPage: async () => ({ rows: [{ id: "x" }], nextCursor: "x" }),
        toRow: (row: { id: string }) => [row.id],
        maxRows: 3,
      }),
    );

    expect(text.split("\n").filter(Boolean)).toHaveLength(4); // header + 3
  });

  it("errors the stream when a page throws, rather than closing it short", async () => {
    const stream = streamCsv({
      header: ["id"],
      fetchPage: async () => {
        throw new Error("database went away");
      },
      toRow: () => [],
      maxRows: 100,
    });

    // A truncated file that looks complete is the one outcome worse than a
    // failed download.
    await expect(readAll(stream)).rejects.toThrow("database went away");
  });
});
