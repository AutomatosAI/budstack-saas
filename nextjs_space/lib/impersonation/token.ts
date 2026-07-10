import crypto from "crypto";

/**
 * PRD-302 impersonation bearer tokens.
 *
 * The raw token lives ONLY in the httpOnly session cookie; the DB persists its
 * SHA-256 hash. A database leak therefore cannot be replayed as a live session
 * cookie, and lookups stay O(1) via the unique tokenHash index.
 */

/** 256 bits of CSPRNG entropy, hex-encoded (64 chars). */
export function generateImpersonationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Deterministic SHA-256 hex digest used as the DB lookup key. */
export function hashImpersonationToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}
