import { NextResponse } from "next/server";
import { withTenantAuth } from "@/lib/api-auth";
import { listTenantSubmissions } from "@/lib/marketplace-submission-service";
import { apiError } from "@/lib/api-error";

export const GET = withTenantAuth(async (_request, { tenantId }) => {
  try {
    const submissions = await listTenantSubmissions(tenantId);

    return NextResponse.json({ submissions });
  } catch (error: any) {
    console.error("[List Submissions] Error:", error);
    return apiError(error, {
      route: "tenant-admin.submissions.list",
      status: 500,
      safeMessage: "Failed to list submissions",
    });
  }
});
