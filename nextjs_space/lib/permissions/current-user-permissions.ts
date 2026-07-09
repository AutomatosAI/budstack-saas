import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helper";
import { runWithTenantContextAsync } from "@/lib/tenant/tenant-context";
import { ALL_FALSE, type PermissionSet } from "./permission-keys";
import { isTeamRole } from "./preset-roles";
import { resolvePermissions } from "./resolve";

export interface ResolvedUserPermissions {
  teamRole: string | null;
  permissions: PermissionSet;
}

/**
 * Resolve the effective permission set for a known auth subject within a tenant.
 *
 * Loads the user's `teamRole` and — for non-admin roles — the tenant's stored
 * matrix row, then applies the pure resolver. SUPER_ADMIN short-circuits with no
 * DB read. Binds tenant context so the scoped `users`/`role_permissions` reads are
 * tenant-safe even when called from a server component (no ambient context).
 */
export async function resolveUserPermissions(
  user: { role: string; email?: string | null },
  tenantId: string,
): Promise<ResolvedUserPermissions> {
  if (user.role === "SUPER_ADMIN") {
    return { teamRole: "admin", permissions: resolvePermissions({ role: "SUPER_ADMIN" }) };
  }

  return runWithTenantContextAsync(tenantId, async () => {
    const dbUser = user.email
      ? await prisma.users.findFirst({
          where: { email: user.email },
          select: { teamRole: true },
        })
      : null;

    const teamRole = dbUser?.teamRole ?? null;

    // Only load the stored matrix for a customised, non-admin preset role.
    const storedRow =
      teamRole && teamRole !== "admin" && isTeamRole(teamRole)
        ? await prisma.role_permissions.findFirst({ where: { role: teamRole } })
        : null;

    return {
      teamRole,
      permissions: resolvePermissions({ role: user.role, teamRole }, storedRow),
    };
  });
}

/**
 * Page/layout helper: resolve the CURRENT user plus their effective permissions.
 * Returns ALL_FALSE for anyone who is not an authenticated tenant admin, so UI
 * gating is fail-closed.
 */
export async function getCurrentUserPermissions(): Promise<
  ResolvedUserPermissions & { user: Awaited<ReturnType<typeof getCurrentUser>> }
> {
  const user = await getCurrentUser();
  if (
    !user ||
    !user.tenantId ||
    (user.role !== "TENANT_ADMIN" && user.role !== "SUPER_ADMIN")
  ) {
    return { user, teamRole: null, permissions: ALL_FALSE };
  }
  const resolved = await resolveUserPermissions(user, user.tenantId);
  return { user, ...resolved };
}
