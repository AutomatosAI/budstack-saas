import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createS3Client, getBucketConfig } from "./aws-config";

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
