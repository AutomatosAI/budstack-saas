/**
 * US-027 — putting tracking INTO a campaign, at the one moment it can be put
 * there: while the document is still a document.
 *
 * SERVER ONLY (`tracking-token.ts` pulls in node crypto).
 *
 * LINKS ARE REWRITTEN IN THE JSON, NOT IN THE HTML, and that is the whole
 * safety argument. The rendered document also contains the shell's own
 * unsubscribe link (US-010) and, for a marketing send, that link is the one
 * thing that must never be redirected through anything: a recipient trying to
 * leave a mailing list cannot be made to depend on our redirect route still
 * resolving, and a tracked opt-out is exactly the surveillance nobody agreed
 * to. An HTML-level rewrite would have to recognise and skip it. Rewriting the
 * AUTHOR'S document instead means the footer is never in scope in the first
 * place — the same reason `email-content-json.ts` decides about images here.
 *
 * TWO SHAPES CARRY AN HREF: the `link` mark (StarterKit) and the `emailButton`
 * node (US-012's styled `<a>`). Both come from
 * `lib/email/editor-extensions.ts`; if a third ever appears there, it belongs
 * in `LINK_ATTRIBUTE_NODES` below or it silently goes untracked.
 *
 * NOT IDEMPOTENT, AND DOES NOT NEED TO BE: `contentJson` is stored as the
 * author wrote it (`email-template-content.ts` persists the input document, not
 * the normalised one), so every re-save re-wraps the ORIGINAL hrefs. Nothing in
 * this pipeline ever feeds its own output back in.
 */

import type {
  EmailContentJson,
  EmailDocNode,
  EmailJsonValue,
} from "@/lib/email/email-content-json";
import { EMAIL_BUTTON_NAME } from "@/lib/email/email-button-node";
import {
  CLICK_SIGNATURE_PARAM,
  CLICK_TARGET_PARAM,
  EMAIL_CLICK_TRACKING_PATH,
  EMAIL_OPEN_TRACKING_PATH,
  TRACKING_TOKEN_PARAM,
  TRACKING_TOKEN_SLOT,
  isTrackableLinkUrl,
} from "@/lib/email/email-tracking";
import {
  MAX_CLICK_TARGET_LENGTH,
  encodeClickTarget,
  signClickTarget,
} from "@/lib/email/tracking-token";

/** Everything a rewrite needs. Resolved once per render, never per link. */
export interface EmailTrackingContext {
  readonly tenantId: string;
  /** The store's own canonical origin — the host the links must resolve on. */
  readonly baseUrl: string;
}

/** The mark carrying an author's inline link. */
const LINK_MARK = "link";

/** Node types whose `href` attribute is an author's link. */
const LINK_ATTRIBUTE_NODES: readonly string[] = [EMAIL_BUTTON_NAME];

/**
 * The redirect that stands in front of one destination.
 *
 * `t=` is left as the Handlebars slot: the destination is the same for everyone
 * and can be signed now, but the recipient is not chosen until fan-out. Query
 * order puts the slot LAST so the two static parameters read as one unit in a
 * stored document an operator may end up eyeballing.
 */
function trackedLinkUrl(url: string, context: EmailTrackingContext): string {
  const target = encodeClickTarget(url);
  const signature = signClickTarget(context.tenantId, url);
  return (
    `${context.baseUrl}${EMAIL_CLICK_TRACKING_PATH}` +
    `?${CLICK_TARGET_PARAM}=${target}` +
    `&${CLICK_SIGNATURE_PARAM}=${signature}` +
    `&${TRACKING_TOKEN_PARAM}=${TRACKING_TOKEN_SLOT}`
  );
}

/**
 * The tracked form of one href, or the href unchanged.
 *
 * A destination past `MAX_CLICK_TARGET_LENGTH` is left ALONE rather than
 * refused: the route would not honour a link that long, and an author who
 * pastes a giant URL should get a working link with no statistic rather than a
 * save that fails for a reason they cannot act on.
 */
function trackedHref(
  href: EmailJsonValue | undefined,
  context: EmailTrackingContext,
): EmailJsonValue | undefined {
  if (!isTrackableLinkUrl(href)) return href;

  const url = href.trim();
  if (url.length > MAX_CLICK_TARGET_LENGTH) return href;

  return trackedLinkUrl(url, context);
}

/** Rebuild a node's marks with any link mark's href wrapped. Never mutates. */
function trackedMarks(
  marks: NonNullable<EmailDocNode["marks"]>,
  context: EmailTrackingContext,
): NonNullable<EmailDocNode["marks"]> {
  return marks.map((mark) => {
    if (mark.type !== LINK_MARK || !mark.attrs) return mark;
    const href = trackedHref(mark.attrs.href, context);
    return href === mark.attrs.href
      ? mark
      : { ...mark, attrs: { ...mark.attrs, href } as Record<string, EmailJsonValue> };
  });
}

/** Rebuild a node with its links and children wrapped. Never mutates. */
function trackedNode(
  node: EmailDocNode,
  context: EmailTrackingContext,
): EmailDocNode {
  const content = node.content?.map((child) => trackedNode(child, context));
  const marks = node.marks ? trackedMarks(node.marks, context) : undefined;

  const base: EmailDocNode = {
    ...node,
    ...(content ? { content } : {}),
    ...(marks ? { marks } : {}),
  };

  if (!node.type || !LINK_ATTRIBUTE_NODES.includes(node.type) || !base.attrs) {
    return base;
  }

  const href = trackedHref(base.attrs.href, context);
  return href === base.attrs.href
    ? base
    : { ...base, attrs: { ...base.attrs, href } as Record<string, EmailJsonValue> };
}

/**
 * Return a copy of the document with every author link pointed at the redirect.
 *
 * Runs AFTER `normaliseEmailContentJson`, so image sources are already absolute
 * and this only has to think about hrefs.
 */
export function applyTrackingLinks(
  doc: EmailContentJson,
  context: EmailTrackingContext,
): EmailContentJson {
  if (!doc.content) return doc;
  return {
    ...doc,
    content: doc.content.map((node) => trackedNode(node, context)),
  };
}

/**
 * The open pixel.
 *
 * Every attribute and declaration is one `lib/security/email-sanitize.ts`
 * already allows — `border="0"` as an attribute rather than a `border: 0`
 * declaration, because the allow-list's border regex wants a full
 * width/style/colour triple and would drop the shorthand. The sanitizer does
 * not move for this feature.
 *
 * Placed OUTSIDE the authored region so `EMAIL_BODY_CSS`'s `img { max-width:
 * 100%; height: auto }` rule never lands on it — a 1×1 with `height: auto` is a
 * pixel some clients will render at its intrinsic size and others will not.
 */
export function trackingPixelHtml(context: EmailTrackingContext): string {
  const src =
    `${context.baseUrl}${EMAIL_OPEN_TRACKING_PATH}` +
    `?${TRACKING_TOKEN_PARAM}=${TRACKING_TOKEN_SLOT}`;
  return `<img src="${src}" alt="" width="1" height="1" border="0" style="display:block;width:1px;height:1px" />`;
}
