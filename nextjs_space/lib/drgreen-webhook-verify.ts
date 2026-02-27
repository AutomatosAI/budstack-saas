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

const SENSITIVE_FIELDS = new Set([
  "email",
  "phone",
  "phoneNumber",
  "name",
  "firstName",
  "lastName",
  "kycLink",
  "address",
  "dateOfBirth",
  "password",
]);

const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Verify Dr Green webhook signature using SHA-256(payload + secret).
 * Matches the HealingBudStacks reference implementation — plain hash, NOT HMAC.
 * Supports both hex and base64 encoded signatures.
 */
export function verifyDrGreenWebhookSignature(
  rawPayload: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !secret) return false;

  // Dr Green signs as SHA-256(rawPayload + secret)
  const hash = crypto.createHash("sha256");
  hash.update(rawPayload + secret);

  const expectedHex = hash.digest("hex");
  const expectedBase64 = Buffer.from(expectedHex, "hex").toString("base64");

  // Try hex comparison first, then base64
  const sigClean = signature.replace(/^sha256=/, "");

  for (const expected of [expectedHex, expectedBase64]) {
    const sigBuf = Buffer.from(sigClean);
    const expBuf = Buffer.from(expected);

    if (sigBuf.length === expBuf.length) {
      if (crypto.timingSafeEqual(sigBuf, expBuf)) {
        return true;
      }
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
 */
export function sanitizeForLogging(
  data: Record<string, any>,
): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_FIELDS.has(key)) {
      sanitized[key] =
        typeof value === "string" && value.length > 0
          ? `${value.substring(0, 2)}***`
          : "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeForLogging(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
