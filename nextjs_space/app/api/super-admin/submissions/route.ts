import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { listSubmissions } from "@/lib/marketplace-review-service";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;

    const submissions = await listSubmissions(status ? { status } : undefined);

    return NextResponse.json({ submissions });
  } catch (error: any) {
    console.error("[List Submissions] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list submissions" },
      { status: 500 },
    );
  }
}
