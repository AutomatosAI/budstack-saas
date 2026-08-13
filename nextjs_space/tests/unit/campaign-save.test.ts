import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Email Phase 2 US-017 — the request both campaign screens make.
//
// The interesting part is not the fetch, it is which sentence the author ends
// up reading. This endpoint has two rejections worth surfacing verbatim — a
// campaign with no unsubscribe link, and one that has already left (409) — and
// a client that substituted "Failed to save" for either would turn an
// actionable refusal into a mystery.

import { saveCampaign } from "@/components/admin/email/campaign-save";
import { MISSING_UNSUBSCRIBE_MESSAGE } from "@/lib/email/campaign-content";
import { CAMPAIGN_LOCKED_MESSAGE } from "@/lib/email/campaign-rules";

const DRAFT = {
  name: "October newsletter",
  subject: "What's new",
  contentJson: { type: "doc" as const, content: [{ type: "paragraph" }] },
};

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

describe("saveCampaign", () => {
  it("POSTs to the collection when there is no id yet", async () => {
    fetchMock.mockResolvedValue(reply(200, { id: CAMPAIGN_ID }));

    await expect(saveCampaign(DRAFT)).resolves.toEqual({ id: CAMPAIGN_ID });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tenant-admin/campaigns",
      expect.objectContaining({ method: "POST", body: JSON.stringify(DRAFT) }),
    );
  });

  it("PUTs to the row when editing an existing campaign", async () => {
    fetchMock.mockResolvedValue(reply(200, { id: CAMPAIGN_ID }));

    await saveCampaign(DRAFT, CAMPAIGN_ID);

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/tenant-admin/campaigns/${CAMPAIGN_ID}`,
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("surfaces the missing-unsubscribe refusal word for word", async () => {
    fetchMock.mockResolvedValue(reply(400, { error: MISSING_UNSUBSCRIBE_MESSAGE }));

    await expect(saveCampaign(DRAFT)).rejects.toThrow(
      MISSING_UNSUBSCRIBE_MESSAGE,
    );
  });

  it("surfaces the 409 telling the author the campaign has already left", async () => {
    fetchMock.mockResolvedValue(reply(409, { error: CAMPAIGN_LOCKED_MESSAGE }));

    await expect(saveCampaign(DRAFT, CAMPAIGN_ID)).rejects.toThrow(
      CAMPAIGN_LOCKED_MESSAGE,
    );
  });

  it("falls back to its own message when the response carries no error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    });

    await expect(saveCampaign(DRAFT)).rejects.toThrow("Failed to save campaign");
  });

  it("does not let the browser's wording reach the author on a dropped connection", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(saveCampaign(DRAFT)).rejects.toThrow("Failed to save campaign");
  });

  it("treats a 200 with no id as a failure rather than navigating nowhere", async () => {
    // The create screen routes to `/campaigns/${id}` on success; an id-less
    // success would push the author at `/campaigns/undefined`.
    fetchMock.mockResolvedValue(reply(200, { ok: true }));

    await expect(saveCampaign(DRAFT)).rejects.toThrow("Failed to save campaign");
  });
});
