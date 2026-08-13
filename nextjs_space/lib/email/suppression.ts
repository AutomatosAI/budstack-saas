/**
 * Marketing suppression primitives (US-004).
 *
 * Pure logic + shared constants only — no prisma, no node builtins — so the
 * worker, the API routes and the storefront can all import from here without
 * dragging a database client along. The persistence side lives in
 * `lib/email/suppression-store.ts`.
 */

/**
 * What a queued email IS, for compliance purposes.
 *
 * `transactional` — the recipient asked for this specific message (order
 * confirmation, password reset, opt-in confirmation). Suppression and
 * unsubscribe do not apply: silently dropping someone's receipt because they
 * left a mailing list is a bug, not compliance.
 *
 * `marketing` — anything the recipient must be able to opt out of.
 */
export const EMAIL_CATEGORIES = ["transactional", "marketing"] as const;
export type EmailCategory = (typeof EMAIL_CATEGORIES)[number];

/**
 * Absence means transactional. Queue payloads are versioned by tolerance, not
 * by a version field: every job enqueued before US-004 carries no `category`,
 * and every one of those is a transactional send. Defaulting the other way
 * would strand the in-flight backlog behind a suppression check it was never
 * built for.
 */
export const DEFAULT_EMAIL_CATEGORY: EmailCategory = "transactional";

/** Reason an address landed on the suppression list. Matches the Prisma enum. */
export const SUPPRESSION_REASONS = [
  "unsubscribed",
  "bounced",
  "manual",
] as const;
export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];

/**
 * Machine-matchable prefix for the email_logs failure. The tenant email-log
 * page (US-007) and the campaign results page (US-026) both count on this
 * string, so widen the message after it rather than reword it.
 */
export const SUPPRESSED_LOG_REASON = "suppressed";
export const SUPPRESSED_LOG_MESSAGE = `${SUPPRESSED_LOG_REASON}: recipient has opted out of marketing email for this tenant`;

/** Narrow an untrusted job-payload value to a category, defaulting safely. */
export function resolveEmailCategory(value: unknown): EmailCategory {
  return EMAIL_CATEGORIES.includes(value as EmailCategory)
    ? (value as EmailCategory)
    : DEFAULT_EMAIL_CATEGORY;
}

/** True only for a marketing job — the one kind of send suppression gates. */
export function shouldCheckSuppression(category: unknown): boolean {
  return resolveEmailCategory(category) === "marketing";
}

/**
 * The address as it is stored and compared. `@@unique([tenantId, email])` is
 * case-sensitive in Postgres, so an unsubscribe recorded for `A@x.com` would
 * not match a campaign addressed to `a@x.com` unless both sides normalise
 * through here. Signup already lower-cases in its Zod schema; this is the same
 * rule for every other entry point.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Pull the bare address out of one recipient token.
 *
 * A suppression check that misses an address fails OPEN — it mails someone who
 * opted out — so this is deliberately generous about the shapes nodemailer
 * accepts: `a@x.com`, `Jane Doe <jane@x.com>`, and the stray-whitespace forms
 * in between. A fragment with no `@` in it is a display name, not a recipient,
 * and is dropped so it cannot pad the lookup.
 */
function extractAddress(part: string): string | null {
  const angled = part.match(/<([^<>]*)>/);
  const candidate = angled ? angled[1] : part;
  const token = candidate
    .trim()
    .split(/\s+/)
    .find((word) => word.includes("@"));
  return token ? normalizeEmail(token) : null;
}

/**
 * Every distinct address a queued job would actually deliver to.
 *
 * Handles every shape a `to` has taken in this queue: a single address, an
 * array (legacy multi-recipient jobs), and a comma-separated string (what
 * nodemailer accepts and what the email_logs `recipient` column stores).
 * Anything unparseable yields an empty list, which the caller treats as
 * "nothing to check" rather than guessing.
 */
export function recipientAddresses(to: unknown): string[] {
  const raw = Array.isArray(to) ? to : [to];
  const addresses = raw
    .filter((value): value is string => typeof value === "string")
    .flatMap((value) => value.split(","))
    .map(extractAddress)
    .filter((value): value is string => value !== null && value.length > 0);
  return Array.from(new Set(addresses));
}
