/**
 * US-020 — what a marketing message must carry before it is allowed to leave.
 *
 * Two rules, both applied in the worker immediately before `sendMail`:
 *
 *   1. RFC 8058 headers. `List-Unsubscribe` (mailto + https) and
 *      `List-Unsubscribe-Post: List-Unsubscribe=One-Click` are what Gmail and
 *      Yahoo require of a bulk sender. The https target is US-004's unsubscribe
 *      route, which answers a bare POST with no session, no cookie and no CSRF
 *      token — because a mail provider sends that request, not a browser.
 *
 *   2. The footer that actually rendered. US-017 already proves the SAVED
 *      `contentHtml` carries `href="{{unsubscribeUrl}}"`; this proves the SENT
 *      html carries a real URL where that slot was. A slot the worker failed to
 *      fill ships marketing mail whose only way off the list points at nothing,
 *      which is worse than not sending at all — so it is not sent at all.
 *
 * Pure: no prisma, no queue, no nodemailer. The worker calls it, and the tests
 * call it without booting either.
 */

import Handlebars from "handlebars";

import {
  recipientAddresses,
  resolveEmailCategory,
} from "@/lib/email/suppression";

/**
 * Machine-matchable prefix, exactly like `SUPPRESSED_LOG_REASON`. The tenant
 * email-log page (US-007) and the campaign results page (US-026) read the
 * `email_logs.errorMessage` prefix to tell "we refused to send this" apart from
 * "the SMTP server rejected it", so widen the sentence after the colon rather
 * than reword the token before it.
 */
export const MISSING_FOOTER_REASON = "missing-footer";
export const MISSING_FOOTER_LOG_MESSAGE = `${MISSING_FOOTER_REASON}: marketing email rendered with no unsubscribe link, so it was not sent`;

/** RFC 8058 — the one legal value, and what makes the https target one-click. */
export const LIST_UNSUBSCRIBE_POST_VALUE = "List-Unsubscribe=One-Click";

/**
 * A single word so the `mailto:` needs no percent-encoding, and so an operator
 * can filter their inbox on it.
 */
const UNSUBSCRIBE_MAILTO_SUBJECT = "Unsubscribe";

/**
 * An absolute http(s) URL, restricted to RFC 3986's own character set.
 *
 * The URL is built from the tenant's `customDomain`/`subdomain`
 * (`getTenantBaseUrl`), and `customDomain` is stored behind nothing stronger
 * than `z.string().max(255)` — so this is tenant-controlled data on its way
 * into a mail header, and the check has to hold on its own.
 *
 * DELIBERATELY AN ALLOW-LIST. A deny-list of "whitespace, angle brackets and
 * quotes" would make the safety property depend on which code points JS's `\s`
 * happens to cover — U+0085 is not one of them — rather than on what a URL is
 * allowed to contain. Everything outside this set is rejected, so no line
 * terminator, present or future, needs to be enumerated.
 *
 * A domain that fails this is one no request could reach either: tenant
 * resolution matches `customDomain` against the HTTP Host header, which is
 * ASCII by the time Node sees it. Refusing the send is therefore right — the
 * link in that footer would resolve to nothing.
 */
const HEADER_SAFE_URL = /^https?:\/\/[A-Za-z0-9\-._~:\/?#\[\]@!$&'()*+,;=%]+$/;

/**
 * One ordinary mailbox, and nothing that means something inside a `mailto:`.
 *
 * `?`, `&`, `=`, `#`, `%` and a second `@` are all excluded on purpose: the
 * address is spliced into `mailto:${address}?subject=…`, so an address of
 * `orders@shop.example?cc=someone@elsewhere` would append a query field to a
 * URI every recipient's mail client is invited to act on. That address reaches
 * here from `tenants.settings.smtp.fromEmail`, which any tenant admin can set
 * and which is stored with no format validation — see the note on
 * {@link unsubscribeMailto} for why failing this is harmless.
 */
const HEADER_SAFE_ADDRESS = /^[A-Za-z0-9._+\-]+@[A-Za-z0-9.\-]+$/;

/**
 * The unsubscribe link this job was rendered with, if it is fit for a header.
 *
 * Read from the job's `variables` bag rather than from a new payload field: it
 * is already there for every campaign fan-out (`campaignRecipientVariables`),
 * it is the exact string the worker's Handlebars step substituted into the
 * body, and a payload enqueued before this story simply has no `unsubscribeUrl`
 * — which resolves to null here and, for a marketing job, to a refusal.
 */
export function headerSafeUnsubscribeUrl(variables: unknown): string | null {
  if (typeof variables !== "object" || variables === null) return null;
  const { unsubscribeUrl } = variables as Record<string, unknown>;
  if (typeof unsubscribeUrl !== "string") return null;

  const candidate = unsubscribeUrl.trim();
  return HEADER_SAFE_URL.test(candidate) ? candidate : null;
}

/**
 * Does the rendered body really contain that link?
 *
 * THE ESCAPING IS THE WHOLE DIFFICULTY. The stored HTML carries
 * `href="{{unsubscribeUrl}}"` and the worker fills it with `{{ }}`, which runs
 * Handlebars' HTML escaper — and that escaper maps `=` to `&#x3D;`. So a
 * genuine campaign's rendered body contains `...?token&#x3D;abc`, and a naive
 * `html.includes(url)` would be false for EVERY correct marketing send: the
 * guard would refuse the messages it exists to protect. Both forms are
 * therefore accepted, and the escaped one is computed with Handlebars' own
 * escaper so the two cannot drift apart.
 *
 * A null url is "there was no usable link to look for", which fails for the
 * same reason and gets the same refusal — to the recipient the two are the
 * same message with no way off the list.
 *
 * This is a substring match, so it proves the URL is PRESENT, not that it is
 * the target of an anchor. The clickable half is proved earlier and elsewhere:
 * `assertCampaignUnsubscribe` (lib/email/campaign-content.ts) refuses to store
 * a campaign whose HTML lacks `href="{{unsubscribeUrl}}"`, and the fill between
 * there and here is a literal Handlebars substitution that restructures
 * nothing. The two compose — but the coupling is real, so loosening that
 * save-time assertion means tightening this one.
 */
export function htmlCarriesUnsubscribeUrl(
  html: string,
  url: string | null,
): boolean {
  if (!url) return false;
  // The raw form covers a body rendered outside Handlebars, or through a
  // `{{{triple-stash}}}`; the escaped form is the normal path.
  return html.includes(url) || html.includes(Handlebars.escapeExpression(url));
}

export interface MarketingComplianceInput {
  /** The job's `category`. Absent means transactional — the tolerance rule. */
  readonly category: unknown;
  /** The job's `variables` bag, where `unsubscribeUrl` lives. */
  readonly variables: unknown;
  /** The body as it will actually be sent, after every render step. */
  readonly html: string;
}

export interface MarketingCompliance {
  /** Refuse the send — marketing with no usable unsubscribe link in the body. */
  readonly refuse: boolean;
  /** https target for `List-Unsubscribe`; null for every non-marketing job. */
  readonly unsubscribeUrl: string | null;
}

/** What a non-marketing job gets: no guard, no headers, no change at all. */
const UNAFFECTED: MarketingCompliance = { refuse: false, unsubscribeUrl: null };

/**
 * The whole US-020 decision for one job, in one place the worker can call and a
 * test can assert without booting BullMQ.
 *
 * TRANSACTIONAL IS UNTOUCHED, and that is the first thing this says. An order
 * confirmation with no unsubscribe link is correct, not a compliance failure —
 * offering to opt out of your own receipt is the bug. Every payload enqueued
 * before this story carries no `category` at all and lands in the same branch.
 */
export function resolveMarketingCompliance(
  input: MarketingComplianceInput,
): MarketingCompliance {
  if (resolveEmailCategory(input.category) !== "marketing") return UNAFFECTED;

  // `html` is typed but arrives from an untyped queue payload. A body that is
  // not a string is a marketing email whose footer cannot be proved, so it is
  // refused — the alternative is a TypeError thrown outside the worker's
  // try/catch, which leaves the log row QUEUED through three silent retries
  // instead of the clean, retryless FAILED this story exists to produce.
  if (typeof input.html !== "string") {
    return { refuse: true, unsubscribeUrl: null };
  }

  const unsubscribeUrl = headerSafeUnsubscribeUrl(input.variables);
  if (!htmlCarriesUnsubscribeUrl(input.html, unsubscribeUrl)) {
    return { refuse: true, unsubscribeUrl: null };
  }

  return { refuse: false, unsubscribeUrl };
}

/**
 * The `mailto:` half of `List-Unsubscribe`, derived from the message's own From.
 *
 * That address is the only mailbox on this path known to exist. Inventing an
 * `unsubscribe@` for the tenant's domain would put an address that bounces into
 * a compliance header, which is worse than the header carrying only the https
 * target — so an unparseable From yields null and the header ships https-only.
 *
 * That fallback is why the address check can afford to be strict: rejecting an
 * exotic-but-legal mailbox costs the header its mailto half, while the https
 * one-click target — the half Gmail and Yahoo actually require — is unchanged.
 * Nothing is refused and nobody loses their way off the list.
 *
 * `recipientAddresses` is reused rather than re-implemented: it already handles
 * every shape this From takes (`a@x.com`, `"Store" <a@x.com>`, a comma-joined
 * pair). It lower-cases, which is a deliberate accepted cost — SMTP local-parts
 * are formally case-sensitive but universally delivered case-insensitively, and
 * one tested parser beats a second regex that drifts from it.
 */
export function unsubscribeMailto(fromAddress: unknown): string | null {
  if (typeof fromAddress !== "string") return null;

  const [address] = recipientAddresses(fromAddress);
  if (!address || !HEADER_SAFE_ADDRESS.test(address)) return null;

  return `mailto:${address}?subject=${UNSUBSCRIBE_MAILTO_SUBJECT}`;
}

/**
 * The headers a marketing send carries, ready for nodemailer's `headers` option.
 *
 * mailto first, then https, per RFC 2369's order-of-preference and the PRD's
 * literal spelling. One-click parsers pick the https URI out by scheme rather
 * than by position, so the order costs nothing and matches what older clients
 * expect to find first.
 */
export function listUnsubscribeHeaders(
  unsubscribeUrl: string,
  fromAddress: unknown,
): Record<string, string> {
  const mailto = unsubscribeMailto(fromAddress);
  const targets = mailto
    ? [`<${mailto}>`, `<${unsubscribeUrl}>`]
    : [`<${unsubscribeUrl}>`];

  return {
    "List-Unsubscribe": targets.join(", "),
    "List-Unsubscribe-Post": LIST_UNSUBSCRIBE_POST_VALUE,
  };
}
