/**
 * Marketplace Submission Service
 *
 * Handles submitting tenant custom templates to the marketplace,
 * withdrawing submissions, and listing submissions for a tenant.
 */

import { prisma } from "@/lib/db";
import { copyS3Directory, deleteS3Directory } from "@/lib/storage/s3";
import { getBucketConfig } from "@/lib/storage/aws-config";

/**
 * Submit a custom tenant template to the marketplace for review.
 * Copies S3 files to a staging area and creates a submission record.
 */
export async function submitToMarketplace(
  tenantTemplateId: string,
  metadata: {
    description?: string;
    category?: string;
    tags?: string[];
  },
) {
  // Verify the template exists and is custom
  const tenantTemplate = await prisma.tenant_templates.findUnique({
    where: { id: tenantTemplateId },
    include: { tenant: true },
  });

  if (!tenantTemplate) {
    throw new Error("Tenant template not found");
  }

  if (tenantTemplate.source !== "custom") {
    throw new Error("Only custom templates can be submitted to the marketplace");
  }

  if (!tenantTemplate.s3Path) {
    throw new Error("Template has no S3 path");
  }

  // Check for existing pending/changes_requested submission
  const existingSubmission = await prisma.marketplace_submissions.findFirst({
    where: {
      tenantTemplateId,
      status: { in: ["pending", "changes_requested"] },
    },
  });

  if (existingSubmission) {
    throw new Error(
      "This template already has an active submission. Withdraw it first to submit again.",
    );
  }

  // Create the submission record first to get the ID for S3 path
  const submission = await prisma.marketplace_submissions.create({
    data: {
      tenantId: tenantTemplate.tenantId,
      tenantTemplateId,
      templateName: tenantTemplate.templateName,
      description: metadata.description,
      category: metadata.category,
      tags: metadata.tags || [],
      stagingS3Path: "", // Will be updated below
      status: "pending",
    },
  });

  // Copy files to staging S3
  const { folderPrefix } = await getBucketConfig();
  const stagingPrefix = `${folderPrefix}marketplace-submissions/${submission.id}/`;
  const sourcePrefix = `${tenantTemplate.s3Path}/`;

  await copyS3Directory(sourcePrefix, stagingPrefix);

  // Update the submission with the staging path
  const updated = await prisma.marketplace_submissions.update({
    where: { id: submission.id },
    data: { stagingS3Path: stagingPrefix },
  });

  return updated;
}

/**
 * Withdraw a marketplace submission.
 * Deletes staging S3 files and updates status.
 */
export async function withdrawSubmission(
  submissionId: string,
  tenantId: string,
) {
  const submission = await prisma.marketplace_submissions.findUnique({
    where: { id: submissionId },
  });

  if (!submission) {
    throw new Error("Submission not found");
  }

  if (submission.tenantId !== tenantId) {
    throw new Error("Submission does not belong to this tenant");
  }

  if (!["pending", "changes_requested"].includes(submission.status)) {
    throw new Error("Can only withdraw pending or changes-requested submissions");
  }

  // Clean up staging S3 files
  if (submission.stagingS3Path) {
    try {
      await deleteS3Directory(submission.stagingS3Path);
    } catch {
      // Non-fatal — staging files may already be gone
    }
  }

  await prisma.marketplace_submissions.update({
    where: { id: submissionId },
    data: {
      status: "withdrawn",
      reviewHistory: {
        push: {
          action: "withdrawn",
          at: new Date().toISOString(),
          by: "tenant",
        },
      },
    },
  });
}

/**
 * List all marketplace submissions for a tenant, newest first.
 */
export async function listTenantSubmissions(tenantId: string) {
  return prisma.marketplace_submissions.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Re-submit a template after changes were requested.
 * Copies latest files from tenant's custom-templates to staging and resets status.
 */
export async function resubmitToMarketplace(submissionId: string) {
  const submission = await prisma.marketplace_submissions.findUnique({
    where: { id: submissionId },
    include: { tenantTemplate: true },
  });

  if (!submission) {
    throw new Error("Submission not found");
  }

  if (submission.status !== "changes_requested") {
    throw new Error("Can only re-submit submissions with changes requested");
  }

  if (!submission.tenantTemplate.s3Path) {
    throw new Error("Template has no S3 path");
  }

  // Overwrite staging S3 with latest tenant files
  const sourcePrefix = `${submission.tenantTemplate.s3Path}/`;
  const stagingPrefix = submission.stagingS3Path;

  await copyS3Directory(sourcePrefix, stagingPrefix);

  // Reset status to pending
  const history = (submission.reviewHistory as any[]) || [];
  history.push({
    action: "resubmitted",
    at: new Date().toISOString(),
    by: "tenant",
  });

  const updated = await prisma.marketplace_submissions.update({
    where: { id: submissionId },
    data: {
      status: "pending",
      reviewHistory: history,
    },
  });

  return updated;
}
