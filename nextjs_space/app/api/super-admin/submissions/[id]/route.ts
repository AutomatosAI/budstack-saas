import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { getSubmissionDetail } from "@/lib/marketplace-review-service";
import { apiError } from "@/lib/api-error";
import { parseUuid } from "@/lib/validation/parse-uuid";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = parseUuid((await params).id);
    const detail = await getSubmissionDetail(id);

    return NextResponse.json(detail);
  } catch (error: any) {
    console.error("[Submission Detail] Error:", error);
    return apiError(error, {
      route: "super-admin.submissions.detail",
      status: 500,
      safeMessage: "Failed to get submission detail",
    });
  }
}
