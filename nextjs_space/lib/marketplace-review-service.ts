/**
 * Marketplace Review Service (Super Admin)
 *
 * Handles listing, reviewing, approving, rejecting, and editing
 * marketplace submissions.
 */

import { randomUUID } from "crypto";
import { prisma } from "./db";
import { copyS3Directory, getJsonFromS3, getTextFromS3 } from "./s3";
import { deleteS3Directory } from "./s3";
import { getBucketConfig } from "./aws-config";
import { generateSlug } from "./template-utils";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createS3Client } from "./aws-config";

/**
 * List marketplace submissions with optional status filter.
 * Returns submissions with tenant name, ordered oldest first.
 */
export async function listSubmissions(filters?: { status?: string }) {
  const where: any = {};

  if (filters?.status) {
    where.status = filters.status;
  } else {
    // By default, exclude withdrawn submissions
    where.status = { not: "withdrawn" };
  }

  return prisma.marketplace_submissions.findMany({
    where,
    include: {
      tenant: { select: { id: true, businessName: true } },
      tenantTemplate: { select: { id: true, templateName: true, s3Path: true } },
      reviewer: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Get full submission detail including template file contents from staging S3.
 */
export async function getSubmissionDetail(submissionId: string) {
  const submission = await prisma.marketplace_submissions.findUnique({
    where: { id: submissionId },
    include: {
      tenant: { select: { id: true, businessName: true } },
      tenantTemplate: { select: { id: true, templateName: true, s3Path: true } },
      reviewer: { select: { id: true, name: true, email: true } },
    },
  });

  if (!submission) {
    throw new Error("Submission not found");
  }

  // Read the 4 template files from staging S3
  const stagingPath = submission.stagingS3Path;
  let layoutJson: string | null = null;
  let defaultsJson: string | null = null;
  let configJson: string | null = null;
  let stylesCss: string | null = null;

  try {
    const layoutData = await getJsonFromS3(`${stagingPath}layout.json`);
    layoutJson = JSON.stringify(layoutData, null, 2);
  } catch {
    layoutJson = null;
  }

  try {
    const defaultsData = await getJsonFromS3(`${stagingPath}defaults.json`);
    defaultsJson = JSON.stringify(defaultsData, null, 2);
  } catch {
    defaultsJson = null;
  }

  try {
    const configData = await getJsonFromS3(`${stagingPath}template.config.json`);
    configJson = JSON.stringify(configData, null, 2);
  } catch {
    configJson = null;
  }

  try {
    stylesCss = await getTextFromS3(`${stagingPath}styles.css`);
  } catch {
    stylesCss = null;
  }

  return {
    ...submission,
    files: {
      layoutJson,
      defaultsJson,
      configJson,
      stylesCss,
    },
  };
}

/**
 * Approve a submission: copy files to marketplace, create template record.
 */
export async function approveSubmission(
  submissionId: string,
  reviewerId: string,
) {
  const submission = await prisma.marketplace_submissions.findUnique({
    where: { id: submissionId },
    include: { tenant: true },
  });

  if (!submission) {
    throw new Error("Submission not found");
  }

  if (submission.status !== "pending" && submission.status !== "changes_requested") {
    throw new Error("Can only approve pending or changes-requested submissions");
  }

  // Generate a unique slug for the marketplace template
  let baseSlug = generateSlug(submission.templateName);
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const existing = await prisma.templates.findUnique({ where: { slug } });
    if (!existing) break;
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }

  // Copy files from staging to marketplace S3 path
  const { folderPrefix } = await getBucketConfig();
  const destPrefix = `${folderPrefix}templates/${slug}/`;
  await copyS3Directory(submission.stagingS3Path, destPrefix);

  // Create the marketplace template record
  const template = await prisma.templates.create({
    data: {
      id: randomUUID(),
      name: submission.templateName,
      slug,
      description: submission.description,
      category: submission.category || "general",
      tags: submission.tags,
      version: "1.0.0",
      sourceType: "COMMUNITY",
      authorTenantId: submission.tenantId,
      authorName: submission.tenant.businessName,
      isActive: true,
      isPublic: true,
      updatedAt: new Date(),
    },
  });

  // Update submission status
  const history = (submission.reviewHistory as any[]) || [];
  history.push({
    action: "approved",
    at: new Date().toISOString(),
    by: reviewerId,
  });

  await prisma.marketplace_submissions.update({
    where: { id: submissionId },
    data: {
      status: "approved",
      reviewerId,
      approvedTemplateId: template.id,
      reviewedAt: new Date(),
      reviewHistory: history,
    },
  });

  // Clean up staging S3 files
  try {
    await deleteS3Directory(submission.stagingS3Path);
  } catch {
    // Non-fatal
  }

  return template;
}

/**
 * Reject a submission with feedback.
 */
export async function rejectSubmission(
  submissionId: string,
  reviewerId: string,
  feedback: string,
) {
  const submission = await prisma.marketplace_submissions.findUnique({
    where: { id: submissionId },
  });

  if (!submission) {
    throw new Error("Submission not found");
  }

  const history = (submission.reviewHistory as any[]) || [];
  history.push({
    action: "rejected",
    at: new Date().toISOString(),
    by: reviewerId,
    feedback,
  });

  await prisma.marketplace_submissions.update({
    where: { id: submissionId },
    data: {
      status: "rejected",
      reviewerId,
      reviewerFeedback: feedback,
      reviewedAt: new Date(),
      reviewHistory: history,
    },
  });
}

/**
 * Request changes on a submission with feedback.
 */
export async function requestChanges(
  submissionId: string,
  reviewerId: string,
  feedback: string,
) {
  const submission = await prisma.marketplace_submissions.findUnique({
    where: { id: submissionId },
  });

  if (!submission) {
    throw new Error("Submission not found");
  }

  const history = (submission.reviewHistory as any[]) || [];
  history.push({
    action: "changes_requested",
    at: new Date().toISOString(),
    by: reviewerId,
    feedback,
  });

  await prisma.marketplace_submissions.update({
    where: { id: submissionId },
    data: {
      status: "changes_requested",
      reviewerId,
      reviewerFeedback: feedback,
      reviewedAt: new Date(),
      reviewHistory: history,
    },
  });
}

/**
 * Edit submission template files in staging S3.
 * Overwrites only provided files (partial update).
 */
export async function editSubmission(
  submissionId: string,
  files: {
    layoutJson?: string;
    defaultsJson?: string;
    configJson?: string;
    stylesCss?: string;
  },
) {
  const submission = await prisma.marketplace_submissions.findUnique({
    where: { id: submissionId },
  });

  if (!submission) {
    throw new Error("Submission not found");
  }

  const s3Client = await createS3Client();
  const { bucketName } = await getBucketConfig();
  const stagingPath = submission.stagingS3Path;

  const fileMap: Record<string, string | undefined> = {
    "layout.json": files.layoutJson,
    "defaults.json": files.defaultsJson,
    "template.config.json": files.configJson,
    "styles.css": files.stylesCss,
  };

  for (const [filename, content] of Object.entries(fileMap)) {
    if (content === undefined) continue;

    const key = `${stagingPath}${filename}`;
    const contentType = filename.endsWith(".css")
      ? "text/css"
      : "application/json";

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: content,
        ContentType: contentType,
      }),
    );
  }
}
