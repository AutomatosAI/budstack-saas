import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { createS3Client, getBucketConfig } from "@/lib/storage/aws-config";
import { logger } from "@/lib/logger";

/** How many snapshots to retain per template. */
const KEEP_SNAPSHOTS = 10;

/**
 * Write a pre-save snapshot of a tenant template's branding state to
 * `{s3Path}/backups/branding-<epoch-ms>.json`, pruning to the newest
 * KEEP_SNAPSHOTS. Publishing overwrites the live row and layout.json in
 * place with no draft or undo, so this is the rollback safety net: support
 * can restore a clobbered page from the sibling backups/ prefix.
 *
 * Best-effort by design — a snapshot failure must never block a save.
 * Keys are written the same way the branding route writes layout.json
 * (raw `${s3Path}/...`, no folderPrefix), so snapshots sit beside the
 * layout they back up. Epoch-millis filenames are fixed-width until the
 * year 2286, so lexicographic key order is chronological order.
 */
export async function writeBrandingSnapshot(
  s3Path: string,
  tenantId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    // Scope guard: s3Path comes from the tenant_templates row and is expected
    // to be tenant-scoped, but that invariant is historical rather than
    // structural (bare `templates/{slug}` values exist). Writing — and
    // especially PRUNING — under a shared prefix would be destructive, so
    // fail closed instead of trusting the row.
    if (!s3Path.startsWith(`tenants/${tenantId}/`)) {
      logger.info("[branding-backup] skipped — s3Path not tenant-scoped", { s3Path, tenantId });
      return;
    }
    const s3Client = await createS3Client();
    const { bucketName } = await getBucketConfig();
    const prefix = `${s3Path}/backups/`;
    const key = `${prefix}branding-${Date.now()}.json`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: Buffer.from(JSON.stringify(payload, null, 2)),
        ContentType: "application/json",
      }),
    );

    const listed = await s3Client.send(
      new ListObjectsV2Command({ Bucket: bucketName, Prefix: prefix }),
    );
    const keys = (listed.Contents || [])
      .map((o) => o.Key)
      .filter((k): k is string => Boolean(k))
      .sort();
    if (keys.length > KEEP_SNAPSHOTS) {
      const excess = keys.slice(0, keys.length - KEEP_SNAPSHOTS);
      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: bucketName,
          Delete: { Objects: excess.map((Key) => ({ Key })) },
        }),
      );
    }
  } catch (error) {
    logger.info("[branding-backup] snapshot failed (non-fatal)", {
      s3Path,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
