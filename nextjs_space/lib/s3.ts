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
import { createS3Client, getBucketConfig } from "./aws-config";
import { promises as fs } from "fs";
import path from "path";

export async function uploadFile(
  buffer: Buffer,
  fileName: string,
): Promise<string> {
  const s3Client = await createS3Client();
  const { bucketName, folderPrefix } = await getBucketConfig();
  const key = `${folderPrefix}uploads/${Date.now()}-${fileName}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
    }),
  );

  return key; // Return the cloud_storage_path
}

export async function getFileUrl(key: string): Promise<string> {
  const s3Client = await createS3Client();
  const { bucketName } = await getBucketConfig();

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
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

/**
 * Get a signed URL for an S3 key, trying a primary path first and falling back
 * to an alternative path if the primary doesn't exist. Useful for tenant assets
 * that may live in the base template path rather than the tenant's clone path.
 */
export async function getFileUrlWithFallback(primaryKey: string, fallbackKey: string): Promise<string> {
  // Check existence and pre-generate fallback URL in parallel to avoid sequential round-trips
  const [exists, fallbackUrl] = await Promise.all([
    fileExistsInS3(primaryKey),
    getFileUrl(fallbackKey),
  ]);
  return exists ? await getFileUrl(primaryKey) : fallbackUrl;
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
        const fileContent = await fs.readFile(fullPath);

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

        await s3Client.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: s3Key,
            Body: fileContent,
            ContentType: contentType,
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
  return JSON.parse(bodyStr);
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
