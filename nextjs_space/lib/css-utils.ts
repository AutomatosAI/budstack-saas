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
 * 2. Strip :root --tenant-color-* declarations — colors are owned by the
 *    branding form / designSystem and must not be re-declared by raw CSS.
 *    --tenant-font-* IS preserved: templates legitimately declare font
 *    tokens in styles.css :root, and TenantThemeProvider only overwrites
 *    them when designSystem.typography is populated.
 *
 * Note: @import is stripped here. Use extractGoogleFontsImports() BEFORE
 * calling sanitizeCss to preserve Google Fonts URLs as <link> tags.
 *
 * Tag-breakout: this CSS is injected via dangerouslySetInnerHTML inside a
 * <style> element, so a payload like `</style><script>…` would escape the
 * style context. We strip `<` only when it starts a tag (followed by a
 * letter, `/`, or `!`). This preserves CSS child combinators (`#id > x`)
 * and media range queries (`@media (width < 700px)`, `<=`), where `<`/`>`
 * are followed by whitespace, a digit, or `=`.
 */
export function sanitizeCss(css?: string | null): string {
  if (!css) return '';
  let result = css
    .replace(/<(?=[a-zA-Z!/])/g, '')
    .replace(/@import[^;]+;/gi, '')
    .replace(/@charset[^;]+;/gi, '')
    .replace(/url\s*\(\s*(['"]?)\s*javascript\s*:/gi, 'url($1blocked:')
    .replace(/url\s*\(\s*(['"]?)\s*data\s*:/gi, 'url($1blocked:')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/behavior\s*:[^;]+;/gi, '')
    .replace(/-moz-binding\s*:[^;]+;/gi, '')
    .replace(/javascript\s*:/gi, '');

  // Strip :root --tenant-color-* — colors come exclusively from designSystem.
  // --tenant-font-* is intentionally NOT stripped (see fn header).
  result = result.replace(/:root\s*\{([^}]*)\}/g, (_match, body: string) => {
    const cleaned = body
      .split('\n')
      .filter((line: string) => !line.match(/--tenant-color-/))
      .join('\n')
      .trim();
    return cleaned ? `:root {\n${cleaned}\n}` : '';
  });

  return result;
}
