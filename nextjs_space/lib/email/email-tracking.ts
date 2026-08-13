/**
 * US-027 — open/click tracking, and the switch that is OFF until a store asks
 * for it.
 *
 * Tracking is the one thing in this PRD done FOR the store rather than for the
 * recipient, so nothing here is on by default and no layer trusts a decision
 * another layer made earlier:
 *
 *   - the render path (US-011) decides whether a campaign is SAVED with a pixel
 *     and wrapped links in it;
 *   - the fan-out (US-019) decides whether a per-recipient token is minted;
 *   - the two public routes decide whether anything is RECORDED.
 *
 * Three independent reads of the same setting, because they happen at three
 * different times. A message already sitting in an inbox cannot be un-sent, but
 * the moment the setting goes off its artifacts stop counting: the pixel still
 * returns a pixel and the wrapped link still reaches where it always did, and
 * neither writes a row.
 *
 * PURE — constants, a regex and a settings read. The signing lives in
 * `tracking-token.ts` (node crypto) and the rewriting in
 * `email-tracking-render.ts`; both are server-only and neither belongs here.
 */

import { parseTenantSettings } from "@/lib/tenant/tenant-settings";

/** `tenants.settings` key. Absent or false means no tracking — the default. */
export const EMAIL_TRACKING_SETTING = "emailTrackingEnabled";

/** The 1×1 pixel a marketing send fetches when it is opened. */
export const EMAIL_OPEN_TRACKING_PATH = "/api/storefront/email/open";

/** The redirect an author's link is rewritten through. */
export const EMAIL_CLICK_TRACKING_PATH = "/api/storefront/email/click";

/** Query parameter carrying the signed recipient token. Never an address. */
export const TRACKING_TOKEN_PARAM = "t";
/** Query parameter carrying the base64url destination of a wrapped link. */
export const CLICK_TARGET_PARAM = "u";
/** Query parameter carrying the destination's signature. */
export const CLICK_SIGNATURE_PARAM = "s";

/**
 * The variable the render path leaves a Handlebars slot for, and the fan-out
 * fills per address.
 *
 * The same device as `{{unsubscribeUrl}}` (US-010) and for the same reason: the
 * campaign body is rendered ONCE at save time and compiled per recipient by the
 * worker, so the only per-person value that can appear in it is one that
 * survives the queue as a literal. The token is base64url plus a `.`, none of
 * which Handlebars' escaper touches — unlike a whole URL, whose `=` comes out
 * as `&#x3D;` (the US-020 lesson).
 */
export const TRACKING_TOKEN_VARIABLE = "emailTrackingToken";

/** What the stored HTML carries where the token will go. */
export const TRACKING_TOKEN_SLOT = `{{${TRACKING_TOKEN_VARIABLE}}}`;

/**
 * Links this pipeline will wrap.
 *
 * `mailto:` and `tel:` are deliberately absent — a redirect through an HTTP
 * route cannot deliver either, so wrapping one would break the link to buy a
 * statistic. A relative URL is absent because an inbox has no origin to resolve
 * it against (`lib/email/email-asset-url.ts`), so it was already broken and
 * wrapping it would hide that.
 */
const TRACKABLE_URL = /^https?:\/\//i;

/** True when this href is one a redirect can honestly stand in front of. */
export function isTrackableLinkUrl(url: unknown): url is string {
  return typeof url === "string" && TRACKABLE_URL.test(url.trim());
}

/**
 * Whether this tenant has asked for open/click tracking.
 *
 * Reads through the shared parse-on-read helper (PRD-208) rather than casting,
 * and answers false for a settings blob that will not parse: a store whose
 * configuration cannot be read has not consented to anything, and defaulting a
 * privacy-relevant switch ON because the JSON was malformed is the one wrong
 * answer here.
 */
export function isEmailTrackingEnabled(
  settings: unknown,
  tenantId?: string,
): boolean {
  return parseTenantSettings(settings, { tenantId })[EMAIL_TRACKING_SETTING] === true;
}
