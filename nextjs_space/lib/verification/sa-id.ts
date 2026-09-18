/**
 * South African ID number validation — Dr Green Phase 2 (BS-201).
 *
 * PURE AND BROWSER-SAFE: no zod, no Prisma, no Node APIs. The three upload
 * components import this for inline validation; the two upload routes reach
 * it through lib/verification/sa-id-schema.ts. The rules and the copy are
 * shared with Dr Green's backend validator and the WordPress plugin, and all
 * three are proven against one vector file (__tests__/sa-id-vectors.json).
 *
 * Rules, in order — the first failure is the reason:
 *   1. strip whitespace, exactly 13 characters                  → "length"
 *   2. all 13 are digits                                        → "digits"
 *   3. YYMMDD is a real calendar date in the 1900s or the 2000s
 *      that is not after today (either century is accepted)    → "date"
 *   4. digit 11 is 0, 1 or 2                                    → "citizenship"
 *   5. Luhn over all 13 digits                                  → "checksum"
 * Digit 12 is not enforced (legacy values exist). Nothing is derived from the
 * number: no date of birth, sex or citizenship leaves this module.
 */

export type SaIdInvalidReason =
  | "length"
  | "digits"
  | "date"
  | "citizenship"
  | "checksum";

export type SaIdValidation =
  | { valid: true; normalised: string }
  | { valid: false; reason: SaIdInvalidReason };

export const SA_ID_LENGTH = 13;

/** Error code on the 400 from both upload routes; Dr Green uses the same one. */
export const SA_ID_INVALID_CODE = "SA_ID_INVALID";

/** The one message shown everywhere: forms, routes, and Dr Green's own 400. */
export const SA_ID_INVALID_MESSAGE =
  "That does not look like a valid South African ID number. Check the 13 digits and try again.";

/** The document type the rules apply to (Dr Green's DocumentType.ID). */
export const SA_ID_DOCUMENT_TYPE = "ID";

const CENTURIES = [1900, 2000] as const;
const ALLOWED_CITIZENSHIP_DIGITS = new Set(["0", "1", "2"]);
const THIRTEEN_DIGITS = /^\d{13}$/;

export function normaliseSouthAfricanId(input: string): string {
  return (input ?? "").replace(/\s+/g, "");
}

function daysInMonth(year: number, month: number): number {
  // Day 0 of the following month is the last day of this one (month is 1-12).
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isRealPastDate(
  year: number,
  month: number,
  day: number,
  now: Date,
): boolean {
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth(year, month)) return false;
  return Date.UTC(year, month - 1, day) <= now.getTime();
}

/** YYMMDD is acceptable when EITHER century yields a real, non-future date. */
function isPlausibleBirthDate(yymmdd: string, now: Date): boolean {
  const yy = Number(yymmdd.slice(0, 2));
  const mm = Number(yymmdd.slice(2, 4));
  const dd = Number(yymmdd.slice(4, 6));
  return CENTURIES.some((century) => isRealPastDate(century + yy, mm, dd, now));
}

/** Luhn over the whole string; the last digit is the check digit. */
function passesLuhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let digit = digits.charCodeAt(digits.length - 1 - i) - 48;
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

export function validateSouthAfricanId(
  input: string,
  options: { now?: Date } = {},
): SaIdValidation {
  const normalised = normaliseSouthAfricanId(input);
  if (normalised.length !== SA_ID_LENGTH) return { valid: false, reason: "length" };
  if (!THIRTEEN_DIGITS.test(normalised)) return { valid: false, reason: "digits" };
  if (!isPlausibleBirthDate(normalised.slice(0, 6), options.now ?? new Date())) {
    return { valid: false, reason: "date" };
  }
  if (!ALLOWED_CITIZENSHIP_DIGITS.has(normalised[10])) {
    return { valid: false, reason: "citizenship" };
  }
  if (!passesLuhn(normalised)) return { valid: false, reason: "checksum" };
  return { valid: true, normalised };
}

/**
 * The inline field error for an upload form: the shared copy when the rules
 * apply (South African rules on, document type ID) and the number fails,
 * otherwise null. An empty number is NOT an SA-ID error — every form has its
 * own "please enter your document number" message for that.
 */
export function saIdFieldError(params: {
  documentType: string;
  documentNumber: string;
  enforce: boolean;
}): string | null {
  if (!params.enforce || params.documentType !== SA_ID_DOCUMENT_TYPE) return null;
  if (normaliseSouthAfricanId(params.documentNumber) === "") return null;
  return validateSouthAfricanId(params.documentNumber).valid
    ? null
    : SA_ID_INVALID_MESSAGE;
}
