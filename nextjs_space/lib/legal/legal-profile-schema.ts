import { z } from "zod";

/**
 * Validation for a tenant's legal profile.
 *
 * These values are published verbatim into a legal document, so validation is
 * about substance rather than shape: a controller identity that is blank or a
 * placeholder produces a notice that fails the Art. 13 duty it exists to
 * discharge, which is worse than publishing nothing.
 *
 * See docs/PRDS/prd-data-protection-remediation.md (US-008).
 */

const required = (field: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `${field} is required.`)
    .max(max, `${field} must be ${max} characters or fewer.`);

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === "" ? null : (value ?? null)));

export const legalProfileSchema = z.object({
  controllerLegalName: required("Legal entity name", 2, 200),
  registeredAddress: required("Registered address", 10, 500),
  privacyContactEmail: z
    .string()
    .trim()
    .min(1, "Privacy contact email is required.")
    .max(200)
    .email("Enter a valid email address."),
  icoRegistrationNumber: optional(64),
  dpoName: optional(200),
  dpoContact: optional(200),
  ukRepresentative: optional(300),
});

export type LegalProfileInput = z.input<typeof legalProfileSchema>;
export type LegalProfileParsed = z.output<typeof legalProfileSchema>;

/** Blank form state, pre-filled from the tenant's trading details. */
export function emptyLegalProfile(defaults?: {
  businessName?: string | null;
  address?: string | null;
}): LegalProfileInput {
  return {
    controllerLegalName: defaults?.businessName ?? "",
    registeredAddress: defaults?.address ?? "",
    privacyContactEmail: "",
    icoRegistrationNumber: "",
    dpoName: "",
    dpoContact: "",
    ukRepresentative: "",
  };
}
