/**
 * PII redaction utility.
 *
 * Redacts sensitive fields from objects before they are written to logs,
 * audit_logs.metadata, webhook payload archives, or other persisted artifacts.
 *
 * Redaction is by exact field-name match against SENSITIVE_FIELDS.
 * Recursive — descends into nested objects (but not arrays of primitives).
 */

import { ARTICLE_9_FIELDS } from "./article9";

/**
 * Single source of truth for the sensitive-field set.
 *
 * Exported (read-only) so `lib/logger.ts` can derive pino `redact` paths from
 * the SAME set rather than forking a second list — see `pinoRedactPaths()`.
 * Extend HERE; never maintain a parallel list elsewhere (AC-1a).
 *
 * The Art. 9 health names are imported from `./article9` rather than restated,
 * so the redaction list and the persistence guard share one definition.
 */
export const SENSITIVE_FIELDS: ReadonlySet<string> = new Set([
  // emails (variants seen across the codebase)
  "email",
  "userEmail",
  "oldEmail",
  "newEmail",
  "targetUserEmail",
  "customerEmail",
  "recipientEmail",
  "fromEmail",
  "toEmail",
  "clerkEmail",

  // phones
  "phone",
  "phoneNumber",
  "contactNumber",
  "oldPhone",
  "newPhone",

  // names (only PII-bearing variants — not productName/templateName/businessName)
  "firstName",
  "lastName",
  "fullName",
  "name",
  "targetUserName",
  "customerName",
  "recipientName",

  // addresses
  "address",
  "billingAddress",
  "shippingAddress",
  "addressLine1",
  "addressLine2",
  "postalCode",

  // identifiers
  "kycLink",
  "dateOfBirth",
  "dob",
  "ssn",
  "nationalId",

  // health (special-category — GDPR Art. 9). The individual field names come
  // from ARTICLE_9_FIELDS so this list and the persistence guard cannot drift.
  ...ARTICLE_9_FIELDS,
  // Container keys that wrap the above in Dr Green payloads.
  "medicalRecord",
  "medicalHistory",
  // Dr Green client/consultation payloads — never dump these whole
  "drGreenResponse",
  "drGreenPayload",
  "client",

  // credentials / secrets
  "password",
  "hashedPassword",
  "passwordHash",
  "secret",
  "apiKey",
  "secretKey",
  "accessToken",
  "refreshToken",
  "authToken",
  "smtpPassword",
  "automatosApiKey",
]);

function redactValue(value: unknown): unknown {
  if (typeof value === "string" && value.length > 0) {
    return `${value.substring(0, 2)}***`;
  }
  return "[REDACTED]";
}

/**
 * Redact sensitive fields from an arbitrary object/value.
 * Returns a new object — does not mutate input.
 */
export function sanitizeForLogging<T = unknown>(data: T): T {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForLogging(item)) as unknown as T;
  }

  if (typeof data !== "object") return data;

  const obj = data as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.has(key)) {
      sanitized[key] = redactValue(value);
    } else if (value && typeof value === "object") {
      sanitized[key] = sanitizeForLogging(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

/**
 * Test helper — exposed so tests can verify the field set without re-importing the constant.
 */
export function isSensitiveField(name: string): boolean {
  return SENSITIVE_FIELDS.has(name);
}

/**
 * Derive pino `redact.paths` from the SINGLE `SENSITIVE_FIELDS` set so the
 * logger's structured-field redaction and `sanitizeForLogging` can never drift
 * apart (AC-1a). For each field we emit:
 *   - `<field>`                 top-level key
 *   - `*.<field>`               one level of nesting (covers `body.email` etc.)
 *   - `*.*.<field>`             two levels (covers `data.client.email` etc.)
 *
 * pino's redactor matches literal paths/wildcards; this trio covers the nesting
 * depths the codebase actually logs without an unbounded scan.
 */
export function pinoRedactPaths(): string[] {
  const paths: string[] = [];
  for (const field of SENSITIVE_FIELDS) {
    paths.push(field, `*.${field}`, `*.*.${field}`);
  }
  return paths;
}
