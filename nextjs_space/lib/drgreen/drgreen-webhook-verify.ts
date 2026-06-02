import crypto from "crypto";

/**
 * Dr Green Webhook Verification Utility
 *
 * Shared signature verification, timestamp validation, payload type guard,
 * and sensitive data sanitization for Dr Green webhook handlers.
 */

export interface DrGreenWebhookPayload {
  event: string;
  timestamp: string;
  clientId?: string;
  orderId?: string;
  strainId?: string;
  // Flat fields — Dr Green sends these at top level, NOT nested in data
  status?: string;
  paymentStatus?: string;
  kycStatus?: string;
  adminApproval?: string;
  rejectionReason?: string;
  kycLink?: string;
  stock?: number;
  availability?: boolean;
  countryCode?: string;
  data?: Record<string, any>;
}

const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Constant-time comparison of a received signature against an expected hex
 * digest, accepting either the hex form or its base64 encoding. The length
 * guard is required because crypto.timingSafeEqual throws on length mismatch.
 */
function signatureMatchesDigest(sigClean: string, expectedHex: string): boolean {
  const expectedBase64 = Buffer.from(expectedHex, "hex").toString("base64");

  for (const expected of [expectedHex, expectedBase64]) {
    const sigBuf = Buffer.from(sigClean);
    const expBuf = Buffer.from(expected);

    if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
      return true;
    }
  }

  return false;
}

/**
 * Verify a Dr Green webhook signature as HMAC-SHA256 over the raw payload,
 * keyed by the shared secret: HMAC-SHA256(secret, rawPayload). The received
 * signature is compared in constant time against both the hex and base64
 * encodings, tolerating an optional `sha256=` prefix.
 *
 * Cutover fallback: when DRGREEN_WEBHOOK_LEGACY_HASH_ACCEPT === "true", a legacy
 * plain SHA-256(rawPayload + secret) value is ALSO accepted (HMAC is tried
 * first). The flag defaults OFF (HMAC-only), so the legacy hash is rejected
 * unless an operator explicitly opens the window during the Dr Green
 * signing-side cutover.
 */
export function verifyDrGreenWebhookSignature(
  rawPayload: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !secret) return false;

  const sigClean = signature.replace(/^sha256=/, "");

  // Primary: true HMAC-SHA256 keyed by the shared secret.
  const hmacHex = crypto.createHmac("sha256", secret).update(rawPayload).digest("hex");
  if (signatureMatchesDigest(sigClean, hmacHex)) {
    return true;
  }

  // Cutover-only fallback: legacy plain SHA-256(payload + secret), gated behind
  // an explicit opt-in flag so it is rejected by default.
  if (process.env.DRGREEN_WEBHOOK_LEGACY_HASH_ACCEPT === "true") {
    const legacyHex = crypto.createHash("sha256").update(rawPayload + secret).digest("hex");
    if (signatureMatchesDigest(sigClean, legacyHex)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate webhook timestamp to prevent replay attacks.
 * Rejects payloads older than 5 minutes or with future timestamps.
 */
export function validateWebhookTimestamp(timestamp: string): {
  valid: boolean;
  reason?: string;
} {
  if (!timestamp) {
    return { valid: false, reason: "Missing timestamp" };
  }

  const ts = new Date(timestamp).getTime();
  if (isNaN(ts)) {
    return { valid: false, reason: "Invalid timestamp format" };
  }

  const now = Date.now();
  const drift = Math.abs(now - ts);

  if (ts > now + 30_000) {
    return { valid: false, reason: "Timestamp is in the future" };
  }

  if (drift > MAX_TIMESTAMP_DRIFT_MS) {
    return { valid: false, reason: "Timestamp expired (>5min old)" };
  }

  return { valid: true };
}

/**
 * Type guard to validate incoming payload matches DrGreenWebhookPayload.
 * Validates required fields + optional flat fields (matching HealingBudStacks contract).
 */
export function validateWebhookPayload(
  payload: unknown,
): payload is DrGreenWebhookPayload {
  if (!payload || typeof payload !== "object") return false;

  const p = payload as Record<string, unknown>;

  // Required fields
  if (typeof p.event !== "string" || !p.event || p.event.length > 100) return false;
  if (typeof p.timestamp !== "string") return false;

  // Optional string fields — reject if present but wrong type or too long
  const stringFields = [
    "clientId", "orderId", "strainId", "status", "paymentStatus",
    "kycStatus", "adminApproval", "rejectionReason", "kycLink", "countryCode",
  ];
  for (const field of stringFields) {
    if (p[field] !== undefined && (typeof p[field] !== "string" || (p[field] as string).length > 500)) {
      return false;
    }
  }

  // Optional typed fields
  if (p.stock !== undefined && (typeof p.stock !== "number" || p.stock < 0)) return false;
  if (p.availability !== undefined && typeof p.availability !== "boolean") return false;
  if (p.data !== undefined && typeof p.data !== "object") return false;

  return true;
}

/**
 * Valid state transitions for client approval (matches HealingBudStacks).
 */
const VALID_STATE_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["VERIFIED", "REJECTED"],
  VERIFIED: ["REJECTED"],
  REJECTED: ["PENDING"],
};

/**
 * Validate client state transition.
 */
export function isValidStateTransition(
  currentState: string | null | undefined,
  newState: string,
): boolean {
  const current = currentState || "PENDING";
  const validNext = VALID_STATE_TRANSITIONS[current] || [];
  return validNext.includes(newState);
}

/**
 * Redact sensitive fields from payload for safe logging.
 * Re-exported from lib/redact.ts so existing webhook callers keep working.
 */
export { sanitizeForLogging } from "@/lib/security/redact";
