import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY = process.env.ENCRYPTION_KEY;
const DEFAULT_MIGRATION_DEADLINE = process.env.ENCRYPTION_MIGRATION_DEADLINE;

// Fixed salt for the legacy SHA-256 key derivation (backwards-compatible decryption only)
const LEGACY_KEY_CACHE = new Map<string, Buffer>();

// scrypt-derived key cache (avoid re-deriving on every call)
const SCRYPT_KEY_CACHE = new Map<string, Buffer>();

/** Derive key using scrypt (secure KDF) with a fixed application salt. */
function getKey(): Buffer {
  if (!KEY) {
    throw new Error("ENCRYPTION_KEY is not defined in environment variables");
  }
  const cached = SCRYPT_KEY_CACHE.get(KEY);
  if (cached) return cached;

  // Use a fixed application-level salt — the per-message IV provides randomness.
  // This replaces the old SHA-256 hash with a proper KDF that's resistant to brute-force.
  const APP_SALT = Buffer.from("budstack-encryption-v2", "utf8");
  const derived = crypto.scryptSync(KEY, APP_SALT, 32, { N: 16384, r: 8, p: 1 });
  SCRYPT_KEY_CACHE.set(KEY, derived);
  return derived;
}

/** Legacy key derivation for migrating old ciphertext. */
function getLegacyKey(): Buffer {
  if (!KEY) {
    throw new Error("ENCRYPTION_KEY is not defined in environment variables");
  }
  const cached = LEGACY_KEY_CACHE.get(KEY);
  if (cached) return cached;

  const derived = crypto.createHash("sha256").update(String(KEY)).digest();
  LEGACY_KEY_CACHE.set(KEY, derived);
  return derived;
}

type DecryptOptions = {
  allowUnencryptedMigration?: boolean;
  migrationDeadline?: string;
};

function isMigrationAllowed(options?: DecryptOptions): boolean {
  if (!options?.allowUnencryptedMigration) {
    return false;
  }

  const deadline = options.migrationDeadline ?? DEFAULT_MIGRATION_DEADLINE;
  if (!deadline) {
    return false;
  }

  const deadlineDate = new Date(deadline);
  if (Number.isNaN(deadlineDate.getTime())) {
    return false;
  }

  return Date.now() < deadlineDate.getTime();
}

export class DecryptionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "DecryptionError";
  }
}

/**
 * Recognises an encrypted value shape: 4-part v2 (`v2:iv:authTag:ciphertext`) or
 * 3-part legacy (`iv:authTag:ciphertext`), each segment non-empty hex. Single
 * source of truth so callers never misclassify a v2 value as legacy and skip
 * decryption. Shape-only — it does NOT decrypt or verify the auth tag.
 */
export function isEncryptedValue(text: string): boolean {
  if (!text) return false;

  const parts = text.split(":");
  const isHex = (segment: string): boolean =>
    segment.length > 0 && /^[0-9a-f]+$/i.test(segment);

  // v2 shape: v2:iv:authTag:ciphertext
  if (parts[0] === "v2") {
    return parts.length === 4 && parts.slice(1).every(isHex);
  }

  // legacy shape: iv:authTag:ciphertext
  return parts.length === 3 && parts.every(isHex);
}

/**
 * Encrypts a string using AES-256-GCM with scrypt-derived key.
 * Returns format: v2:iv:authTag:ciphertext (hex encoded)
 * The v2 prefix distinguishes from legacy SHA-256 derived ciphertext.
 */
export function encrypt(text: string): string {
  if (!text) return "";

  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `v2:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts a string. Supports both formats:
 *   - v2:iv:authTag:ciphertext (scrypt-derived key)
 *   - iv:authTag:ciphertext (legacy SHA-256 key — auto-detected)
 * Throws DecryptionError on failure instead of returning empty string.
 */
export function decrypt(text: string, options?: DecryptOptions): string {
  if (!text) return "";

  const parts = text.split(":");
  const isV2 = parts[0] === "v2";

  // v2 format: v2:iv:authTag:ciphertext (4 parts)
  // legacy format: iv:authTag:ciphertext (3 parts)
  const expectedParts = isV2 ? 4 : 3;

  if (parts.length !== expectedParts) {
    if (isMigrationAllowed(options)) {
      return text;
    }
    throw new DecryptionError("Encrypted value is not in the expected format.");
  }

  const [ivHex, authTagHex, encryptedHex] = isV2 ? parts.slice(1) : parts;

  try {
    // Use scrypt key for v2, legacy SHA-256 key for old ciphertext
    const key = isV2 ? getKey() : getLegacyKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    // If v2 decryption failed, don't try legacy — the prefix is explicit
    if (!isV2) {
      // Legacy format might fail if key was already rotated — try migration
      if (isMigrationAllowed(options)) {
        return text;
      }
    }
    throw new DecryptionError("Decryption failed — key may have been rotated or data corrupted.", error);
  }
}
