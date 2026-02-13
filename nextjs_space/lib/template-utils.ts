import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";
import AdmZip from "adm-zip";
import { SECTION_REGISTRY } from "@/lib/section-registry";

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
        const buffer = await response.buffer();
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

    // Extract ZIP
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(tempDir, true);

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
