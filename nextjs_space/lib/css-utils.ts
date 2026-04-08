/**
 * Sanitize CSS from S3/external sources.
 *
 * 1. Strip dangerous patterns (XSS, injection)
 * 2. Strip :root --tenant-color-* and --tenant-font-* declarations
 *    — tenant colors come from designSystem → TenantThemeProvider only
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
