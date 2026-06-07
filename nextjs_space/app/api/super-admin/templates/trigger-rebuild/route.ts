import { NextResponse } from "next/server";
import { withSuperAdmin } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logger } from "@/lib/logger";

/**
 * Trigger a Railway deployment rebuild
 * This is useful after uploading a new template to make it immediately available
 */
export const POST = withSuperAdmin(async (_req) => {
  try {
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

    logger.info("[Rebuild Trigger] Triggering Railway deployment...");

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

    logger.info("[Rebuild Trigger] Railway deployment triggered successfully");

    return NextResponse.json({
      success: true,
      message:
        "Deployment triggered successfully. Template will be available after build completes.",
      estimatedTime: "3-5 minutes",
    });
  } catch (error: any) {
    console.error("[Rebuild Trigger] Error:", error);
    return apiError(error, {
      route: "POST /api/super-admin/templates/trigger-rebuild",
      safeMessage: "Failed to trigger deployment",
    });
  }
});
