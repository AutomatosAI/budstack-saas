import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { resolveActiveImpersonation } from "@/lib/impersonation/resolve";

/**
 * PRD-302: impersonation-aware "which tenant does this admin PAGE render?".
 *
 * The single source of truth server components must use INSTEAD of the legacy
 * `currentUser()` + `users.findFirst({ where: { email } }).tenants` pattern —
 * that pattern resolves the LOGGED-IN user's own tenant, so an impersonating
 * super-admin (whose own home tenant is e.g. HealingBuds) would see their home
 * tenant's data while the banner correctly shows the impersonated tenant. That
 * mismatch is dangerous: the page shows tenant A while the mutation APIs (which
 * already go through the impersonation-aware getCurrentUser) act on tenant B.
 *
 * Resolution mirrors the tenant-admin layout exactly, so NON-impersonation
 * behaviour is byte-identical to the old per-page lookup:
 *   - SUPER_ADMIN with a live impersonation session → the TARGET tenant.
 *   - everyone else → their own tenant via their users row (unchanged).
 *
 * Returns null for anyone who is not an authenticated admin with a resolved
 * tenant; callers redirect (mirroring the pages' existing behaviour).
 */
export interface ActiveAdminTenant {
  clerkUserId: string;
  email: string | null;
  role: "TENANT_ADMIN" | "SUPER_ADMIN";
  tenantId: string;
  isImpersonating: boolean;
}

export async function getActiveAdminTenant(): Promise<ActiveAdminTenant | null> {
  const user = await currentUser();
  if (!user) return null;

  // publicMetadata.role is `unknown` (Clerk UserPublicMetadata) — the equality
  // guard doesn't narrow it, so cast to the concrete union after checking.
  const rawRole = user.publicMetadata.role;
  if (rawRole !== "TENANT_ADMIN" && rawRole !== "SUPER_ADMIN") return null;
  const role = rawRole as "TENANT_ADMIN" | "SUPER_ADMIN";

  const email = user.emailAddresses[0]?.emailAddress ?? null;

  // PRD-302: a super-admin with a live session renders the impersonated tenant —
  // same resolution as the banner, so page data and banner never diverge.
  if (role === "SUPER_ADMIN") {
    const impersonation = await resolveActiveImpersonation(user.id);
    if (impersonation) {
      return {
        clerkUserId: user.id,
        email,
        role,
        tenantId: impersonation.tenantId,
        isImpersonating: true,
      };
    }
  }

  // Normal path (unchanged): the admin's own tenant via their users row.
  if (!email) return null;
  const own = await prisma.users.findFirst({
    where: { email },
    select: { tenantId: true },
  });
  if (!own?.tenantId) return null;

  return {
    clerkUserId: user.id,
    email,
    role,
    tenantId: own.tenantId,
    isImpersonating: false,
  };
}
