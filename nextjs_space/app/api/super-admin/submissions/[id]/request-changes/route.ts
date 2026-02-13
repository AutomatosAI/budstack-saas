import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { requestChanges } from "@/lib/marketplace-review-service";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { feedback } = body;

    if (!feedback || typeof feedback !== "string" || !feedback.trim()) {
      return NextResponse.json(
        { error: "Feedback is required when requesting changes" },
        { status: 400 },
      );
    }

    await requestChanges(id, user.id, feedback.trim());

    await createAuditLog({
      action: AUDIT_ACTIONS.TEMPLATE.UPDATED,
      entityType: "MarketplaceSubmission",
      entityId: id,
      userId: user.id,
      userEmail: user.email || undefined,
      metadata: { action: "changes_requested", feedback: feedback.trim() },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Request Changes] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to request changes" },
      { status: 500 },
    );
  }
}
