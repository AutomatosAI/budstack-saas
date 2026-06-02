import {
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createS3Client, getBucketConfig } from "@/lib/storage/aws-config";
import { assertKeyInTenantScope } from "@/lib/storage/s3-tenant-guard";
import { promises as fs } from "fs";
import path from "path";
import { sanitizeSvg } from "@/lib/security/svg-sanitize";

// Map MIME types to file extensions for files uploaded without an extension
const mimeToExt: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};

export async function uploadFile(
  buffer: Buffer,
  fileName: string,
  contentType?: string,
  tenantPrefix?: string,
): Promise<string> {
  const s3Client = await createS3Client();
  const { bucketName, folderPrefix } = await getBucketConfig();

  // Ensure filename has an extension — critical for video/image content type inference on signed URLs
  let finalName = fileName;
  const hasExt = /\.\w+$/.test(fileName);
  if (!hasExt && contentType && mimeToExt[contentType]) {
    finalName = `${fileName}${mimeToExt[contentType]}`;
  }

  // Tenant-scoped path: {folderPrefix}{tenantPrefix}uploads/{timestamp}-{filename}
  const scopedPrefix = tenantPrefix ? `${folderPrefix}${tenantPrefix}` : `${folderPrefix}`;
  const key = `${scopedPrefix}uploads/${Date.now()}-${finalName}`;

  // PRD-206 AC-2a: when a tenant prefix is supplied, assert the FINAL key
  // landed inside that tenant's scope before writing — defence in depth even
  // if the prefix-building logic later changes. System/super-admin paths
  // (templates/..., or an empty prefix) carry no tenant id and are skipped.
  const tenantPrefixMatch = tenantPrefix?.match(/^tenants\/([^/]+)\/$/);
  if (tenantPrefixMatch) {
    assertKeyInTenantScope(key, tenantPrefixMatch[1], { folderPrefix });
  }

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ...(contentType ? { ContentType: contentType } : {}),
    }),
  );

  return key; // Return the cloud_storage_path
}

/**
 * Scope argument for getFileUrl (PRD-206). Backward-compatible: the legacy
 * `contentTypeHint?: string` (or undefined) form still works alongside the
 * new tenant-scoped form and the explicit audited super-admin bypass.
 */
export type GetFileUrlOptions =
  | string
  | { tenantId: string; contentTypeHint?: string }
  | { bypassTenantScope: true; reason: string; contentTypeHint?: string };

/**
 * Apply the tenant-scope policy and resolve the effective contentTypeHint.
 * Tenant form asserts the key is in the caller's prefix BEFORE signing; the
 * bypass form skips the assertion but emits an audit line.
 */
function applyGetFileUrlScope(
  key: string,
  options: GetFileUrlOptions | undefined,
  folderPrefix: string,
): string | undefined {
  if (options == null || typeof options === "string") {
    return options ?? undefined;
  }
  if ("tenantId" in options) {
    assertKeyInTenantScope(key, options.tenantId, { folderPrefix });
    return options.contentTypeHint;
  }
  // Explicit, audited cross-tenant sign (PRD-215 will formalise this line).
  console.warn(
    "s3.cross_tenant_sign",
    JSON.stringify({ key, reason: options.reason }),
  );
  return options.contentTypeHint;
}

export async function getFileUrl(
  key: string,
  options?: GetFileUrlOptions,
): Promise<string> {
  const { bucketName, folderPrefix } = await getBucketConfig();
  const contentTypeHint = applyGetFileUrlScope(key, options, folderPrefix);
  const s3Client = await createS3Client();

  // Infer content type for video files so browsers can play them
  // (fixes files uploaded before ContentType was set on PutObject)
  const videoTypes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
  };
  const ext = key.match(/\.\w+$/)?.[0]?.toLowerCase() || '';
  const responseContentType = videoTypes[ext] || contentTypeHint || undefined;

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
    ...(responseContentType ? { ResponseContentType: responseContentType } : {}),
  });

  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

/** Check if an object exists in S3 without downloading it. */
export async function fileExistsInS3(key: string): Promise<boolean> {
  const s3Client = await createS3Client();
  const { bucketName } = await getBucketConfig();
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
    return true;
  } catch {
    return false;
  }
}


export async function deleteFile(key: string): Promise<void> {
  const s3Client = await createS3Client();
  const { bucketName } = await getBucketConfig();

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );
}

/**
 * Upload an entire directory to S3
 * Used for uploading marketplace templates
 */
export async function uploadDirectoryToS3(
  localPath: string,
  s3Prefix: string,
): Promise<number> {
  const s3Client = await createS3Client();
  const { bucketName } = await getBucketConfig();

  let uploadCount = 0;

  async function uploadDir(dirPath: string, prefix: string) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const s3Key = path.join(prefix, entry.name).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        // Recursively upload subdirectories
        await uploadDir(fullPath, s3Key);
      } else {
        // Upload file
        let fileContent: Buffer | string = await fs.readFile(fullPath);

        // Determine content type
        let contentType = "application/octet-stream";
        const ext = path.extname(entry.name).toLowerCase();
        const contentTypes: Record<string, string> = {
          ".tsx": "text/typescript",
          ".ts": "text/typescript",
          ".jsx": "text/javascript",
          ".js": "text/javascript",
          ".css": "text/css",
          ".json": "application/json",
          ".md": "text/markdown",
          ".txt": "text/plain",
          ".html": "text/html",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".webp": "image/webp",
          ".svg": "image/svg+xml",
          ".gif": "image/gif",
          ".ico": "image/x-icon",
          ".mp4": "video/mp4",
          ".webm": "video/webm",
          ".ogg": "video/ogg",
          ".mp3": "audio/mpeg",
          ".pdf": "application/pdf",
        };
        contentType = contentTypes[ext] || contentType;

        // SECURITY (C6): SVG is XML and can carry inline <script>,
        // event handlers, and javascript: URLs. A malicious template
        // upload could otherwise stage stored XSS that fires inside any
        // store page that loads the asset. Sanitize at upload time.
        if (ext === ".svg") {
          const raw = fileContent.toString("utf-8");
          fileContent = sanitizeSvg(raw);
        }

        // SECURITY (C6/C10): Force a Content-Disposition for HTML and
        // SVG-equivalent files so a browser navigating to a signed URL
        // does NOT render the file in the bucket origin.
        const inlineRiskExtensions = new Set([".html", ".htm", ".xhtml"]);
        const dispositionHeader = inlineRiskExtensions.has(ext)
          ? { ContentDisposition: `attachment; filename="${entry.name}"` }
          : {};

        await s3Client.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: s3Key,
            Body: fileContent,
            ContentType: contentType,
            ...dispositionHeader,
          }),
        );

        uploadCount++;
      }
    }
  }

  await uploadDir(localPath, s3Prefix);
  return uploadCount;
}

/**
 * Get and parse a JSON file from S3
 */
export async function getJsonFromS3<T = any>(key: string): Promise<T> {
  const s3Client = await createS3Client();
  const { bucketName } = await getBucketConfig();
  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: bucketName, Key: key }),
  );
  const bodyStr = await response.Body?.transformToString("utf-8");
  if (!bodyStr) throw new Error(`Empty response for S3 key: ${key}`);

  // Guard against S3 returning XML error documents instead of JSON
  const trimmed = bodyStr.trimStart();
  if (trimmed.startsWith("<?xml") || trimmed.startsWith("<Error")) {
    throw new Error(
      `S3 returned XML instead of JSON for key "${key}". This usually means the file doesn't exist or access was denied. Raw: ${trimmed.substring(0, 200)}`,
    );
  }

  try {
    return JSON.parse(bodyStr);
  } catch (e: any) {
    throw new Error(
      `Failed to parse JSON from S3 key "${key}": ${e.message}. Content starts with: ${bodyStr.substring(0, 100)}`,
    );
  }
}

/**
 * Get a text file from S3 (e.g. CSS)
 */
export async function getTextFromS3(key: string): Promise<string | null> {
  const s3Client = await createS3Client();
  const { bucketName } = await getBucketConfig();
  try {
    const response = await s3Client.send(
      new GetObjectCommand({ Bucket: bucketName, Key: key }),
    );
    return (await response.Body?.transformToString("utf-8")) || null;
  } catch {
    return null;
  }
}

/**
 * Copy all objects from one S3 prefix to another
 * Used for cloning base templates to tenant-specific paths
 */
export async function copyS3Directory(
  sourcePrefix: string,
  destPrefix: string,
): Promise<number> {
  const s3Client = await createS3Client();
  const { bucketName } = await getBucketConfig();

  let copyCount = 0;
  let continuationToken: string | undefined;

  do {
    const listResponse = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: sourcePrefix,
        ContinuationToken: continuationToken,
      }),
    );

    if (!listResponse.Contents || listResponse.Contents.length === 0) break;

    await Promise.all(
      listResponse.Contents.map(async (obj) => {
        if (!obj.Key) return;
        const relativePath = obj.Key.slice(sourcePrefix.length);
        const destKey = destPrefix + relativePath;

        await s3Client.send(
          new CopyObjectCommand({
            Bucket: bucketName,
            CopySource: encodeURI(`${bucketName}/${obj.Key}`),
            Key: destKey,
          }),
        );
        copyCount++;
      }),
    );

    continuationToken = listResponse.NextContinuationToken;
  } while (continuationToken);

  return copyCount;
}

/**
 * Delete all objects under an S3 prefix (directory-level delete)
 */
export async function deleteS3Directory(prefix: string): Promise<number> {
  const s3Client = await createS3Client();
  const { bucketName } = await getBucketConfig();

  let deleteCount = 0;
  let continuationToken: string | undefined;

  do {
    const listResponse = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    const objects = listResponse.Contents || [];
    if (objects.length > 0) {
      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: bucketName,
          Delete: {
            Objects: objects.map((obj) => ({ Key: obj.Key! })),
          },
        }),
      );
      deleteCount += objects.length;
    }

    continuationToken = listResponse.NextContinuationToken;
  } while (continuationToken);

  return deleteCount;
}
