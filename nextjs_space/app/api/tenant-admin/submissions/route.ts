import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { listTenantSubmissions } from "@/lib/marketplace-submission-service";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (
      !user ||
      !["TENANT_ADMIN", "SUPER_ADMIN"].includes(user.role || "")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: "No tenant found" },
        { status: 400 },
      );
    }

    const submissions = await listTenantSubmissions(tenantId);

    return NextResponse.json({ submissions });
  } catch (error: any) {
    console.error("[List Submissions] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list submissions" },
      { status: 500 },
    );
  }
}
