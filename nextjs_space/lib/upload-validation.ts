/**
 * Upload validation — file type allowlist and size limits
 */

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // SVG removed — can contain embedded JavaScript (stored XSS vector)
]);

const ALLOWED_DOCUMENT_TYPES = new Set([
  ...ALLOWED_IMAGE_TYPES,
  'application/pdf',
  'text/css',
  'application/json',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function validateUpload(
  file: File,
  options?: { allowDocuments?: boolean; maxSize?: number },
): { valid: true } | { valid: false; error: string } {
  const maxSize = options?.maxSize ?? MAX_FILE_SIZE;
  const allowed = options?.allowDocuments ? ALLOWED_DOCUMENT_TYPES : ALLOWED_IMAGE_TYPES;

  if (file.size > maxSize) {
    return { valid: false, error: `File too large (max ${Math.round(maxSize / 1024 / 1024)}MB)` };
  }

  if (!allowed.has(file.type)) {
    return { valid: false, error: `File type not allowed: ${file.type}` };
  }

  // Block double extensions (e.g., image.php.jpg)
  const name = file.name.toLowerCase();
  const dangerousExtensions = ['.php', '.exe', '.sh', '.bat', '.cmd', '.ps1', '.js', '.html', '.htm'];
  for (const ext of dangerousExtensions) {
    if (name.includes(ext)) {
      return { valid: false, error: 'File name contains blocked extension' };
    }
  }

  return { valid: true };
}
