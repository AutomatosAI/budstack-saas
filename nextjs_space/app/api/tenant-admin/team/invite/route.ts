import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions/require-permission";
import { parseJsonBody } from "@/lib/validation/body";
import { apiError } from "@/lib/api-error";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";
import { inviteSchema } from "@/lib/team/schemas";
import { createOrRenewInvitation } from "@/lib/team/invitations";
import { sendTeamInviteEmail } from "@/lib/team/invite-email";

export const POST = requirePermission(
  "canInviteTeamMembers",
  async (req, { user, tenantId }) => {
    try {
      const { email, role } = await parseJsonBody(req, inviteSchema);

      const invitation = await createOrRenewInvitation({
        tenantId,
        email,
        role,
        invitedBy: user.id,
      });

      const tenant = await prisma.tenants.findFirst({
        where: { id: tenantId },
        select: { businessName: true },
      });
      await sendTeamInviteEmail({
        tenantId,
        tenantName: tenant?.businessName ?? "BudStacks",
        email: invitation.email,
        role: invitation.role,
        token: invitation.invitationToken,
        inviterName: user.name,
      });

      const { ipAddress, userAgent } = getClientInfo(req.headers);
      await createAuditLog({
        action: AUDIT_ACTIONS.TEAM.MEMBER_INVITED,
        entityType: "TeamMember",
        entityId: invitation.id,
        userId: user.id,
        userEmail: user.email,
        tenantId,
        metadata: { email: invitation.email, role: invitation.role },
        ipAddress,
        userAgent,
      });

      return NextResponse.json({ success: true, invitationId: invitation.id });
    } catch (error) {
      return apiError(error, { route: "POST /api/tenant-admin/team/invite" });
    }
  },
);
