import {
  ALL_FALSE,
  ALL_TRUE,
  buildPermissionSet,
  PERMISSION_KEYS,
  type PermissionKey,
  type PermissionSet,
} from "./permission-keys";
import { DEFAULT_PERMISSIONS, isTeamRole } from "./preset-roles";

/** The identity inputs needed to resolve permissions (from the `users` row). */
export interface PermissionSubject {
  /** users.role — platform role (PATIENT | TENANT_ADMIN | SUPER_ADMIN). */
  role: string;
  /** users.teamRole — team permission-set selector; null for legacy admins. */
  teamRole?: string | null;
}

/**
 * A stored permission matrix row (the boolean columns from `role_permissions`).
 * Extra fields (id, tenantId, timestamps) are ignored. `null` => not seeded.
 */
export type RolePermissionRow = Partial<Record<PermissionKey, boolean>> | null | undefined;

/** Extract a full PermissionSet from a stored role_permissions row. */
export function permissionsFromRow(row: RolePermissionRow): PermissionSet {
  if (!row) return ALL_FALSE;
  return buildPermissionSet(PERMISSION_KEYS.filter((key) => row[key] === true));
}

/**
 * Pure permission resolution — NO I/O. The caller supplies the subject and,
 * for non-admin team roles, the tenant's stored matrix row (if any).
 *
 * Precedence (fail-closed):
 *  1. SUPER_ADMIN            → all permissions (platform staff).
 *  2. non-TENANT_ADMIN role  → no permissions (the coarse role gate blocks them).
 *  3. teamRole 'admin'/null  → all permissions ('admin' preset + legacy pre-teams users).
 *  4. unknown teamRole       → no permissions.
 *  5. known preset teamRole  → stored row if provided, else the seeded defaults.
 */
export function resolvePermissions(
  subject: PermissionSubject,
  storedRow?: RolePermissionRow,
): PermissionSet {
  if (subject.role === "SUPER_ADMIN") return ALL_TRUE;
  if (subject.role !== "TENANT_ADMIN") return ALL_FALSE;

  const teamRole = subject.teamRole ?? "admin"; // legacy null => full-access admin
  if (teamRole === "admin") return ALL_TRUE;
  if (!isTeamRole(teamRole)) return ALL_FALSE; // fail closed on unknown role

  return storedRow ? permissionsFromRow(storedRow) : DEFAULT_PERMISSIONS[teamRole];
}

/** Check a single permission against a resolved set. */
export function can(permissions: PermissionSet, key: PermissionKey): boolean {
  return permissions[key] === true;
}
