import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { uploadFromGitHub } from "@/lib/tenant-template-upload-service";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { apiError } from "@/lib/api-error";

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
  } catch (error) {
    // Pass through validation errors (these are pre-vetted strings from
    // tenant-template-upload-service — safe for client display).
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes("validation failed")) {
      return apiError(error, {
        route: "tenant-admin.templates.upload",
        status: 422,
        safeMessage: errMsg,
      });
    }

    // SECURITY (H_e1): generic 500 — upload errors may include S3 keys,
    // GitHub API responses, or internal fs paths.
    return apiError(error, {
      route: "tenant-admin.templates.upload",
      status: 500,
      safeMessage: "Failed to upload template",
    });
  }
}
