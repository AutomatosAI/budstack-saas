import { prisma } from "@/lib/db";
import type { PermissionSet } from "./permission-keys";
import { DEFAULT_PERMISSIONS, TEAM_ROLES } from "./preset-roles";

/**
 * Row-data for every preset role's DEFAULT permissions on a tenant. Each row
 * spreads the full PermissionSet (all boolean columns) plus tenantId + role.
 * id / createdAt / updatedAt are left to their Prisma defaults.
 */
export function defaultRolePermissionRows(tenantId: string) {
  return TEAM_ROLES.map((role) => ({
    tenantId,
    role,
    ...(DEFAULT_PERMISSIONS[role] as PermissionSet),
  }));
}

/**
 * Seed the 5 preset roles' default permissions for a tenant.
 *
 * Idempotent — `skipDuplicates` + the @@unique([tenantId, role]) constraint make
 * this safe to call at onboarding AND again during backfill. Best-effort by
 * design: if it fails, resolvePermissions() still returns DEFAULT_PERMISSIONS for
 * any role with no stored row, so authorization stays correct — admins simply
 * can't customise the matrix in the UI until the rows exist.
 *
 * @returns the number of rows actually inserted (0 if already seeded).
 */
export async function seedDefaultRolePermissions(tenantId: string): Promise<number> {
  const result = await prisma.role_permissions.createMany({
    data: defaultRolePermissionRows(tenantId),
    skipDuplicates: true,
  });
  return result.count;
}
