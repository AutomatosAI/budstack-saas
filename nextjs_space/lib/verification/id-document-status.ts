import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * PRD-220 Part B — persist the OUTCOME of an ID-document upload attempt on
 * the customer's consultation_questionnaires row (the per-tenant verification
 * record kyc-check and the admin views already read).
 *
 * Privacy contract: status flag + sanitized error only. Never any document
 * data (no image, number, key, or preview URL) — same rule as the
 * verify/id-document pass-through route.
 */

export type IdDocumentOutcome = "UPLOADED" | "UPLOAD_FAILED";

export const ID_DOCUMENT_ERROR_MAX_LENGTH = 500;

/** Error → short persisted string. Truncates; never returns document contents. */
export function sanitizeIdDocumentError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const trimmed = message.trim() || "Unknown upload error";
  return trimmed.length > ID_DOCUMENT_ERROR_MAX_LENGTH
    ? `${trimmed.slice(0, ID_DOCUMENT_ERROR_MAX_LENGTH - 1)}…`
    : trimmed;
}

/**
 * Record an upload outcome. Targets the row by id when the caller has it
 * (registration flow), otherwise the latest row for (tenantId, email)
 * (re-upload flow, where only the session user is known).
 *
 * NEVER throws — this runs inside best-effort paths where surfacing state
 * must not break registration or turn a successful upload into a 500. A miss
 * is logged and reported via the return value instead.
 *
 * @returns true when a row was updated.
 */
export async function recordIdDocumentOutcome(params: {
  outcome: IdDocumentOutcome;
  error?: unknown;
  questionnaireId?: string;
  tenantId?: string | null;
  email?: string;
}): Promise<boolean> {
  const { outcome, error, questionnaireId, tenantId, email } = params;

  const data = {
    idDocumentStatus: outcome,
    idDocumentError: outcome === "UPLOAD_FAILED" ? sanitizeIdDocumentError(error) : null,
    idDocumentUpdatedAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    if (questionnaireId) {
      await prisma.consultation_questionnaires.update({
        where: { id: questionnaireId },
        data,
      });
      return true;
    }

    if (tenantId && email) {
      const row = await prisma.consultation_questionnaires.findFirst({
        where: { tenantId, email: { equals: email, mode: "insensitive" } },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (!row) {
        logger.warn("[IdDocument] no questionnaire row to record outcome on", {
          tenantId,
          outcome,
        });
        return false;
      }
      await prisma.consultation_questionnaires.update({
        where: { id: row.id },
        data,
      });
      return true;
    }

    logger.warn("[IdDocument] recordIdDocumentOutcome called without a target", { outcome });
    return false;
  } catch (persistError) {
    logger.error("[IdDocument] failed to persist upload outcome", {
      outcome,
      questionnaireId,
      tenantId,
      error: persistError instanceof Error ? persistError.message : String(persistError),
    });
    return false;
  }
}
