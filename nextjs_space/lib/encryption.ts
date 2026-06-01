import crypto from "crypto";
import { ENCRYPTION_KEY_BYTES, ENCRYPTION_SCRYPT_PARAMS } from "@/lib/constants";

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
  const derived = crypto.scryptSync(KEY, APP_SALT, ENCRYPTION_KEY_BYTES, {
    ...ENCRYPTION_SCRYPT_PARAMS,
  });
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
 * Decrypts a string produced by encrypt() (or a legacy iv:authTag:ciphertext
 * value). Fails closed: returns real plaintext, "" for empty input, or a
 * genuinely-unencrypted value during the migration window — and otherwise throws
 * DecryptionError. It NEVER returns an encrypted-looking input as if it were
 * plaintext (that fail-open path was the defect this fixes).
 */
export function decrypt(text: string, options?: DecryptOptions): string {
  if (!text) return "";

  // A value that does not look encrypted is treated as a genuinely-unencrypted
  // legacy value still awaiting migration. isEncryptedValue(text) is false here,
  // so `text` is by definition NOT ciphertext — returning it is a known-plaintext
  // passthrough, never a fail-open. Allowed ONLY inside the migration window;
  // outside it, the unexpected shape is a hard failure.
  if (!isEncryptedValue(text)) {
    if (isMigrationAllowed(options)) {
      const unmigratedPlaintext = text;
      return unmigratedPlaintext;
    }
    throw new DecryptionError("Encrypted value is not in the expected format.");
  }

  // The value IS encrypted-looking (valid v2 or legacy hex shape, per
  // isEncryptedValue). From here it must decrypt successfully or throw — it is
  // never returned as-is, even under migration.
  const parts = text.split(":");
  const isV2 = parts[0] === "v2";
  const [ivHex, authTagHex, encryptedHex] = isV2 ? parts.slice(1) : parts;

  try {
    // scrypt key for v2, legacy SHA-256 key for old ciphertext.
    const key = isV2 ? getKey() : getLegacyKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    throw new DecryptionError("Decryption failed — key may have been rotated or data corrupted.", error);
  }
}
