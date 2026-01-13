import crypto from "crypto";

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = process.env.ENCRYPTION_KEY;

// Ensure key is 32 bytes (256 bits)
function getKey(): Buffer {
  if (!KEY) {
    throw new Error("ENCRYPTION_KEY is not defined in environment variables");
  }
  // Hash the key to ensure it's 32 bytes
  return crypto.createHash("sha256").update(String(KEY)).digest();
}

/**
 * Encrypts a string using AES-256-GCM
 * Returns format: iv:authTag:ciphertext (hex encoded)
 */
export function encrypt(text: string): string {
  if (!text) return "";

  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

type DecryptOptions = {
    allowUnencryptedMigration?: boolean;
    migrationDeadline?: string;
};

const DEFAULT_MIGRATION_DEADLINE = process.env.ENCRYPTION_MIGRATION_DEADLINE;

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

type DecryptOptions = {
    allowUnencryptedMigration?: boolean;
    migrationDeadline?: string;
};

const DEFAULT_MIGRATION_DEADLINE = process.env.ENCRYPTION_MIGRATION_DEADLINE;

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

type DecryptOptions = {
    allowUnencryptedMigration?: boolean;
    migrationDeadline?: string;
};

const DEFAULT_MIGRATION_DEADLINE = process.env.ENCRYPTION_MIGRATION_DEADLINE;

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

type DecryptOptions = {
    allowUnencryptedMigration?: boolean;
    migrationDeadline?: string;
};

const DEFAULT_MIGRATION_DEADLINE = process.env.ENCRYPTION_MIGRATION_DEADLINE;

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

type DecryptOptions = {
    allowUnencryptedMigration?: boolean;
    migrationDeadline?: string;
};

const DEFAULT_MIGRATION_DEADLINE = process.env.ENCRYPTION_MIGRATION_DEADLINE;

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

type DecryptOptions = {
    allowUnencryptedMigration?: boolean;
    migrationDeadline?: string;
};

const DEFAULT_MIGRATION_DEADLINE = process.env.ENCRYPTION_MIGRATION_DEADLINE;

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

/**
 * Decrypts a string (iv:authTag:ciphertext)
 */
export function decrypt(text: string, options?: DecryptOptions): string {
    if (!text) return '';

    const parts = text.split(':');
    if (parts.length !== 3) {
        if (isMigrationAllowed(options)) {
            return text;
        }
        throw new Error('Encrypted value is not in the expected format.');
    }

  const parts = text.split(":");
  if (parts.length !== 3) {
    // Fallback: If it's not in our format, return as is (maybe it wasn't encrypted yet)
    // Or throw error. For migration safety, we can return null or error.
    console.warn("Invalid encrypted format, returning original");
    return text;
  }

  const [ivHex, authTagHex, encryptedHex] = parts;

  try {
    const key = getKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Decryption failed:", error);
    return "";
  }
}
