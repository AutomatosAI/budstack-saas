import { S3Client } from "@aws-sdk/client-s3";
import { getPlatformConfig } from "./platform-config";

export async function getBucketConfig() {
  const config = await getPlatformConfig();

  return {
    bucketName: config.awsBucketName || process.env.AWS_BUCKET_NAME || "",
    folderPrefix: config.awsFolderPrefix || process.env.AWS_FOLDER_PREFIX || "",
    region: config.awsRegion || process.env.AWS_REGION || "eu-west-2",
  };
}

export async function createS3Client() {
  const config = await getPlatformConfig();

  return new S3Client({
    region: config.awsRegion || process.env.AWS_REGION || "eu-west-2",
    credentials:
      config.awsAccessKeyId && config.awsSecretAccessKey
        ? {
            accessKeyId: config.awsAccessKeyId,
            secretAccessKey: config.awsSecretAccessKey,
          }
        : undefined, // Falls back to default AWS credential chain if not provided
  });
}
