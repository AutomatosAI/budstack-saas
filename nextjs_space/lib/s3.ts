import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
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
  console.log("[DEBUG] getFileUrl for key:", key, "Bucket:", bucketName);

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
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
