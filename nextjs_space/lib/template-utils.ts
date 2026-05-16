import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";
import AdmZip from "adm-zip";
import { SECTION_REGISTRY } from "@/lib/section-registry";

// SECURITY (C5): Caps for ZIP extraction. Without these a malicious GitHub
// archive could ship a zip-bomb (high compression ratio) or a 100k-file
// archive that exhausts disk and inodes before validation runs.
const ZIP_MAX_TOTAL_UNCOMPRESSED = 500 * 1024 * 1024; // 500 MB
const ZIP_MAX_FILE_UNCOMPRESSED = 50 * 1024 * 1024; // 50 MB per file
const ZIP_MAX_ENTRIES = 5_000;
const ZIP_DOWNLOAD_MAX_BYTES = 100 * 1024 * 1024; // 100 MB downloaded archive

/**
 * SECURITY (C5): Extract a ZIP into `destRoot` while enforcing path
 * containment, size caps, and entry-count caps. Replaces the
 * `zip.extractAllTo(...)` call which does NOT validate paths and
 * happily honours absolute paths and `../` traversals — the classic
 * ZIP-slip pattern (CVE-2018-1002200).
 *
 * Throws on:
 *   - any entry whose resolved path escapes destRoot
 *   - absolute paths (starts with `/` or drive letter)
 *   - symlink entries
 *   - entry count > ZIP_MAX_ENTRIES
 *   - cumulative size > ZIP_MAX_TOTAL_UNCOMPRESSED
 *   - any single file > ZIP_MAX_FILE_UNCOMPRESSED
 */
async function safeExtractZip(zip: AdmZip, destRoot: string): Promise<void> {
  const resolvedRoot = path.resolve(destRoot);
  const entries = zip.getEntries();

  if (entries.length > ZIP_MAX_ENTRIES) {
    throw new Error(
      `ZIP rejected: ${entries.length} entries exceeds limit of ${ZIP_MAX_ENTRIES}`,
    );
  }

  let totalBytes = 0;

  for (const entry of entries) {
    const rawName = entry.entryName;

    // Reject absolute paths and Windows drive paths
    if (rawName.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(rawName)) {
      throw new Error(`ZIP rejected: absolute path entry "${rawName}"`);
    }

    // Reject backslash separators outright — adm-zip should normalise but
    // a hand-crafted archive may include them as part of a bypass.
    if (rawName.includes("\\")) {
      throw new Error(`ZIP rejected: backslash in entry name "${rawName}"`);
    }

    // Reject NUL bytes
    if (rawName.includes("\0")) {
      throw new Error(`ZIP rejected: NUL byte in entry name`);
    }

    const targetPath = path.resolve(resolvedRoot, rawName);
    const relativeFromRoot = path.relative(resolvedRoot, targetPath);

    // path.relative returns "" for the root itself, otherwise must not
    // start with ".." and must not be absolute.
    if (
      relativeFromRoot.startsWith("..") ||
      path.isAbsolute(relativeFromRoot)
    ) {
      throw new Error(
        `ZIP rejected: entry "${rawName}" escapes extraction root`,
      );
    }

    // Reject symlink-style entries (mode bit 0xa). adm-zip exposes
    // attributes on entry.attr; we reject if the symlink bits are set.
    const externalAttr = (entry as any).header?.attr ?? 0;
    const unixMode = (externalAttr >>> 16) & 0xffff;
    const isSymlink = (unixMode & 0xf000) === 0xa000;
    if (isSymlink) {
      throw new Error(
        `ZIP rejected: symlink entry "${rawName}" not allowed`,
      );
    }

    if (entry.isDirectory) {
      await fs.mkdir(targetPath, { recursive: true });
      continue;
    }

    const declaredSize = entry.header?.size ?? 0;
    if (declaredSize > ZIP_MAX_FILE_UNCOMPRESSED) {
      throw new Error(
        `ZIP rejected: entry "${rawName}" declared size ${declaredSize} exceeds per-file limit`,
      );
    }

    totalBytes += declaredSize;
    if (totalBytes > ZIP_MAX_TOTAL_UNCOMPRESSED) {
      throw new Error(
        `ZIP rejected: cumulative uncompressed size exceeds ${ZIP_MAX_TOTAL_UNCOMPRESSED} bytes`,
      );
    }

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    const data = entry.getData();
    if (data.length > ZIP_MAX_FILE_UNCOMPRESSED) {
      throw new Error(
        `ZIP rejected: entry "${rawName}" actual size ${data.length} exceeds per-file limit`,
      );
    }
    await fs.writeFile(targetPath, data);
  }
}

export interface TemplateConfig {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  version: string;
  author?: string;
  preview_image?: string;
  compatibility?: {
    platform?: string;
    nextjs?: string;
    features?: string[];
  };
  features?: string[];
  performance?: {
    lighthouse_score?: number;
  };
  accessibility?: {
    wcag_level?: string;
  };
  installation?: {
    steps?: string[];
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  config: TemplateConfig | null;
}

/**
 * Generate a URL-safe slug from a template name.
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Download and extract a GitHub repository to a temporary directory.
 * Tries branches in order: custom branch > main > master.
 * Returns the path to the extracted directory.
 */
export async function downloadGitHubRepo(
  githubUrl: string,
  branch?: string,
): Promise<string> {
  const githubPattern = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)(\.git)?$/;
  const match = githubUrl.replace(/\.git$/, "").match(githubPattern);

  if (!match) {
    throw new Error(
      "Invalid GitHub URL format. Expected: https://github.com/username/repo",
    );
  }

  const [, owner, repo] = match;
  const tempDir = path.join("/tmp", `template-${Date.now()}`);
  const zipPath = path.join(tempDir, "repo.zip");
  await fs.mkdir(tempDir, { recursive: true });

  try {
    const branchesToTry = [...(branch ? [branch] : []), "main", "master"];
    let downloaded = false;
    let usedBranch = "";

    for (const branchName of branchesToTry) {
      const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branchName}.zip`;
      console.log(`[Template Utils] Trying branch '${branchName}': ${zipUrl}`);

      const response = await fetch(zipUrl);
      if (response.ok) {
        // SECURITY (C5): Cap the download size before reading into memory.
        // GitHub archives are normally <30MB; reject anything > 100MB so a
        // hostile mirror can't OOM us by streaming gigabytes.
        const contentLength = parseInt(
          response.headers.get("content-length") || "0",
          10,
        );
        if (contentLength > ZIP_DOWNLOAD_MAX_BYTES) {
          throw new Error(
            `ZIP archive too large: ${contentLength} bytes (max ${ZIP_DOWNLOAD_MAX_BYTES})`,
          );
        }
        const buffer = await response.buffer();
        if (buffer.length > ZIP_DOWNLOAD_MAX_BYTES) {
          throw new Error(
            `ZIP archive too large: ${buffer.length} bytes (max ${ZIP_DOWNLOAD_MAX_BYTES})`,
          );
        }
        await fs.writeFile(zipPath, buffer);
        downloaded = true;
        usedBranch = branchName;
        break;
      }
    }

    if (!downloaded) {
      throw new Error(
        `Failed to download repository. Tried branches: ${branchesToTry.join(", ")}`,
      );
    }

    console.log(`[Template Utils] ZIP downloaded from branch '${usedBranch}'`);

    // SECURITY (C5): Extract ZIP with per-entry path validation, size
    // caps, and symlink rejection. Replaces unsafe extractAllTo().
    const zip = new AdmZip(zipPath);
    await safeExtractZip(zip, tempDir);

    // Find the extracted folder (GitHub adds repo-name-branch format)
    const extractedDirs = await fs.readdir(tempDir);
    const repoDir = extractedDirs.find((dir) => dir.startsWith(`${repo}-`));

    if (!repoDir) {
      throw new Error("Could not find extracted repository directory");
    }

    const extractPath = path.join(tempDir, repoDir);
    console.log(`[Template Utils] Extracted to: ${extractPath}`);

    return extractPath;
  } catch (error) {
    // Clean up temp dir on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Validate template files in a directory.
 * Checks for required files and validates section types against the registry.
 */
export async function validateTemplateFiles(
  dirPath: string,
): Promise<ValidationResult> {
  const errors: string[] = [];

  // Check for required files
  const requiredFiles = [
    "template.config.json",
    "layout.json",
    "defaults.json",
    "styles.css",
  ];

  for (const file of requiredFiles) {
    try {
      await fs.access(path.join(dirPath, file));
    } catch {
      errors.push(`Missing required file: ${file}`);
    }
  }

  // If template.config.json is missing, we can't continue validation
  if (errors.some((e) => e.includes("template.config.json"))) {
    return { valid: false, errors, config: null };
  }

  // Parse and validate template.config.json
  let config: TemplateConfig;
  try {
    const configContent = await fs.readFile(
      path.join(dirPath, "template.config.json"),
      "utf-8",
    );
    config = JSON.parse(configContent);
  } catch (e: any) {
    errors.push(`Invalid template.config.json: ${e.message}`);
    return { valid: false, errors, config: null };
  }

  // Validate layout.json section types if the file exists
  try {
    const layoutContent = await fs.readFile(
      path.join(dirPath, "layout.json"),
      "utf-8",
    );
    const layout = JSON.parse(layoutContent);

    if (layout.sections && Array.isArray(layout.sections)) {
      const registeredTypes = Object.keys(SECTION_REGISTRY);
      for (const section of layout.sections) {
        if (section.type && !registeredTypes.includes(section.type)) {
          errors.push(
            `Unknown section type '${section.type}' in layout.json. Available: ${registeredTypes.join(", ")}`,
          );
        }
      }
    }

    // Validate navigation type
    if (layout.navigation && !SECTION_REGISTRY[layout.navigation]) {
      errors.push(
        `Unknown navigation type '${layout.navigation}' in layout.json`,
      );
    }

    // Validate footer type
    if (layout.footer && !SECTION_REGISTRY[layout.footer]) {
      errors.push(`Unknown footer type '${layout.footer}' in layout.json`);
    }
  } catch {
    // layout.json missing already reported above
  }

  return {
    valid: errors.length === 0,
    errors,
    config: errors.length === 0 ? config : config,
  };
}

/**
 * Clean up a temporary directory. Safe to call even if dir doesn't exist.
 */
export async function cleanupTempDir(dirPath: string): Promise<void> {
  try {
    // Walk up to find the /tmp/template-* parent
    const parts = dirPath.split(path.sep);
    const tmpIdx = parts.indexOf("tmp");
    if (tmpIdx >= 0 && parts[tmpIdx + 1]?.startsWith("template-")) {
      const tempRoot = path.join("/", ...parts.slice(0, tmpIdx + 2));
      await fs.rm(tempRoot, { recursive: true, force: true });
    } else {
      await fs.rm(dirPath, { recursive: true, force: true });
    }
  } catch {
    // Ignore cleanup errors
  }
}
