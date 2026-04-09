/**
 * Upload validation — file type allowlist, size limits, and magic-byte verification
 */

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // SVG removed — can contain embedded JavaScript (stored XSS vector)
]);

const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov
]);

const ALLOWED_DOCUMENT_TYPES = new Set([
  ...ALLOWED_IMAGE_TYPES,
  'application/pdf',
  // CSS and JSON removed — CSS enables stored XSS via expression()/url()/@import,
  // JSON could be served as JSONP. Use S3 template uploads for these instead.
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB

/**
 * Client-side validation (no magic-byte check — use validateUploadBuffer for server-side)
 */
export function validateUpload(
  file: File,
  options?: { allowDocuments?: boolean; allowVideos?: boolean; maxSize?: number },
): { valid: true } | { valid: false; error: string } {
  const maxSize = options?.maxSize ?? (options?.allowVideos ? MAX_VIDEO_SIZE : MAX_FILE_SIZE);
  const allowed = options?.allowDocuments
    ? ALLOWED_DOCUMENT_TYPES
    : options?.allowVideos
      ? new Set([...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES])
      : ALLOWED_IMAGE_TYPES;

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

/**
 * Magic-byte MIME map — maps file-type detected MIME to our allowed set.
 * file-type returns undefined for text-based formats (PDF sometimes detected, sometimes not).
 */
const MAGIC_BYTE_ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/pdf',
]);

/**
 * Server-side validation with magic-byte verification.
 * Reads the first bytes of the buffer to verify actual file type matches claimed MIME.
 * Must be called on the server after receiving the upload buffer.
 */
export async function validateUploadBuffer(
  buffer: Buffer,
  claimedMime: string,
  fileName: string,
  options?: { allowDocuments?: boolean; allowVideos?: boolean; maxSize?: number },
): Promise<{ valid: true } | { valid: false; error: string }> {
  const maxSize = options?.maxSize ?? (options?.allowVideos ? MAX_VIDEO_SIZE : MAX_FILE_SIZE);

  if (buffer.length > maxSize) {
    return { valid: false, error: `File too large (max ${Math.round(maxSize / 1024 / 1024)}MB)` };
  }

  // Block dangerous extensions
  const name = fileName.toLowerCase();
  const dangerousExtensions = ['.php', '.exe', '.sh', '.bat', '.cmd', '.ps1', '.js', '.html', '.htm'];
  for (const ext of dangerousExtensions) {
    if (name.includes(ext)) {
      return { valid: false, error: 'File name contains blocked extension' };
    }
  }

  // Check claimed MIME against allowlist
  const allowed = options?.allowDocuments
    ? ALLOWED_DOCUMENT_TYPES
    : options?.allowVideos
      ? new Set([...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES])
      : ALLOWED_IMAGE_TYPES;

  if (!allowed.has(claimedMime)) {
    return { valid: false, error: `File type not allowed: ${claimedMime}` };
  }

  // Magic-byte verification — detect actual file type from content
  const { fileTypeFromBuffer } = await import('file-type');
  const detected = await fileTypeFromBuffer(buffer);

  if (detected) {
    // file-type detected a type — verify it's in our allowed set
    if (!MAGIC_BYTE_ALLOWED.has(detected.mime)) {
      return { valid: false, error: `Detected file type not allowed: ${detected.mime}` };
    }
    // Verify detected type is compatible with claimed type
    // Allow minor mismatches (e.g., video/quicktime detected as video/mp4)
    const claimedCategory = claimedMime.split('/')[0];
    const detectedCategory = detected.mime.split('/')[0];
    if (claimedCategory !== detectedCategory) {
      return { valid: false, error: `File content does not match claimed type` };
    }
  } else if (claimedMime === 'application/pdf') {
    // file-type may not detect PDF — check magic bytes manually
    const pdfMagic = buffer.subarray(0, 5).toString('ascii');
    if (pdfMagic !== '%PDF-') {
      return { valid: false, error: 'File content does not match claimed PDF type' };
    }
  } else if (!claimedMime.startsWith('image/') && !claimedMime.startsWith('video/')) {
    // For non-binary formats that file-type can't detect, reject if not in a safe category
    return { valid: false, error: 'Unable to verify file type from content' };
  }

  return { valid: true };
}
