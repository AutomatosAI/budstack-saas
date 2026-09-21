/**
 * Server-side glue for the shared SA ID validator (BS-202 / BS-204): the zod
 * refinement both upload routes apply, the 400 body they answer with, and the
 * matcher for Dr Green's own refusal coming back through the proxy.
 *
 * Kept apart from lib/verification/sa-id.ts so the upload components can
 * import the validator without dragging zod-issue plumbing into the browser.
 */
import { z } from "zod";

import {
  SA_ID_DOCUMENT_TYPE,
  SA_ID_INVALID_CODE,
  SA_ID_INVALID_MESSAGE,
  validateSouthAfricanId,
} from "@/lib/verification/sa-id";

export interface IdDocumentFields {
  documentType: string;
  documentNumber: string;
}

/**
 * `superRefine` for an ID-document object. Runs the shared validator only
 * when the tenant is South African (`enforce`) AND the document type is ID;
 * passports, driving licences and every non-SA tenant carry no check.
 */
export function saIdDocumentRefinement(enforce: boolean) {
  return (value: IdDocumentFields, ctx: z.RefinementCtx): void => {
    if (!enforce || value.documentType !== SA_ID_DOCUMENT_TYPE) return;
    const result = validateSouthAfricanId(value.documentNumber);
    if (result.valid) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["documentNumber"],
      message: SA_ID_INVALID_MESSAGE,
      params: { code: SA_ID_INVALID_CODE, reason: result.reason },
    });
  };
}

export function hasSaIdInvalidIssue(error: z.ZodError): boolean {
  return error.issues.some(
    (issue) =>
      issue.code === z.ZodIssueCode.custom &&
      issue.params?.code === SA_ID_INVALID_CODE,
  );
}

/** The 400 body both routes return — the same code and copy as Dr Green's. */
export function saIdInvalidBody(): { code: string; error: string } {
  return { code: SA_ID_INVALID_CODE, error: SA_ID_INVALID_MESSAGE };
}

/**
 * What to forward to Dr Green: the space-stripped number for a South African
 * ID (the form the backend encrypts), the number as typed for everything else.
 */
export function documentNumberToForward(
  doc: IdDocumentFields,
  enforce: boolean,
): string {
  if (!enforce || doc.documentType !== SA_ID_DOCUMENT_TYPE) return doc.documentNumber;
  const result = validateSouthAfricanId(doc.documentNumber);
  return result.valid ? result.normalised : doc.documentNumber;
}

const UPSTREAM_400 =
  /(?:Doctor Green API Error|Dr Green identity upload failed): 400\b/;

/**
 * Dr Green refused the upload with its own SA_ID_INVALID (BS-204). Only
 * reachable if the two validators drift — the storefront checks first — but a
 * 400 from upstream must still land on the number field rather than on the
 * generic failed-upload banner. Matches the error code or the shared copy in
 * whichever body shape Dr Green sends back.
 */
export function isSaIdInvalidUpstreamError(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : "";
  if (!UPSTREAM_400.test(raw)) return false;
  return raw.includes(SA_ID_INVALID_CODE) || raw.includes(SA_ID_INVALID_MESSAGE);
}
