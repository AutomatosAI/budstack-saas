import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, apiError } from "@/lib/api-error";
import { requirePermissionParams } from "@/lib/permissions/require-permission";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";
import { removeMember, countActiveAdmins } from "@/lib/team/members";

export const DELETE = requirePermissionParams(
  "canDeleteTeamMembers",
  async (req, { user, tenantId }, params) => {
    try {
      const member = await prisma.users.findFirst({
        where: { id: params.id, role: "TENANT_ADMIN" },
        select: {
          id: true,
          email: true,
          teamRole: true,
          clerkUserId: true,
          isActive: true,
        },
      });
      if (!member) throw new ApiError("Team member not found.", 404);

      // Guardrails: don't strand the tenant.
      if (member.clerkUserId && member.clerkUserId === user.id) {
        return NextResponse.json({ error: "You can't remove yourself." }, { status: 400 });
      }
      if (member.isActive && (await countActiveAdmins()) <= 1) {
        return NextResponse.json(
          { error: "You can't remove the last active team member." },
          { status: 400 },
        );
      }

      await removeMember(member.id);

      const { ipAddress, userAgent } = getClientInfo(req.headers);
      await createAuditLog({
        action: AUDIT_ACTIONS.TEAM.MEMBER_REMOVED,
        entityType: "TeamMember",
        entityId: member.id,
        userId: user.id,
        userEmail: user.email,
        tenantId,
        metadata: { email: member.email, role: member.teamRole },
        ipAddress,
        userAgent,
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      return apiError(error, { route: "DELETE /api/tenant-admin/team/members/[id]" });
    }
  },
);
