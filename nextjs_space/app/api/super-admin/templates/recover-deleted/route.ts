import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { createS3Client, getBucketConfig } from "@/lib/aws-config";
import { apiError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";

const recoverDeletedSchema = z
  .object({
    slug: z.string().max(200).optional(),
    execute: z.boolean().optional(),
  })
  .strict();
import {
  ListObjectVersionsCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

// One-shot recovery endpoint for templates that were nuked by the broken
// super-admin DELETE cascade (incident 2026-04-29 — LekkerWeed wipe).
//
// Steps:
//   1. Find delete markers under templates/{slug}/ via S3 versioning
//   2. Strip the markers (DeleteObject with VersionId) — restores prior version
//   3. Read restored template.config.json + layout.json + defaults.json
//   4. Find surviving tenant clones at tenants/*/templates/{slug}/
//   5. Recreate the templates row + tenant_templates row(s)
//   6. Re-link tenants.templateId + activeTenantTemplateId
//
// Dry-run by default. Pass { execute: true } to actually write.

interface RecoveryReport {
  slug: string;
  dryRun: boolean;
  baseFilesRestored: { key: string; deleteMarkerVersionId: string }[];
  tenantClonesFound: { tenantId: string; businessName: string | null; prefix: string }[];
  templateRowCreated: { id: string; name: string; slug: string } | null;
  tenantTemplateRowsCreated: { id: string; tenantId: string; templateName: string }[];
  tenantsRelinked: { tenantId: string; templateId: string; activeTenantTemplateId: string }[];
  warnings: string[];
}

async function readJsonFromS3<T = any>(key: string): Promise<T | null> {
  const s3Client = await createS3Client();
  const { bucketName } = await getBucketConfig();
  try {
    const res = await s3Client.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
    const body = await res.Body?.transformToString("utf-8");
    if (!body) return null;
    return JSON.parse(body);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await parseJsonBody(req, recoverDeletedSchema.optional())) ?? {};
    const slug = (body.slug || "").toString().trim().toLowerCase();
    const execute = body.execute === true;

    if (!slug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }

    const report: RecoveryReport = {
      slug,
      dryRun: !execute,
      baseFilesRestored: [],
      tenantClonesFound: [],
      templateRowCreated: null,
      tenantTemplateRowsCreated: [],
      tenantsRelinked: [],
      warnings: [],
    };

    const s3Client = await createS3Client();
    const { bucketName } = await getBucketConfig();
    const basePrefix = `templates/${slug}/`;

    // Refuse if a templates row already exists for this slug — caller probably
    // meant to recover something else, or recovery already ran.
    const existingTemplate = await prisma.templates.findUnique({ where: { slug } });
    if (existingTemplate && execute) {
      return NextResponse.json(
        {
          error: `templates row for slug "${slug}" already exists (id=${existingTemplate.id}). Refusing to overwrite. If you want to redo recovery, delete that row first via DB console.`,
        },
        { status: 409 },
      );
    }

    // Step 1+2 — list versions, find delete markers at the latest position, strip them
    let keyMarker: string | undefined;
    let versionIdMarker: string | undefined;
    do {
      const versions = await s3Client.send(
        new ListObjectVersionsCommand({
          Bucket: bucketName,
          Prefix: basePrefix,
          KeyMarker: keyMarker,
          VersionIdMarker: versionIdMarker,
        }),
      );

      const markers = (versions.DeleteMarkers || []).filter((m) => m.IsLatest);
      for (const marker of markers) {
        if (!marker.Key || !marker.VersionId) continue;
        if (execute) {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: bucketName,
              Key: marker.Key,
              VersionId: marker.VersionId,
            }),
          );
        }
        report.baseFilesRestored.push({
          key: marker.Key,
          deleteMarkerVersionId: marker.VersionId,
        });
      }

      keyMarker = versions.NextKeyMarker;
      versionIdMarker = versions.NextVersionIdMarker;
    } while (keyMarker || versionIdMarker);

    if (report.baseFilesRestored.length === 0) {
      report.warnings.push(
        `No delete markers found under ${basePrefix}. Either the slug is wrong, S3 versioning was off when the delete happened, or the files were never deleted.`,
      );
    }

    // Step 3 — read restored config (only meaningful after we've stripped markers OR
    // in dry-run, only if no marker was at the latest position)
    let configJson: any = null;
    let layoutJson: any = null;
    let defaultsJson: any = null;
    if (execute && report.baseFilesRestored.length > 0) {
      configJson = await readJsonFromS3(`${basePrefix}template.config.json`);
      layoutJson = await readJsonFromS3(`${basePrefix}layout.json`);
      defaultsJson = await readJsonFromS3(`${basePrefix}defaults.json`);
      if (!configJson) {
        report.warnings.push(
          `template.config.json could not be read after restore — falling back to slug-derived name.`,
        );
      }
    }

    // Step 4 — find tenant clones (these were never deleted)
    let token: string | undefined;
    do {
      const list = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: "tenants/",
          Delimiter: "/",
          ContinuationToken: token,
        }),
      );
      const tenantPrefixes = (list.CommonPrefixes || [])
        .map((p) => p.Prefix)
        .filter(Boolean) as string[];

      for (const tenantPrefix of tenantPrefixes) {
        // tenantPrefix looks like "tenants/{tenantId}/"
        const tenantId = tenantPrefix.split("/")[1];
        const cloneCheckPrefix = `${tenantPrefix}templates/${slug}/`;
        const cloneList = await s3Client.send(
          new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: cloneCheckPrefix,
            MaxKeys: 1,
          }),
        );
        if ((cloneList.KeyCount || 0) > 0) {
          const tenantRow = await prisma.tenants.findUnique({ where: { id: tenantId } });
          report.tenantClonesFound.push({
            tenantId,
            businessName: tenantRow?.businessName ?? null,
            prefix: cloneCheckPrefix,
          });
        }
      }
      token = list.NextContinuationToken;
    } while (token);

    if (report.tenantClonesFound.length === 0) {
      report.warnings.push(
        `No tenant clones found at tenants/*/templates/${slug}/. The DB recreation step will be skipped.`,
      );
    }

    // Step 5 — recreate DB rows (only when execute=true)
    if (execute && report.tenantClonesFound.length > 0) {
      const newTemplateId = `tmpl_${Date.now()}`;
      const templateName: string =
        configJson?.name || configJson?.displayName || `${slug} (recovered)`;
      const templateDescription: string | null =
        configJson?.description || `Recovered ${new Date().toISOString()}`;

      const createdTemplate = await prisma.templates.create({
        data: {
          id: newTemplateId,
          name: templateName,
          slug,
          description: templateDescription,
          isActive: true,
          isPublic: configJson?.isPublic ?? false,
          sourceType: "SYSTEM",
          category: configJson?.category || "modern",
          version: configJson?.version || "1.0.0",
          author: configJson?.author || "BudStacks",
          tags: configJson?.tags || [],
          previewUrl: configJson?.previewUrl || null,
          thumbnailUrl: configJson?.thumbnailUrl || null,
          updatedAt: new Date(),
        },
      });
      report.templateRowCreated = {
        id: createdTemplate.id,
        name: createdTemplate.name,
        slug: createdTemplate.slug || slug,
      };

      // For each tenant clone, recreate the tenant_templates row from its surviving
      // layout.json + defaults.json
      for (const clone of report.tenantClonesFound) {
        const cloneDefaults = await readJsonFromS3(`${clone.prefix}defaults.json`);
        const cloneLayout = await readJsonFromS3(`${clone.prefix}layout.json`);
        if (!cloneDefaults && !cloneLayout) {
          report.warnings.push(
            `Tenant ${clone.tenantId} clone at ${clone.prefix} had neither defaults.json nor layout.json — skipping DB recreate.`,
          );
          continue;
        }

        const ttId = `tt_${Date.now()}_${clone.tenantId.slice(0, 6)}`;
        const created = await prisma.tenant_templates.create({
          data: {
            id: ttId,
            tenantId: clone.tenantId,
            baseTemplateId: createdTemplate.id,
            templateName: cloneDefaults?.templateName || templateName,
            s3Path: clone.prefix.replace(/\/$/, ""),
            designSystem: cloneDefaults?.designSystem || {},
            pageContent: cloneDefaults?.pageContent || {},
            navigation: cloneLayout?.navigationConfig || cloneDefaults?.navigation || {},
            footer: cloneLayout?.footerConfig || cloneDefaults?.footer || {},
            logoUrl: cloneDefaults?.logoUrl || null,
            heroImageUrl: cloneDefaults?.heroImageUrl || null,
            faviconUrl: cloneDefaults?.faviconUrl || null,
            customCss: null,
            customJs: null,
            isActive: true,
            isDraft: false,
            source: "cloned",
            updatedAt: new Date(),
          },
        });
        report.tenantTemplateRowsCreated.push({
          id: created.id,
          tenantId: created.tenantId,
          templateName: created.templateName,
        });

        // Step 6 — re-link the tenants row
        await prisma.tenants.update({
          where: { id: clone.tenantId },
          data: {
            templateId: createdTemplate.id,
            activeTenantTemplateId: created.id,
          },
        });
        report.tenantsRelinked.push({
          tenantId: clone.tenantId,
          templateId: createdTemplate.id,
          activeTenantTemplateId: created.id,
        });
      }
    }

    return NextResponse.json({ success: true, report });
  } catch (error) {
    // SECURITY (H_e1): never expose stack/error.message to clients —
    // recovery context could include S3 keys, internal paths, or DB
    // constraint names. Client gets a correlationId for support.
    return apiError(error, {
      route: "super-admin.templates.recover-deleted",
      status: 500,
      safeMessage: "Recovery failed",
    });
  }
}
