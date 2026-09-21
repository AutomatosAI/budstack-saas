import { SA_ID_INVALID_MESSAGE } from "@/lib/verification/sa-id";

/**
 * Stored upload errors (consultation_questionnaires.idDocumentError) are raw
 * upstream strings — status lines, JSON bodies — and must never be shown to a
 * customer. The dashboard may only surface a reason that was written for
 * customers in the first place; today that is the SA ID copy (BS-204).
 *
 * Pure and dependency-free so the server action that reads the flag can use
 * it without pulling Prisma into its tests.
 */
const CUSTOMER_SAFE_ID_DOCUMENT_ERRORS: readonly string[] = [SA_ID_INVALID_MESSAGE];

export function customerSafeIdDocumentError(
  stored: string | null | undefined,
): string | null {
  if (!stored) return null;
  return CUSTOMER_SAFE_ID_DOCUMENT_ERRORS.includes(stored) ? stored : null;
}
