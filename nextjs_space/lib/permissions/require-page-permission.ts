import { redirect } from "next/navigation";
import { getCurrentUserPermissions } from "./current-user-permissions";
import { can } from "./resolve";
import type { PermissionKey } from "./permission-keys";

/**
 * PRD-301 AC-6 — server-component route guard. Ensures the current user is a
 * tenant admin whose effective permissions grant `key`; otherwise redirects:
 *  - not authenticated / no tenant → /auth/login
 *  - authenticated but denied      → /tenant-admin (the always-visible overview)
 *
 * Returns the resolved { user, teamRole, permissions } so the page can reuse it.
 * Call at the very top of a protected tenant-admin page.
 */
export async function requirePagePermission(key: PermissionKey) {
  const ctx = await getCurrentUserPermissions();
  if (!ctx.user || !ctx.user.tenantId) redirect("/auth/login");
  if (!can(ctx.permissions, key)) redirect("/tenant-admin");
  return ctx;
}
