import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { apiError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";
import { acceptInviteSchema } from "@/lib/team/schemas";
import { acceptInvitation } from "@/lib/team/accept";

export async function POST(req: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json(
        { error: "Please sign in to accept this invitation." },
        { status: 401 },
      );
    }
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) {
      return NextResponse.json(
        { error: "Your account has no email address." },
        { status: 400 },
      );
    }

    const { token } = await parseJsonBody(req, acceptInviteSchema);
    const result = await acceptInvitation({ token, clerkUserId: clerkUser.id, email });

    const { ipAddress, userAgent } = getClientInfo(req.headers);
    await createAuditLog({
      action: AUDIT_ACTIONS.TEAM.INVITATION_ACCEPTED,
      entityType: "TeamMember",
      entityId: clerkUser.id,
      userId: clerkUser.id,
      userEmail: email,
      tenantId: result.tenantId,
      metadata: { role: result.role },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, redirectTo: "/tenant-admin" });
  } catch (error) {
    return apiError(error, { route: "POST /api/team/accept-invite" });
  }
}
