import { S3Client } from "@aws-sdk/client-s3";
import { getPlatformConfig } from "./platform-config";

export async function getBucketConfig() {
  const config = await getPlatformConfig();

  // Env vars are authoritative for AWS; platform_config is only a fallback.
  // A bad value saved into the DB must never shadow valid Railway env vars.
  return {
    bucketName: process.env.AWS_BUCKET_NAME || config.awsBucketName || "",
    folderPrefix: process.env.AWS_FOLDER_PREFIX || config.awsFolderPrefix || "",
    region: process.env.AWS_REGION || config.awsRegion || "eu-west-2",
  };
}

let cachedS3Client: S3Client | null = null;
let clientExpiry = 0;

export async function createS3Client() {
  const now = Date.now();
  if (cachedS3Client && now < clientExpiry) return cachedS3Client;

  const config = await getPlatformConfig();

  // Env vars are authoritative for AWS credentials; platform_config is only a
  // fallback. Resolve as an atomic pair so a half-set env never mixes an env
  // key id with a DB secret. A malformed key saved into platform_config blanked
  // every storefront by shadowing the valid Railway vars — env must win.
  const credentials =
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : config.awsAccessKeyId && config.awsSecretAccessKey
        ? {
            accessKeyId: config.awsAccessKeyId,
            secretAccessKey: config.awsSecretAccessKey,
          }
        : undefined;

  cachedS3Client = new S3Client({
    region: process.env.AWS_REGION || config.awsRegion || "eu-west-2",
    credentials,
  });
  clientExpiry = now + 60_000; // Refresh every 60s alongside config cache
  return cachedS3Client;
}
