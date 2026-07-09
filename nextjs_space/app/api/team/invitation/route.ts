import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { getInvitationPreview } from "@/lib/team/accept";

// Public, token-gated: powers the /accept-invite page before the user signs in.
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Missing invitation token." }, { status: 400 });
    }
    const invitation = await getInvitationPreview(token);
    return NextResponse.json({ invitation });
  } catch (error) {
    return apiError(error, { route: "GET /api/team/invitation" });
  }
}
