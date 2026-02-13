import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { editSubmission } from "@/lib/marketplace-review-service";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";

export async function PUT(
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
    const { layoutJson, defaultsJson, configJson, stylesCss } = body;

    if (!layoutJson && !defaultsJson && !configJson && !stylesCss) {
      return NextResponse.json(
        { error: "At least one file must be provided" },
        { status: 400 },
      );
    }

    await editSubmission(id, { layoutJson, defaultsJson, configJson, stylesCss });

    await createAuditLog({
      action: AUDIT_ACTIONS.TEMPLATE.UPDATED,
      entityType: "MarketplaceSubmission",
      entityId: id,
      userId: user.id,
      userEmail: user.email || undefined,
      metadata: {
        action: "edited",
        filesEdited: [
          layoutJson && "layout.json",
          defaultsJson && "defaults.json",
          configJson && "template.config.json",
          stylesCss && "styles.css",
        ].filter(Boolean),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Edit Submission] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to edit submission" },
      { status: 500 },
    );
  }
}
