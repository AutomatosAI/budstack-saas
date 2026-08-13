/**
 * US-017 — what a campaign save writes to `campaigns.contentHtml` /
 * `contentJson`.
 *
 * It is the SAME US-011 pipeline the four template handlers run
 * (`resolveTemplateContent`: document -> shell -> juice -> sanitize LAST), with
 * two things fixed that a template leaves open:
 *
 *   - the category is always `marketing`, so the shell always emits the
 *     unsubscribe line rather than deciding from a free-text column;
 *   - the rendered output is CHECKED for that line before it is stored.
 *
 * The check is the point. A marketing email with no way out of the list is the
 * one defect on this surface that is illegal rather than merely wrong, and the
 * shell providing it "by default" is a property of code that can regress — a
 * mis-passed category, an allow-list change that drops the footer link, a
 * hand-crafted POST that skips the composer entirely. Asserting it here means
 * such a regression fails a save instead of reaching an inbox.
 *
 * SERVER ONLY: `resolveTemplateContent` pulls in react-email and juice. The
 * client-side halves of these rules live in `campaign-rules.ts`.
 */

import type { Prisma } from "@prisma/client";

import { ApiError } from "@/lib/api-error";
import { CAMPAIGN_EMAIL_CATEGORY } from "@/lib/email/campaign-rules";
import type { EmailContentJson } from "@/lib/email/email-content-json";
import { UNSUBSCRIBE_URL_SLOT } from "@/lib/email/email-shell";
import { resolveTemplateContent } from "@/lib/email/email-template-content";

/** Prisma `data` fragment for a campaign's content columns. */
export interface CampaignContentFields {
  readonly contentHtml: string;
  readonly contentJson: Prisma.InputJsonValue | typeof Prisma.DbNull;
}

export const MISSING_UNSUBSCRIBE_MESSAGE =
  "This campaign has no unsubscribe link, so it cannot be saved. Marketing email must always offer one — reload the page and try again, or contact support if it keeps happening.";

const CAMPAIGN_RENDER_FAILED_MESSAGE =
  "This campaign's content could not be rendered. Remove the last thing you added and try again.";

/**
 * An anchor whose target is the slot — not merely the slot appearing somewhere.
 *
 * The looser check would be satisfied by an author who typed
 * `{{unsubscribeUrl}}` into the body as text, which is not a way out of a
 * mailing list and would leave the tripwire silently passing for exactly the
 * document it exists to catch. Post-sanitize output is single-shape
 * (`sanitize-html` re-serialises every attribute with double quotes), so this
 * is a stable string rather than a guess about formatting.
 */
const UNSUBSCRIBE_HREF = `href="${UNSUBSCRIBE_URL_SLOT}"`;

/**
 * Reject rendered campaign HTML that carries no unsubscribe link.
 *
 * The slot rather than a real URL because no recipient is chosen yet: the
 * shell emits `{{unsubscribeUrl}}` at save time and the worker's existing
 * `Handlebars.compile(contentHtml)` fills it per address once fan-out mints a
 * token (US-019). So the string this looks for is exactly what a correct save
 * produces, and its absence means the footer never rendered.
 */
export function assertCampaignUnsubscribe(contentHtml: string): void {
  if (contentHtml.includes(UNSUBSCRIBE_HREF)) return;
  throw new ApiError(MISSING_UNSUBSCRIBE_MESSAGE, 400);
}

/**
 * Render a campaign document into the columns a create/update writes.
 *
 * The document is REQUIRED — campaigns are composed visually and have no raw
 * HTML mode, so there is no second representation for the two columns to
 * disagree about, and `contentHtml` is only ever derived here.
 */
export async function resolveCampaignContent(
  contentJson: EmailContentJson,
  tenantId: string,
): Promise<CampaignContentFields> {
  // `trackable` (US-027) is an OFFER, not a decision: the pipeline reads this
  // tenant's `emailTrackingEnabled` from the same row it renders the shell from
  // and does nothing unless it says yes. A campaign is the only content this
  // codebase offers it for — a transactional receipt has nothing to measure.
  const rendered = await resolveTemplateContent({
    contentJson,
    tenantId,
    category: CAMPAIGN_EMAIL_CATEGORY,
    trackable: true,
  });

  // Narrowed rather than cast. The document branch of `resolveTemplateContent`
  // always returns both fields, but `campaigns.contentHtml` is NOT NULL, so a
  // pipeline that ever stopped returning HTML should fail here with a sentence
  // an operator can read — not at the INSERT with a Prisma constraint error.
  if (typeof rendered.contentHtml !== "string" || rendered.contentJson === undefined) {
    throw new ApiError(CAMPAIGN_RENDER_FAILED_MESSAGE, 500);
  }

  assertCampaignUnsubscribe(rendered.contentHtml);

  return {
    contentHtml: rendered.contentHtml,
    contentJson: rendered.contentJson,
  };
}
