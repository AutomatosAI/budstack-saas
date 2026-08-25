/**
 * Ownership of an email address on PUBLIC endpoints.
 *
 * A signup-style endpoint cannot assume the caller owns the address they
 * typed — anyone can type anyone's. That is fine while the request only
 * CREATES records for that address, and dangerous the moment it MUTATES a
 * record that already existed: re-pointing an existing user's tenant binding
 * or their external client id lets an attacker attach a stranger's account to
 * a record the attacker controls, and that account then inherits whatever
 * status the record earns (approval, verification…).
 *
 * The ONLY proof of ownership over a pre-existing record is an authenticated
 * session for that address — hence this module exposes just the comparison.
 *
 * Explicitly NOT proof: "the identity provider accepted a brand-new account
 * for this address in this request". An earlier version of this module
 * offered that as a second route to ownership, which is wrong and was
 * exploitable: the provider only vouches that nobody held the *provider's*
 * identity, which says nothing about a local row that predates the request
 * (a legacy import, or a dropped delete-webhook leaving an orphaned row).
 * A caller who mints a fresh provider account for a stranger's address must
 * still not be able to mutate that stranger's existing row.
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
