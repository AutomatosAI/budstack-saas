import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

/**
 * Trigger a Railway deployment rebuild
 * This is useful after uploading a new template to make it immediately available
 */
export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();

    if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if Railway webhook URL is configured
    const railwayWebhookUrl = process.env.RAILWAY_DEPLOY_WEBHOOK_URL;

    if (!railwayWebhookUrl) {
      return NextResponse.json(
        {
          error:
            "Railway deployment webhook not configured. Set RAILWAY_DEPLOY_WEBHOOK_URL environment variable.",
          message:
            "Template registry has been updated. Manual rebuild required to activate template.",
        },
        { status: 200 }, // Not an error - just informational
      );
    }

    console.log("[Rebuild Trigger] Triggering Railway deployment...");

    // Trigger Railway webhook
    const response = await fetch(railwayWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "template-upload",
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Railway webhook failed: ${response.status} ${response.statusText}`,
      );
    }

    console.log("[Rebuild Trigger] Railway deployment triggered successfully");

    return NextResponse.json({
      success: true,
      message:
        "Deployment triggered successfully. Template will be available after build completes.",
      estimatedTime: "3-5 minutes",
    });
  } catch (error: any) {
    console.error("[Rebuild Trigger] Error:", error);
    return NextResponse.json(
      { error: "Failed to trigger deployment" },
      { status: 500 },
    );
  }
}
