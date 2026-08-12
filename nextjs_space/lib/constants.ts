/**
 * Centralised policy constants (PRD-209 AC-5).
 *
 * Single source of truth for the security / size-limit numbers that were
 * previously inline literals scattered across `lib/`. Each constant is named
 * and documented with its unit so the body cap in one place and the rate
 * window in another can no longer drift independently.
 *
 * Security-sensitive values (the scrypt KDF cost) are asserted in
 * `tests/unit/constants.test.ts` so a careless edit is caught in CI.
 */

// ── Encryption (lib/security via lib/encryption.ts) ──────────────────────────

/** Derived AES-256-GCM key length, in bytes (256-bit key). */
export const ENCRYPTION_KEY_BYTES = 32;

/**
 * scrypt KDF cost parameters used to derive the AES key from `ENCRYPTION_KEY`.
 *
 * `N` (CPU/memory cost) MUST remain a power of two; lowering it weakens
 * brute-force resistance. Changing ANY value derives a DIFFERENT key and makes
 * every existing `v2:` ciphertext undecryptable — treat a change as a data
 * migration, never a tweak. Asserted in tests/unit/constants.test.ts.
 */
export const ENCRYPTION_SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;

// ── ZIP extraction caps (lib/templates via lib/template-utils.ts) ────────────
// Guard against zip-bombs (high compression ratio) and inode/disk exhaustion
// from a hostile archive before validation runs.

/** Cumulative uncompressed size cap across all entries. */
export const ZIP_MAX_TOTAL_UNCOMPRESSED = 500 * 1024 * 1024; // 500 MB
/** Per-file uncompressed size cap. */
export const ZIP_MAX_FILE_UNCOMPRESSED = 50 * 1024 * 1024; // 50 MB
/** Maximum number of entries permitted in a single archive. */
export const ZIP_MAX_ENTRIES = 5_000;
/** Maximum size of the downloaded archive before extraction. */
export const ZIP_DOWNLOAD_MAX_BYTES = 100 * 1024 * 1024; // 100 MB

// ── Upload caps (lib/storage via lib/upload-validation.ts) ───────────────────

/** Maximum size for an image/document upload. */
export const UPLOAD_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
/** Maximum size for a video upload. */
export const UPLOAD_MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB

// ── Rate limiting (lib/security via lib/rate-limit.ts) ───────────────────────

/** Default request budget per fixed window when a caller passes no override. */
export const RATE_LIMIT_DEFAULT_MAX_REQUESTS = 20;
/** Default fixed-window length, in milliseconds. */
export const RATE_LIMIT_DEFAULT_WINDOW_MS = 60_000; // 1 minute

/**
 * Newsletter signup is an unauthenticated write reachable from every
 * storefront, so it gets a tighter budget than the default: enough for a
 * visitor who mistypes their address a few times, far too little to enumerate
 * or to pump a tenant's subscriber table.
 */
export const NEWSLETTER_SUBSCRIBE_MAX_REQUESTS = 5;
export const NEWSLETTER_SUBSCRIBE_WINDOW_MS = 60_000; // 1 minute

/**
 * Confirming is a read-mostly follow of a 256-bit token, so it is metered
 * loosely — one shared corporate NAT clicking several confirmation links must
 * not be throttled — while still capping a token-guessing loop.
 */
export const NEWSLETTER_CONFIRM_MAX_REQUESTS = 20;
export const NEWSLETTER_CONFIRM_WINDOW_MS = 60_000; // 1 minute

/**
 * How long a double opt-in link stays followable. Long enough for someone who
 * subscribes on a Friday and reads their mail the next weekend; short enough
 * that a mailbox compromised months later cannot be used to manufacture
 * consent. Re-subscribing refreshes `consentAt`, so the clock restarts.
 */
export const NEWSLETTER_CONFIRM_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
