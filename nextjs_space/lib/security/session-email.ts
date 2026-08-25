import { currentUser } from "@clerk/nextjs/server";

/**
 * The signed-in caller's VERIFIED PRIMARY email address, or null.
 *
 * Kept apart from `./email-ownership` so that module stays pure and
 * dependency-free; this one owns the Clerk read.
 *
 * Two deliberate choices, both because the result is used as an ownership
 * claim over existing records:
 *  - Clerk-direct rather than `getCurrentUser()`: callers include PUBLIC
 *    routes that must keep working for anonymous visitors, and getCurrentUser
 *    additionally resolves tenants and can throw for not-yet-provisioned or
 *    multi-tenant accounts. All that is needed here is which address, if any,
 *    this caller has already authenticated as.
 *  - Primary AND verified: the positionally-first address is not necessarily
 *    the one the session is anchored to, and an unverified address proves
 *    nothing about who controls the mailbox. Clerk is expected to allow only
 *    verified addresses as primary — asserting it here means the guarantee
 *    does not depend on that remaining true.
 */
export async function getVerifiedSessionEmail(): Promise<string | null> {
  try {
    const sessionUser = await currentUser();
    if (!sessionUser) return null;
    const primary = sessionUser.emailAddresses?.find(
      (address) =>
        address.id === sessionUser.primaryEmailAddressId &&
        address.verification?.status === "verified",
    );
    return primary?.emailAddress ?? null;
  } catch {
    // Expired/invalid token — treat as anonymous, never as an error.
    return null;
  }
}
