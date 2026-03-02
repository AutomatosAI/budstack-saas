/**
 * Sanitize CSS from S3/external sources — strip dangerous patterns
 * (import injection, url() for data exfiltration, expression() for XSS,
 *  @charset override, IE behavior/binding vectors)
 */
export function sanitizeCss(css?: string | null): string {
  if (!css) return '';
  return css
    .replace(/@import[^;]+;/gi, '')
    .replace(/@charset[^;]+;/gi, '')
    .replace(/url\s*\([^)]*\)/gi, '')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/behavior\s*:[^;]+;/gi, '')
    .replace(/-moz-binding\s*:[^;]+;/gi, '')
    .replace(/javascript\s*:/gi, '');
}
