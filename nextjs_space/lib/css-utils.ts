/**
 * Sanitize CSS from S3/external sources — strip dangerous patterns
 * (import injection, javascript: URLs, data: exfiltration, expression() for XSS,
 *  @charset override, IE behavior/binding vectors)
 *
 * Allows legitimate url() references (e.g. background-image) but blocks
 * javascript: and data: scheme URLs within them.
 */
export function sanitizeCss(css?: string | null): string {
  if (!css) return '';
  return css
    .replace(/@import[^;]+;/gi, '')
    .replace(/@charset[^;]+;/gi, '')
    // Block javascript: and data: schemes inside url() but allow normal URLs
    .replace(/url\s*\(\s*(['"]?)\s*javascript\s*:/gi, 'url($1blocked:')
    .replace(/url\s*\(\s*(['"]?)\s*data\s*:/gi, 'url($1blocked:')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/behavior\s*:[^;]+;/gi, '')
    .replace(/-moz-binding\s*:[^;]+;/gi, '')
    .replace(/javascript\s*:/gi, '');
}
