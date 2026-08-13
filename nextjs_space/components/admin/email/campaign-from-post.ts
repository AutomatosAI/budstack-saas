/**
 * US-022 — the request behind "Send as newsletter".
 *
 * A sibling of `campaign-save.ts` and written to the same rule: the server's own
 * sentence is what the author is shown. This endpoint's refusals are specific —
 * an unpublished article, an article whose body cannot be turned into an email —
 * and each names the fix, which a generic "Failed to create" would discard.
 *
 * It creates a DRAFT. Nothing here sends, and the caller's only next move is to
 * open the campaign in the composer.
 */

const FROM_POST_URL = "/api/tenant-admin/campaigns/from-post";

const CREATE_FAILED_MESSAGE = "Failed to create the newsletter draft";

export interface CampaignFromPost {
  readonly id: string;
}

/** Create a draft campaign from a published post, or throw the reason it was refused. */
export async function createCampaignFromPost(
  postId: string,
): Promise<CampaignFromPost> {
  const res = await fetch(FROM_POST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId }),
  }).catch(() => {
    // A dropped connection rejects with a TypeError carrying the browser's
    // wording ("Failed to fetch"); the author gets ours instead.
    throw new Error(CREATE_FAILED_MESSAGE);
  });

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(payload?.error || CREATE_FAILED_MESSAGE);
  }
  if (!payload?.id) {
    throw new Error(CREATE_FAILED_MESSAGE);
  }
  return payload as CampaignFromPost;
}
