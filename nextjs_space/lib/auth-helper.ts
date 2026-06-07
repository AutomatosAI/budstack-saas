import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import {
  resolveTenant,
  isAmbiguousTenantResolution,
} from "@/lib/tenant/tenant-resolver";
import { ApiError } from "@/lib/api-error";

/**
 * A valid Clerk session arrived before the `user.created` webhook provisioned
 * the app-side `users` row (the provisioning race — PRD-203 AC-2a). Surfaced as
 * 409 (retryable) so the client retries, rather than a silent `null` the wrappers
 * would turn into a misleading 401/403.
 */
export class UserNotProvisionedError extends ApiError {
  constructor() {
    super("Your account is still being set up. Please retry in a moment.", 409);
    this.name = "UserNotProvisionedError";
  }
}

/**
 * The caller's email maps to more than one ACTIVE tenant (PRD-203 AC-2). The
 * resolver refuses to guess; we refuse to authenticate against an arbitrary
 * tenant. 403 with a generic message — the email and candidate count stay in the
 * resolver's audit log, never the response body.
 */
export class AmbiguousTenantError extends ApiError {
  constructor() {
    super("Your account could not be matched to a single organization.", 403);
    this.name = "AmbiguousTenantError";
  }
}

export async function getCurrentUser() {
  let user;
  try {
    user = await currentUser();
  } catch (error) {
    // Clerk throws when the session token is expired/invalid/malformed.
    // Return null so callers get a clean 401 instead of a caught 500.
    console.warn("[auth-helper] currentUser() threw — likely expired token:", error);
    return null;
  }

  if (!user) {
    return null;
  }

  // Extract role and the Clerk org id (stored, confusingly, in publicMetadata.tenantId).
  const role = (user.publicMetadata.role as string) || "user";
  const clerkOrgId = (user.publicMetadata.tenantId as string) || null;
  const email = user.emailAddresses[0]?.emailAddress;

  // ONE canonical resolver (PRD-205): prefers the Clerk-org match, enforces
  // isActive, and never silently picks among multiple tenants for an email.
  const resolved = await resolveTenant({ kind: "clerk", clerkOrgId, email });

  // Ambiguous email -> hard 403. The resolver already emitted the audit event;
  // we refuse to authenticate against an arbitrary tenant.
  if (isAmbiguousTenantResolution(resolved)) {
    throw new AmbiguousTenantError();
  }

  const tenantId = resolved?.tenantId ?? null;

  // The user.created race: a valid Clerk session can arrive before the webhook
  // has written the users row (keyed by email — see app/api/webhooks/clerk).
  // Only check when no tenant resolved (a resolved tenant already implies a row)
  // and only when there is an email to key on. No row -> 409 retryable, never a
  // silent null that the wrappers would misreport as 401/403.
  if (tenantId == null && email) {
    const provisioned = await prisma.users.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!provisioned) {
      console.warn(
        "auth.user_not_provisioned",
        JSON.stringify({ event: "auth.user_not_provisioned", clerkUserId: user.id }),
      );
      throw new UserNotProvisionedError();
    }
  }

  return {
    id: user.id,
    email,
    name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
    image: user.imageUrl,
    role,
    tenantId, // database tenant UUID (or null), not the Clerk org id
    clerkOrgId, // Clerk org id kept available if needed
  };
}
