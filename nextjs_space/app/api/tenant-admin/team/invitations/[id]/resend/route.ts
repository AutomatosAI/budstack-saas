import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { requirePermissionParams } from "@/lib/permissions/require-permission";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";
import { renewInvitation } from "@/lib/team/invitations";
import { sendTeamInviteEmail } from "@/lib/team/invite-email";

export const POST = requirePermissionParams(
  "canInviteTeamMembers",
  async (req, { user, tenantId }, params) => {
    try {
      const inv = await renewInvitation(params.id);

      const tenant = await prisma.tenants.findFirst({
        where: { id: tenantId },
        select: { businessName: true },
      });
      await sendTeamInviteEmail({
        tenantId,
        tenantName: tenant?.businessName ?? "BudStacks",
        email: inv.email,
        role: inv.role,
        token: inv.invitationToken,
        inviterName: user.name,
      });

      const { ipAddress, userAgent } = getClientInfo(req.headers);
      await createAuditLog({
        action: AUDIT_ACTIONS.TEAM.INVITATION_RESENT,
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
      return apiError(error, {
        route: "POST /api/tenant-admin/team/invitations/[id]/resend",
      });
    }
  },
);
