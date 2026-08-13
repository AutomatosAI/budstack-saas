/**
 * US-027 — the two signatures that make a tracking URL safe to publish.
 *
 * SERVER ONLY (node crypto). Nothing here reads a database.
 *
 * TWO THINGS ARE SIGNED, for two different reasons:
 *
 *   - the RECIPIENT, so a stranger cannot mark someone else's message as opened
 *     or clicked. The token is `<recipientId>.<hmac>`, which is what the AC
 *     means by a signed recipient token: no column to store, no lookup to
 *     reject garbage, and no address anywhere in the URL.
 *   - the DESTINATION of a wrapped link, because a redirect route that forwards
 *     to whatever the query says is an open redirect on the store's own domain.
 *     The signature is over `(tenantId, url)`, so a link minted for one store
 *     cannot be replayed through another's.
 *
 * The destination is signed at SAVE time and verified when the recipient
 * clicks, which can be weeks later. That means the key must be stable: rotating
 * it makes every already-sent link fail verification, and the route refuses
 * rather than forwarding unverified — the same trade `ENCRYPTION_KEY` already
 * carries for stored SMTP passwords.
 */

import { createHmac, timingSafeEqual } from "crypto";

/**
 * Domain separation. The tracking key is DERIVED from the application secret
 * rather than being it, so a signature here can never be confused with — or
 * used to attack — anything else signed with the same environment value.
 */
const TRACKING_KEY_INFO = "budstack-email-tracking-v1";

/** Purposes, so a recipient token can never be replayed as a link signature. */
const RECIPIENT_PURPOSE = "recipient";
const CLICK_PURPOSE = "click";

/** Separates the recipient id from its signature. Not in base64url or a uuid. */
const TOKEN_SEPARATOR = ".";

/**
 * Longest token this will even hash.
 *
 * Both halves are fixed-width in practice (a 36-character uuid and a 43-
 * character digest), so the cap only exists to stop an unauthenticated caller
 * making the server HMAC a megabyte of query string.
 */
const MAX_TOKEN_LENGTH = 300;

/** Longest destination a wrapped link may carry — well past any real URL. */
export const MAX_CLICK_TARGET_LENGTH = 2048;

/**
 * Longest `s=` this will buffer. A SHA-256 digest is 43 base64url characters;
 * the slack is for a future algorithm, not for a caller. Bounded for the same
 * reason as the two above — an unauthenticated query string must not decide how
 * much memory the server allocates.
 */
const MAX_SIGNATURE_LENGTH = 128;

/** Derived keys, cached by secret exactly as `lib/security/encryption.ts` does. */
const KEY_CACHE = new Map<string, Buffer>();

/**
 * The HMAC key.
 *
 * `EMAIL_TRACKING_SECRET` when a deployment wants tracking links on their own
 * key; `ENCRYPTION_KEY` otherwise, because that one is already required for the
 * app to function at all and a feature that silently stops working when an
 * optional variable is unset is worse than one that says so.
 *
 * Throws rather than degrading. A campaign saved with unsigned links would be
 * an open redirect, and one saved with tracking quietly stripped would tell an
 * operator their setting took effect when it did not.
 */
function trackingKey(): Buffer {
  const secret = process.env.EMAIL_TRACKING_SECRET || process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "EMAIL_TRACKING_SECRET (or ENCRYPTION_KEY) must be set to sign email tracking links",
    );
  }

  const cached = KEY_CACHE.get(secret);
  if (cached) return cached;

  const derived = createHmac("sha256", secret).update(TRACKING_KEY_INFO).digest();
  KEY_CACHE.set(secret, derived);
  return derived;
}

/** base64url so the value survives a query string and Handlebars untouched. */
function sign(purpose: string, value: string): string {
  return createHmac("sha256", trackingKey())
    .update(`${purpose}:${value}`)
    .digest("base64url");
}

/** Constant-time compare, length-guarded because timingSafeEqual throws. */
function signatureMatches(
  purpose: string,
  value: string,
  provided: string,
): boolean {
  const expected = Buffer.from(sign(purpose, value), "utf8");
  const actual = Buffer.from(provided, "utf8");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** The opaque credential a recipient's copy of a message carries. */
export function signRecipientToken(recipientId: string): string {
  return `${recipientId}${TOKEN_SEPARATOR}${sign(RECIPIENT_PURPOSE, recipientId)}`;
}

/**
 * The recipient this token names, or null if it names nobody.
 *
 * Null covers a forged signature, a truncated token, an empty `t=` (what a
 * message sent while tracking was on but compiled after it was turned off
 * carries) and a token from before a key rotation. Every caller treats all of
 * them the same way: serve the pixel, follow the link, record nothing.
 */
export function recipientIdFromToken(token: unknown): string | null {
  if (typeof token !== "string") return null;
  if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null;

  const separator = token.lastIndexOf(TOKEN_SEPARATOR);
  if (separator <= 0 || separator === token.length - 1) return null;

  const recipientId = token.slice(0, separator);
  const provided = token.slice(separator + 1);
  return signatureMatches(RECIPIENT_PURPOSE, recipientId, provided)
    ? recipientId
    : null;
}

/** Where a wrapped link goes, encoded so it survives a query string. */
export function encodeClickTarget(url: string): string {
  return Buffer.from(url, "utf8").toString("base64url");
}

/** Bound to the store, so one tenant's link cannot be replayed through another. */
export function signClickTarget(tenantId: string, url: string): string {
  return sign(CLICK_PURPOSE, `${tenantId}:${url}`);
}

/**
 * What this pair of parameters CLAIMS to point at — bounds and decoding only,
 * no key and no crypto.
 *
 * Split out so a public route can throw away a structurally impossible request
 * before it spends anything: resolving the tenant is a database round trip on a
 * connection pool every store on the platform shares, and an unauthenticated
 * caller must not be able to buy one with an empty query string. Answering here
 * proves nothing about authenticity — {@link verifiedClickTarget} is the only
 * function whose answer may be acted on.
 */
export function plausibleClickTarget(
  encoded: unknown,
  signature: unknown,
): string | null {
  if (typeof encoded !== "string" || typeof signature !== "string") return null;
  if (encoded.length === 0 || encoded.length > MAX_CLICK_TARGET_LENGTH) return null;
  if (signature.length === 0 || signature.length > MAX_SIGNATURE_LENGTH) return null;

  const url = Buffer.from(encoded, "base64url").toString("utf8");
  if (!url) return null;

  // Re-encoding rather than trusting the input: base64url decoding is lenient
  // about padding and stray characters, so two different `u=` values can decode
  // to the same URL. Only the canonical one is honoured, which keeps the signed
  // string and the transmitted string the same string.
  return encodeClickTarget(url) === encoded ? url : null;
}

/**
 * The destination a click URL is authorised to reach, or null.
 *
 * Re-does the structural checks itself rather than trusting a caller to have
 * run {@link plausibleClickTarget} first: this is the function whose answer
 * permits a redirect, so it may not depend on a step someone can forget. The
 * decoded result is then re-checked against the caller's own scheme rule — a
 * signature proves this platform minted the link, not that it is still one
 * worth following.
 */
export function verifiedClickTarget(
  tenantId: string,
  encoded: unknown,
  signature: unknown,
): string | null {
  const url = plausibleClickTarget(encoded, signature);
  if (url === null) return null;

  return signatureMatches(CLICK_PURPOSE, `${tenantId}:${url}`, signature as string)
    ? url
    : null;
}
