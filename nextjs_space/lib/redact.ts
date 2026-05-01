/**
 * PII redaction utility.
 *
 * Redacts sensitive fields from objects before they are written to logs,
 * audit_logs.metadata, webhook payload archives, or other persisted artifacts.
 *
 * Redaction is by exact field-name match against SENSITIVE_FIELDS.
 * Recursive — descends into nested objects (but not arrays of primitives).
 */

const SENSITIVE_FIELDS = new Set([
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

  // phones
  "phone",
  "phoneNumber",
  "oldPhone",
  "newPhone",

  // names (only PII-bearing variants — not productName/templateName/businessName)
  "firstName",
  "lastName",
  "fullName",
  "targetUserName",
  "customerName",
  "recipientName",

  // addresses
  "address",
  "billingAddress",
  "shippingAddress",
  "addressLine1",
  "addressLine2",

  // identifiers
  "kycLink",
  "dateOfBirth",
  "dob",
  "ssn",
  "nationalId",

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
