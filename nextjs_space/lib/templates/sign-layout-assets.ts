import { getFileUrl } from "@/lib/storage/s3";
import { SECTION_ASSET_KEYS, type LayoutSection } from "@/lib/types/template-layout";

/**
 * Sign S3 asset references inside section configs in place — the top-level
 * SECTION_ASSET_KEYS plus image-looking strings nested in array items
 * (e.g. categories[].imageUrl, facilities[].image, logos[].src).
 *
 * Shared by the store home, the store About page and the branding editor so
 * all three resolve assets identically.
 *
 * SECURITY (PRD-206 class): section configs are tenant-controlled JSON, so an
 * absolute key (development/, tenants/, templates/) must never be signed
 * verbatim — it could name another tenant's object. Every sign goes through
 * getFileUrl's tenant-scoped form, which asserts the key lives under
 * `tenants/{tenantId}/` before signing and throws otherwise; a rejected task
 * simply leaves the raw value in place (an unsigned key is not a usable URL),
 * mirroring the preview route's signS3Path skip behaviour. Relative keys
 * resolve under `tenantS3Path` first and are scope-checked the same way.
 */
export async function signSectionAssets(
  sections: LayoutSection[] | undefined,
  tenantS3Path: string | null,
  tenantId: string,
): Promise<void> {
  if (!sections || sections.length === 0) return;
  if (!tenantId) return;

  function signAssetUrl(val: string, contentTypeHint?: string): Promise<string> | null {
    // Never trust traversal/backslash from tenant JSON (the scope guard would
    // also reject these — this just avoids queueing doomed sign calls).
    if (val.includes("..") || val.includes("\\")) return null;
    const isAbsoluteKey = val.startsWith('development/') || val.startsWith('tenants/') || val.startsWith('templates/');
    const key = isAbsoluteKey
      ? val
      : tenantS3Path
        ? `${tenantS3Path}/${val}`
        : null;
    if (!key) return null;
    return getFileUrl(key, { tenantId, contentTypeHint });
  }

  // Collect all signing tasks, then execute in parallel
  const signingTasks: Array<{ target: any; key: string; promise: Promise<string> }> = [];
  const push = (target: any, key: string, promise: Promise<string> | null) => {
    if (promise) signingTasks.push({ target, key, promise });
  };

  for (const section of sections) {
    for (const key of SECTION_ASSET_KEYS) {
      const val = section.config?.[key];
      if (val && typeof val === 'string' && !val.startsWith('http') && !val.startsWith('/')) {
        // For videoUrl keys without a file extension, hint video/mp4 content type
        const hint = key === 'videoUrl' && !/\.\w+$/.test(val) ? 'video/mp4' : undefined;
        push(section.config, key, signAssetUrl(val, hint));
      }
    }
    // Sign asset URLs inside nested arrays (e.g. categories[].imageUrl, logos[].src)
    if (section.config) {
      for (const arrKey of Object.keys(section.config)) {
        if (Array.isArray(section.config[arrKey])) {
          for (let idx = 0; idx < section.config[arrKey].length; idx++) {
            const item = section.config[arrKey][idx];
            // Handle flat string arrays (e.g. SocialProof avatars[])
            if (typeof item === 'string' && !item.startsWith('http') && !item.startsWith('/') && (item.includes('/') || item.match(/\.(png|jpg|jpeg|webp|svg|gif)$/i))) {
              push(section.config[arrKey], String(idx), signAssetUrl(item));
              continue;
            }
            if (!item || typeof item !== 'object') continue;
            for (const itemKey of Object.keys(item)) {
              const v = (item as any)[itemKey];
              if (v && typeof v === 'string' && !v.startsWith('http') && !v.startsWith('/') && (v.includes('/') || v.match(/\.(png|jpg|jpeg|webp|svg|gif)$/i))) {
                push(item, itemKey, signAssetUrl(v));
              }
            }
          }
        }
      }
    }
  }

  // A rejected promise (out-of-scope key) leaves the raw value untouched —
  // an unsigned key is never a usable cross-tenant URL, so it won't render.
  const results = await Promise.allSettled(signingTasks.map(t => t.promise));
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      (signingTasks[i].target as any)[signingTasks[i].key] = result.value;
    }
  });
}
