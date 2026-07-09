import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-error";
import {
  TEAM_ROLES,
  DEFAULT_PERMISSIONS,
  isTeamRole,
  type TeamRole,
} from "@/lib/permissions/preset-roles";
import {
  PERMISSION_KEYS,
  type PermissionKey,
  type PermissionSet,
} from "@/lib/permissions/permission-keys";
import { permissionsFromRow } from "@/lib/permissions/resolve";

export interface RoleWithPermissions {
  role: TeamRole;
  editable: boolean; // admin is locked to all-true
  permissions: PermissionSet;
}

/**
 * All 5 preset roles with their CURRENT permissions (the tenant's stored matrix
 * row, or the seeded defaults when a row doesn't exist). Tenant-scoped read.
 */
export async function listRolesWithPermissions(): Promise<RoleWithPermissions[]> {
  const rows = await prisma.role_permissions.findMany();
  const byRole = new Map(rows.map((r) => [r.role, r]));
  return TEAM_ROLES.map((role) => {
    if (role === "admin") {
      return { role, editable: false, permissions: DEFAULT_PERMISSIONS.admin };
    }
    const row = byRole.get(role);
    return {
      role,
      editable: true,
      permissions: row ? permissionsFromRow(row) : DEFAULT_PERMISSIONS[role],
    };
  });
}

/**
 * Apply a partial permission patch to a preset role. The `admin` role is locked.
 * Merges the patch over the current (stored or default) set, then find-then-
 * create/update (avoids the compound-`@@unique` upsert trap). Tenant-scoped.
 */
export async function updateRolePermissions(
  tenantId: string,
  role: string,
  patch: Partial<Record<PermissionKey, boolean>>,
): Promise<void> {
  if (!isTeamRole(role)) throw new ApiError("Unknown role.", 404);
  if (role === "admin") {
    throw new ApiError("The Admin role always has full access and can't be edited.", 400);
  }

  const existing = await prisma.role_permissions.findFirst({ where: { role } });
  const base = existing ? permissionsFromRow(existing) : DEFAULT_PERMISSIONS[role];

  const next = {} as Record<PermissionKey, boolean>;
  for (const key of PERMISSION_KEYS) next[key] = patch[key] ?? base[key];

  if (existing) {
    await prisma.role_permissions.update({ where: { id: existing.id }, data: next });
  } else {
    await prisma.role_permissions.create({ data: { tenantId, role, ...next } });
  }
}
