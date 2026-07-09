import { redirect } from "next/navigation";
import { getCurrentUserPermissions } from "@/lib/permissions/current-user-permissions";
import { runWithTenantContextAsync } from "@/lib/tenant/tenant-context";
import { can } from "@/lib/permissions/resolve";
import { listMembers } from "@/lib/team/members";
import { listPendingInvitations } from "@/lib/team/invitations";
import { TeamClient } from "./team-client";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { user, permissions } = await getCurrentUserPermissions();
  if (!user || !user.tenantId) redirect("/auth/login");
  if (!can(permissions, "canInviteTeamMembers")) redirect("/tenant-admin");

  const [members, invitations] = await runWithTenantContextAsync(user.tenantId, () =>
    Promise.all([listMembers(), listPendingInvitations()]),
  );

  return (
    <TeamClient
      members={members.map((m) => ({
        id: m.id,
        email: m.email ?? "",
        name: m.name,
        teamRole: m.teamRole,
        isActive: m.isActive,
        isSelf: !!m.clerkUserId && m.clerkUserId === user.id,
      }))}
      invitations={invitations.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        expiresAt: i.expiresAt.toISOString(),
      }))}
      canRemove={can(permissions, "canDeleteTeamMembers")}
      canManageRoles={can(permissions, "canEditSettings")}
    />
  );
}
