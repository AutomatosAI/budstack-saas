/**
 * Extract Google Fonts @import URLs from CSS before sanitisation strips them.
 * Whitelisted to fonts.googleapis.com — anything else is dropped.
 * Returned URLs should be injected as <link> tags by the caller so fonts still
 * load after the @import declarations are removed by sanitizeCss.
 */
export function extractGoogleFontsImports(css?: string | null): string[] {
  if (!css) return [];
  const urls = new Set<string>();
  const importRe = /@import\s+url\(\s*(['"]?)(https:\/\/fonts\.googleapis\.com\/[^'")\s]+)\1\s*\)\s*;/gi;
  for (const match of css.matchAll(importRe)) {
    if (match[2]) urls.add(match[2]);
  }
  return Array.from(urls);
}

/**
 * Sanitize CSS from S3/external sources.
 *
 * 1. Strip dangerous patterns (XSS, injection)
 * 2. Strip :root --tenant-color-* and --tenant-font-* declarations
 *    — tenant colors come from designSystem → TenantThemeProvider only
 *
 * Note: @import is stripped here. Use extractGoogleFontsImports() BEFORE
 * calling sanitizeCss to preserve Google Fonts URLs as <link> tags.
 */
export function sanitizeCss(css?: string | null): string {
  if (!css) return '';
  let result = css
    .replace(/@import[^;]+;/gi, '')
    .replace(/@charset[^;]+;/gi, '')
    .replace(/url\s*\(\s*(['"]?)\s*javascript\s*:/gi, 'url($1blocked:')
    .replace(/url\s*\(\s*(['"]?)\s*data\s*:/gi, 'url($1blocked:')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/behavior\s*:[^;]+;/gi, '')
    .replace(/-moz-binding\s*:[^;]+;/gi, '')
    .replace(/javascript\s*:/gi, '');

  // Strip :root tenant color/font vars — designSystem is the single source
  result = result.replace(/:root\s*\{([^}]*)\}/g, (_match, body: string) => {
    const cleaned = body
      .split('\n')
      .filter((line: string) => !line.match(/--tenant-color-|--tenant-font-/))
      .join('\n')
      .trim();
    return cleaned ? `:root {\n${cleaned}\n}` : '';
  });

  return result;
}
