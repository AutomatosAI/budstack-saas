import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { requirePermissionParams } from "@/lib/permissions/require-permission";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";
import { revokeInvitation } from "@/lib/team/invitations";

export const DELETE = requirePermissionParams(
  "canInviteTeamMembers",
  async (req, { user, tenantId }, params) => {
    try {
      const inv = await revokeInvitation(params.id);

      const { ipAddress, userAgent } = getClientInfo(req.headers);
      await createAuditLog({
        action: AUDIT_ACTIONS.TEAM.INVITATION_REVOKED,
        entityType: "TeamMember",
        entityId: inv.id,
        userId: user.id,
        userEmail: user.email,
        tenantId,
        metadata: { email: inv.email, role: inv.role },
        ipAddress,
        userAgent,
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      return apiError(error, { route: "DELETE /api/tenant-admin/team/invitations/[id]" });
    }
  },
);
