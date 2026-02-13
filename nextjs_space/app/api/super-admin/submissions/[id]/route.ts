import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { getSubmissionDetail } from "@/lib/marketplace-review-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const detail = await getSubmissionDetail(id);

    return NextResponse.json(detail);
  } catch (error: any) {
    console.error("[Submission Detail] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get submission detail" },
      { status: 500 },
    );
  }
}
