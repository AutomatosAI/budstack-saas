/**
 * Ownership rule for PUBLIC endpoints that accept an email address.
 *
 * A signup-style endpoint cannot assume the caller owns the address they
 * typed — anyone can type anyone's. That is fine while the request only
 * CREATES things for a brand-new address, and dangerous the moment it
 * MUTATES an account that already exists: re-pointing an existing user's
 * tenant binding or their external client id lets an attacker attach a
 * victim's account to a record the attacker controls, and the victim then
 * inherits whatever status that record earns (approval, verification…).
 *
 * Ownership is provable in exactly two ways here:
 *   1. the identity provider accepted a BRAND-NEW account for the address in
 *      this same request (nobody else held it), or
 *   2. the caller is signed in AS that address.
 *
 * Anything else must be refused and told to sign in — never silently
 * "reuse the existing account".
 */

/** Case/whitespace-insensitive address comparison. Null/empty never matches. */
export function emailsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = a?.trim().toLowerCase();
  const right = b?.trim().toLowerCase();
  if (!left || !right) return false;
  return left === right;
}

export interface AccountClaimInput {
  /** The identity provider created a NEW account for this email in this request. */
  accountJustCreated: boolean;
  /** The authenticated caller's email, or null for an anonymous request. */
  sessionEmail: string | null | undefined;
  /** The email supplied in the request body. */
  submittedEmail: string;
}

/**
 * May this caller act on (and mutate) the account behind `submittedEmail`?
 *
 * Returns false for the anonymous-caller-hits-an-existing-address case, which
 * is the one the caller must refuse.
 */
export function canClaimAccount({
  accountJustCreated,
  sessionEmail,
  submittedEmail,
}: AccountClaimInput): boolean {
  if (accountJustCreated) return true;
  return emailsMatch(sessionEmail, submittedEmail);
}
