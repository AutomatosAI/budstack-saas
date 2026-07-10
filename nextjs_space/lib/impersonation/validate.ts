/**
 * PRD-302: pure session-validity rules, shared by the request-time resolver and
 * unit-tested without cookie/Prisma mocks. Fail-closed: anything short of a
 * fully valid, live, owned session is rejected.
 */

export interface SessionRowForValidation {
  superAdminClerkId: string;
  endedAt: Date | null;
  expiresAt: Date;
  tenant: {
    isActive: boolean;
    deletedAt: Date | null;
  } | null;
}

export type SessionRejection =
  | "ended"
  | "expired"
  | "not_owner"
  | "tenant_unavailable";

/**
 * Decide whether `row` grants `clerkUserId` a live impersonation right now.
 * Returns null when valid, otherwise the (first) reason it is rejected.
 *
 * - `not_owner`: the cookie belongs to a different Clerk user — NEVER adopt a
 *   session minted for someone else, even for another super-admin.
 * - `expired` sessions are rejected here read-only; the endedAt/timeout stamp
 *   is written by the lazy-expire sweep, not on the hot auth path.
 * - `tenant_unavailable`: deactivated or soft-deleted tenants end the ride
 *   immediately — support must not keep acting inside a disabled store.
 */
export function rejectSessionRow(
  row: SessionRowForValidation,
  clerkUserId: string,
  now: Date,
): SessionRejection | null {
  if (row.endedAt !== null) return "ended";
  if (row.superAdminClerkId !== clerkUserId) return "not_owner";
  if (row.expiresAt.getTime() <= now.getTime()) return "expired";
  if (!row.tenant || !row.tenant.isActive || row.tenant.deletedAt !== null) {
    return "tenant_unavailable";
  }
  return null;
}
