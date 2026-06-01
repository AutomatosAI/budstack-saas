import { S3Client } from "@aws-sdk/client-s3";
import { getPlatformConfig } from "@/lib/platform-config";

export async function getBucketConfig() {
  const config = await getPlatformConfig();

  return {
    bucketName: config.awsBucketName || process.env.AWS_BUCKET_NAME || "",
    folderPrefix: config.awsFolderPrefix || process.env.AWS_FOLDER_PREFIX || "",
    region: config.awsRegion || process.env.AWS_REGION || "eu-west-2",
  };
}

let cachedS3Client: S3Client | null = null;
let clientExpiry = 0;

export async function createS3Client() {
  const now = Date.now();
  if (cachedS3Client && now < clientExpiry) return cachedS3Client;

  const config = await getPlatformConfig();

  cachedS3Client = new S3Client({
    region: config.awsRegion || process.env.AWS_REGION || "eu-west-2",
    credentials:
      config.awsAccessKeyId && config.awsSecretAccessKey
        ? {
            accessKeyId: config.awsAccessKeyId,
            secretAccessKey: config.awsSecretAccessKey,
          }
        : undefined,
  });
  clientExpiry = now + 60_000; // Refresh every 60s alongside config cache
  return cachedS3Client;
}
