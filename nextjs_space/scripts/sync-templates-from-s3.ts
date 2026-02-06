/**
 * S3 Template Sync Script
 * Downloads all marketplace templates from S3 to local filesystem on deployment
 *
 * This runs during Railway deployment to ensure all uploaded templates
 * are available in the filesystem for Next.js to import
 */

import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { promises as fs } from "fs";
import path from "path";
import { Readable } from "stream";

const S3_BUCKET = process.env.AWS_BUCKET_NAME;
const S3_REGION = process.env.AWS_REGION || "us-east-1";
const S3_TEMPLATES_PREFIX = "templates/"; // S3 prefix for marketplace templates
const LOCAL_TEMPLATES_DIR = path.join(process.cwd(), "templates");

// Initialize S3 client
const s3Client = new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

/**
 * Stream to buffer helper
 */
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

/**
 * Download a file from S3
 */
async function downloadFromS3(s3Key: string, localPath: string): Promise<void> {
  try {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
    });

    const response = await s3Client.send(command);
    const buffer = await streamToBuffer(response.Body as Readable);

    // Ensure directory exists
    await fs.mkdir(path.dirname(localPath), { recursive: true });

    // Write file
    await fs.writeFile(localPath, buffer);
  } catch (error: any) {
    throw new Error(`Failed to download ${s3Key}: ${error.message}`);
  }
}

/**
 * List all template files in S3
 */
async function listTemplateFiles(): Promise<string[]> {
  const files: string[] = [];
  let continuationToken: string | undefined;

  try {
    do {
      const command = new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: S3_TEMPLATES_PREFIX,
        ContinuationToken: continuationToken,
      });

      const response = await s3Client.send(command);

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key && !obj.Key.endsWith("/")) {
            // Skip directory markers
            files.push(obj.Key);
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return files;
  } catch (error: any) {
    throw new Error(`Failed to list S3 templates: ${error.message}`);
  }
}

/**
 * Sync all templates from S3 to local filesystem
 */
async function syncTemplates() {
  console.log("🔄 Syncing templates from S3...\n");

  // Validate environment
  if (!S3_BUCKET) {
    console.error("❌ AWS_BUCKET_NAME not configured");
    console.log("ℹ️  Skipping S3 template sync (using git-based templates only)");
    return;
  }

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error("❌ AWS credentials not configured");
    console.log("ℹ️  Skipping S3 template sync (using git-based templates only)");
    return;
  }

  try {
    // List all template files in S3
    console.log(`📂 Scanning S3 bucket: ${S3_BUCKET}/${S3_TEMPLATES_PREFIX}`);
    const s3Files = await listTemplateFiles();

    if (s3Files.length === 0) {
      console.log("ℹ️  No templates found in S3");
      return;
    }

    console.log(`✅ Found ${s3Files.length} file(s) in S3\n`);

    // Group files by template
    const templateMap = new Map<string, string[]>();
    for (const file of s3Files) {
      const relativePath = file.replace(S3_TEMPLATES_PREFIX, "");
      const parts = relativePath.split("/");
      if (parts.length > 1) {
        const templateSlug = parts[0];
        if (!templateMap.has(templateSlug)) {
          templateMap.set(templateSlug, []);
        }
        templateMap.get(templateSlug)!.push(file);
      }
    }

    console.log(`📦 Syncing ${templateMap.size} template(s):\n`);

    // Download each template
    let totalDownloaded = 0;
    for (const [slug, files] of templateMap.entries()) {
      console.log(`   📥 ${slug} (${files.length} files)`);

      for (const s3Key of files) {
        const relativePath = s3Key.replace(S3_TEMPLATES_PREFIX, "");
        const localPath = path.join(LOCAL_TEMPLATES_DIR, relativePath);

        try {
          await downloadFromS3(s3Key, localPath);
          totalDownloaded++;
        } catch (error: any) {
          console.error(`      ❌ Failed to download ${relativePath}: ${error.message}`);
        }
      }
    }

    console.log(`\n✅ Successfully synced ${totalDownloaded} file(s) from S3`);
    console.log(`📁 Templates available in: ${LOCAL_TEMPLATES_DIR}\n`);

    // Now run registry sync
    console.log("🔄 Updating template registry...\n");
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    try {
      const { stdout } = await execAsync("npm run sync-templates", {
        cwd: process.cwd(),
      });
      console.log(stdout);
    } catch (error: any) {
      console.error("❌ Registry sync failed:", error.message);
    }

    console.log("\n🎉 S3 template sync complete!");
  } catch (error: any) {
    console.error("\n❌ S3 sync failed:", error);
    console.log("ℹ️  Continuing with git-based templates only");
  }
}

// Run sync
syncTemplates().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
