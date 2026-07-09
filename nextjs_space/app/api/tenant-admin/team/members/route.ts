import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions/require-permission";
import { apiError } from "@/lib/api-error";
import { listMembers } from "@/lib/team/members";
import { listPendingInvitations } from "@/lib/team/invitations";

export const GET = requirePermission("canInviteTeamMembers", async () => {
  try {
    const [members, invitations] = await Promise.all([
      listMembers(),
      listPendingInvitations(),
    ]);
    return NextResponse.json({ members, invitations });
  } catch (error) {
    return apiError(error, { route: "GET /api/tenant-admin/team/members" });
  }
});
