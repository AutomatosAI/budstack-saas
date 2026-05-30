import { NextResponse } from "next/server";
import { withSuperAdminParams } from "@/lib/api-auth";
import { getSubmissionDetail } from "@/lib/marketplace-review-service";
import { apiError } from "@/lib/api-error";

export const GET = withSuperAdminParams(async (_req, _ctx, params) => {
  try {
    const { id } = params;
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
});
