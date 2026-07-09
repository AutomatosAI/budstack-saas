import { redirect } from "next/navigation";
import { getCurrentUserPermissions } from "@/lib/permissions/current-user-permissions";
import { runWithTenantContextAsync } from "@/lib/tenant/tenant-context";
import { can } from "@/lib/permissions/resolve";
import { listRolesWithPermissions } from "@/lib/team/roles";
import { RolesClient } from "./roles-client";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const { user, permissions } = await getCurrentUserPermissions();
  if (!user || !user.tenantId) redirect("/auth/login");
  if (!can(permissions, "canEditSettings")) redirect("/tenant-admin");

  const roles = await runWithTenantContextAsync(user.tenantId, () =>
    listRolesWithPermissions(),
  );

  return (
    <RolesClient
      roles={roles.map((r) => ({
        role: r.role,
        editable: r.editable,
        permissions: { ...r.permissions },
      }))}
    />
  );
}
