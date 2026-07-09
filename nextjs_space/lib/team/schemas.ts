import { z } from "zod";
import { TEAM_ROLES, type TeamRole } from "@/lib/permissions/preset-roles";
import { PERMISSION_KEYS, type PermissionKey } from "@/lib/permissions/permission-keys";

/** One of the 5 preset team roles (infers the literal union, not just string). */
export const teamRoleSchema = z.enum([...TEAM_ROLES] as [TeamRole, ...TeamRole[]]);

/** POST /api/tenant-admin/team/invite */
export const inviteSchema = z.object({
  email: z.string().email().max(254),
  role: teamRoleSchema,
});
export type InviteInput = z.infer<typeof inviteSchema>;

/** POST /api/team/accept-invite */
export const acceptInviteSchema = z.object({
  token: z.string().min(10).max(300),
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

/** PUT /api/tenant-admin/team/roles/[role] — a partial patch of the matrix. */
const permissionsShape = Object.fromEntries(
  PERMISSION_KEYS.map((k) => [k, z.boolean()]),
) as Record<PermissionKey, z.ZodBoolean>;

export const roleUpdateSchema = z.object({
  permissions: z.object(permissionsShape).partial(),
});
export type RoleUpdateInput = z.infer<typeof roleUpdateSchema>;
