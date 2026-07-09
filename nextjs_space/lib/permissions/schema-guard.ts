import type { role_permissions } from "@prisma/client";
import type { PermissionKey } from "./permission-keys";

/**
 * Compile-time drift guard (PRD-301).
 *
 * Every PermissionKey MUST correspond to a boolean column on the
 * `role_permissions` Prisma model. If schema.prisma and PERMISSION_KEYS ever
 * diverge (a column renamed/removed, or a key added without a column), `tsc`
 * fails to resolve `role_permissions[K]` here — keeping the matrix honest.
 *
 * Type-only; erased at build, zero runtime cost.
 */
export type PermissionColumnGuard = {
  [K in PermissionKey]: role_permissions[K] extends boolean ? true : never;
};
