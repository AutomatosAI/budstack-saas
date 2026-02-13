import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { uploadFromGitHub } from "@/lib/tenant-template-upload-service";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";

export async function POST(request: NextRequest) {
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
        { error: "No tenant found. Please ensure you are associated with a tenant." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { templateName, githubUrl } = body;

    if (!templateName || typeof templateName !== "string" || !templateName.trim()) {
      return NextResponse.json(
        { error: "Template name is required" },
        { status: 400 },
      );
    }

    if (!githubUrl || typeof githubUrl !== "string") {
      return NextResponse.json(
        { error: "GitHub URL is required" },
        { status: 400 },
      );
    }

    const githubPattern = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?$/;
    if (!githubPattern.test(githubUrl.replace(/\.git$/, ""))) {
      return NextResponse.json(
        { error: "Invalid GitHub URL format. Expected: https://github.com/username/repo" },
        { status: 400 },
      );
    }

    const tenantTemplate = await uploadFromGitHub(tenantId, templateName, githubUrl);

    await createAuditLog({
      action: AUDIT_ACTIONS.TEMPLATE.CREATED,
      entityType: "TenantTemplate",
      entityId: tenantTemplate.id,
      userId: user.id,
      userEmail: user.email || undefined,
      tenantId,
      metadata: {
        templateName: tenantTemplate.templateName,
        githubUrl,
        source: "custom",
        s3Path: tenantTemplate.s3Path,
      },
    });

    return NextResponse.json({
      success: true,
      templateId: tenantTemplate.id,
      templateName: tenantTemplate.templateName,
      s3Path: tenantTemplate.s3Path,
    });
  } catch (error: any) {
    console.error("[Tenant Template Upload] Error:", error);

    // Return 422 for validation errors, 500 for everything else
    const status = error.message?.includes("validation failed") ? 422 : 500;
    return NextResponse.json(
      { error: error.message || "Failed to upload template" },
      { status },
    );
  }
}
