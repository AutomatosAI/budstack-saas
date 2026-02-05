import { promises as fs } from "fs";
import path from "path";
import { cache } from "react";

/**
 * Dynamic template loader for runtime template discovery and loading.
 * This enables hot-swapping templates without rebuilding the application.
 */

interface TemplateModule {
  default: React.ComponentType<any>;
}

// Cache for loaded template modules
const templateCache = new Map<string, TemplateModule>();

/**
 * Get all available template directories from the filesystem
 */
export async function getAvailableTemplates(): Promise<string[]> {
  const templatesDir = path.join(process.cwd(), "templates");

  try {
    const entries = await fs.readdir(templatesDir, { withFileTypes: true });
    const templateDirs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    return templateDirs;
  } catch (error) {
    console.error("[Template Loader] Error reading templates directory:", error);
    return [];
  }
}

/**
 * Check if a template exists on the filesystem
 */
export async function templateExists(slug: string): Promise<boolean> {
  const templatePath = path.join(process.cwd(), "templates", slug, "index.tsx");

  try {
    await fs.access(templatePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Dynamically load a template module at runtime
 * Uses dynamic import to load the template without requiring it to be in the static registry
 */
export async function loadTemplate(slug: string): Promise<TemplateModule | null> {
  // Check cache first
  if (templateCache.has(slug)) {
    return templateCache.get(slug)!;
  }

  // Verify template exists
  const exists = await templateExists(slug);
  if (!exists) {
    console.warn(`[Template Loader] Template not found: ${slug}`);
    return null;
  }

  try {
    // Dynamic import with runtime path
    // Next.js will handle this as a dynamic chunk
    const templatePath = path.join(process.cwd(), "templates", slug, "index.tsx");

    console.log(`[Template Loader] Loading template: ${slug} from ${templatePath}`);

    // Use dynamic import with absolute path
    const module = await import(templatePath);

    // Cache the loaded module
    templateCache.set(slug, module);

    console.log(`[Template Loader] Successfully loaded template: ${slug}`);

    return module;
  } catch (error) {
    console.error(`[Template Loader] Error loading template ${slug}:`, error);
    return null;
  }
}

/**
 * Clear the template cache (useful for hot-reloading)
 */
export function clearTemplateCache(slug?: string) {
  if (slug) {
    templateCache.delete(slug);
    console.log(`[Template Loader] Cleared cache for: ${slug}`);
  } else {
    templateCache.clear();
    console.log("[Template Loader] Cleared all template cache");
  }
}

/**
 * Preload a template (useful for prefetching)
 */
export const preloadTemplate = cache(async (slug: string) => {
  return await loadTemplate(slug);
});

/**
 * Get template component (with caching)
 */
export const getTemplateComponent = cache(async (slug: string) => {
  const module = await loadTemplate(slug);
  return module?.default || null;
});
