import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Email Phase 2 US-018 — the compose screen's side of the audience count.
//
// Two things worth pinning without a DOM: which URL the picker asks for (the
// selected type, not the stored one, so the author can compare options), and
// which sentence they end up reading — including the rate limiter's, whose
// "try again in N seconds" a bare `error` key would throw away.

import {
  AUDIENCE_COUNT_FAILED_MESSAGE,
  COUNTING_AUDIENCE_MESSAGE,
  UNCHOSEN_AUDIENCE_MESSAGE,
  UNSAVED_AUDIENCE_MESSAGE,
  audienceSummaryLine,
  fetchAudienceCount,
  formatAudienceCount,
  isAbortError,
  settledCount,
} from "@/components/admin/email/campaign-audience-count";

const CAMPAIGN_ID = "22222222-2222-2222-2222-222222222222";

const fetchMock = vi.fn();

function reply(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAudienceCount", () => {
  it("asks the campaign's own endpoint for the selected type", async () => {
    fetchMock.mockResolvedValue(reply(200, { count: 42, suppressed: 3 }));

    await expect(fetchAudienceCount(CAMPAIGN_ID, "both")).resolves.toEqual({
      count: 42,
      suppressed: 3,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/tenant-admin/campaigns/${CAMPAIGN_ID}/audience-count?type=both`,
      expect.objectContaining({ signal: undefined }),
    );
  });

  it("passes the abort signal through so a stale count can be dropped", async () => {
    fetchMock.mockResolvedValue(reply(200, { count: 1, suppressed: 0 }));
    const controller = new AbortController();

    await fetchAudienceCount(CAMPAIGN_ID, "subscribers", controller.signal);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("type=subscribers"),
      { signal: controller.signal },
    );
  });

  it("re-throws an abort untouched, so the caller can ignore its own doing", async () => {
    const abort = Object.assign(new Error("The user aborted a request."), {
      name: "AbortError",
    });
    fetchMock.mockRejectedValue(abort);

    await expect(
      fetchAudienceCount(CAMPAIGN_ID, "both"),
    ).rejects.toBe(abort);
    expect(isAbortError(abort)).toBe(true);
  });

  it("keeps the rate limiter's 'try again in N seconds' rather than its bare error", async () => {
    fetchMock.mockResolvedValue(
      reply(429, {
        error: "Too many requests",
        message: "Rate limit exceeded. Please try again in 27 seconds.",
      }),
    );

    await expect(fetchAudienceCount(CAMPAIGN_ID, "both")).rejects.toThrow(
      "Rate limit exceeded. Please try again in 27 seconds.",
    );
  });

  it("surfaces the standard error envelope when there is no message key", async () => {
    fetchMock.mockResolvedValue(
      reply(404, { error: "Campaign not found or access denied" }),
    );

    await expect(fetchAudienceCount(CAMPAIGN_ID, "both")).rejects.toThrow(
      "Campaign not found or access denied",
    );
  });

  it("does not let the browser's wording reach the author on a dropped connection", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(fetchAudienceCount(CAMPAIGN_ID, "both")).rejects.toThrow(
      AUDIENCE_COUNT_FAILED_MESSAGE,
    );
  });

  it("refuses a 200 that carries no number rather than showing NaN recipients", async () => {
    fetchMock.mockResolvedValue(reply(200, { audience: { type: "both" } }));

    await expect(fetchAudienceCount(CAMPAIGN_ID, "both")).rejects.toThrow(
      AUDIENCE_COUNT_FAILED_MESSAGE,
    );
  });

  it("defaults a missing suppressed figure to zero", async () => {
    fetchMock.mockResolvedValue(reply(200, { count: 5 }));

    await expect(fetchAudienceCount(CAMPAIGN_ID, "customers")).resolves.toEqual({
      count: 5,
      suppressed: 0,
    });
  });
});

describe("formatAudienceCount", () => {
  it("names zero rather than printing '0 recipients'", () => {
    // The one result an author must not skim past on the way to pressing send.
    expect(formatAudienceCount({ count: 0, suppressed: 0 })).toBe(
      "Nobody — this audience reaches no one right now",
    );
  });

  it("says one recipient in the singular", () => {
    expect(formatAudienceCount({ count: 1, suppressed: 0 })).toBe("1 recipient");
  });

  it("names every suppression reason, not just the common one", () => {
    // The list also holds bounces and hand-blocked addresses; telling an author
    // those people unsubscribed would be specific and untrue.
    expect(formatAudienceCount({ count: 3, suppressed: 1 })).toContain(
      "unsubscribed, bounced or blocked",
    );
  });

  it("reports the excluded alongside the reachable", () => {
    expect(formatAudienceCount({ count: 142, suppressed: 8 })).toBe(
      "142 recipients · 8 excluded (unsubscribed, bounced or blocked)",
    );
  });

  it("keeps the exclusion visible even when nobody is left", () => {
    expect(formatAudienceCount({ count: 0, suppressed: 4 })).toBe(
      "Nobody — this audience reaches no one right now · 4 excluded (unsubscribed, bounced or blocked)",
    );
  });
});

describe("settledCount", () => {
  const SUBSCRIBERS_ANSWER = {
    type: "subscribers" as const,
    count: 84,
    suppressed: 2,
  };

  it("keeps a count that answers the audience on screen", () => {
    expect(settledCount(SUBSCRIBERS_ANSWER, "subscribers")).toBe(
      SUBSCRIBERS_ANSWER,
    );
  });

  it("discards the previous audience's figure the instant the radio moves", () => {
    // The picker re-renders on the tick, but the effect that fetches the new
    // figure runs after that paint — so without this the subscribers count
    // would sit beside a newly-ticked "Consented customers" for a frame.
    expect(settledCount(SUBSCRIBERS_ANSWER, "customers")).toBeNull();
  });

  it("has nothing to show before the first answer, or with nothing selected", () => {
    expect(settledCount(null, "both")).toBeNull();
    expect(settledCount(SUBSCRIBERS_ANSWER, null)).toBeNull();
  });
});

describe("audienceSummaryLine", () => {
  const COUNTED = { count: 9, suppressed: 0 };
  const BASE = {
    hasSelection: true,
    hasCampaign: true,
    isCounting: false,
    error: null,
    result: null,
  };

  it("asks for a choice before anything else", () => {
    expect(
      audienceSummaryLine({ ...BASE, hasSelection: false, result: COUNTED }),
    ).toEqual({ text: UNCHOSEN_AUDIENCE_MESSAGE, tone: "muted" });
  });

  it("explains that an unsaved draft has nothing to count against", () => {
    expect(audienceSummaryLine({ ...BASE, hasCampaign: false })).toEqual({
      text: UNSAVED_AUDIENCE_MESSAGE,
      tone: "muted",
    });
  });

  it("never shows the previous audience's figure while a new count is in flight", () => {
    // The whole reason the precedence puts counting above the result: the old
    // number beside a newly-ticked radio reads as an answer to the new question.
    expect(
      audienceSummaryLine({ ...BASE, isCounting: true, result: COUNTED }),
    ).toEqual({ text: COUNTING_AUDIENCE_MESSAGE, tone: "muted" });
  });

  it("reads as counting in the frame between the tick and the effect", () => {
    expect(audienceSummaryLine(BASE)).toEqual({
      text: COUNTING_AUDIENCE_MESSAGE,
      tone: "muted",
    });
  });

  it("surfaces a settled failure in the error tone", () => {
    expect(
      audienceSummaryLine({ ...BASE, error: "Campaign not found" }),
    ).toEqual({ text: "Campaign not found", tone: "error" });
  });

  it("shows the count once there is one", () => {
    expect(
      audienceSummaryLine({ ...BASE, result: { count: 142, suppressed: 8 } }),
    ).toEqual({
      text: "142 recipients · 8 excluded (unsubscribed, bounced or blocked)",
      tone: "count",
    });
  });
});
