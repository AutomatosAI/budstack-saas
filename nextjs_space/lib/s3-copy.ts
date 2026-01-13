import { ListObjectsV2Command, CopyObjectCommand } from "@aws-sdk/client-s3";
import { createS3Client, getBucketConfig } from "./aws-config";

/**
 * Copies all objects from a source prefix to a destination prefix within the same bucket.
 * Used for cloning template assets.
 */
export async function copyDirectory(
  sourcePrefix: string,
  destinationPrefix: string,
): Promise<number> {
  const s3Client = await createS3Client();
  const { bucketName } = await getBucketConfig();

  let continuationToken: string | undefined;
  let copyCount = 0;

  console.log(
    `[S3 Copy] Starting copy from '${sourcePrefix}' to '${destinationPrefix}'`,
  );

  do {
    // 1. List objects in source
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: sourcePrefix,
      ContinuationToken: continuationToken,
    });

    const listResponse = await s3Client.send(listCommand);
    continuationToken = listResponse.NextContinuationToken;

    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      break;
    }

    // 2. Copy each object
    await Promise.all(
      listResponse.Contents.map(async (object) => {
        if (!object.Key) return;

        const relativePath = object.Key.substring(sourcePrefix.length);
        const destinationKey = destinationPrefix + relativePath;

        // Ensure encoded source key for CopySource
        const copySource = `${bucketName}/${object.Key}`;

        /*
         * Note: CopyObjectCommand requires CopySource to be URL-encoded
         * but AWS SDK v3 might handle simple paths.
         * Best practice is usually bucket/key.
         */

        await s3Client.send(
          new CopyObjectCommand({
            Bucket: bucketName,
            CopySource: encodeURI(copySource),
            Key: destinationKey,
          }),
        );

        copyCount++;
      }),
    );
  } while (continuationToken);

  console.log(`[S3 Copy] Completed. Copied ${copyCount} files.`);
  return copyCount;
}
