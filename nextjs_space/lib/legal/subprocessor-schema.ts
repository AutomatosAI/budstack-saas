import { z } from "zod";

/**
 * Validation for sub-processor register entries.
 *
 * Every field here is published on a public legal page and emailed to every
 * operator, so blanks and placeholders are not acceptable input — an entry that
 * says a vendor is in "US" with transfer mechanism "TBC" tells a controller
 * nothing they can act on.
 *
 * See docs/PRDS/prd-data-protection-remediation.md (WS3, US-012).
 */

export const subprocessorSchema = z.object({
  id: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Use a lower-case slug, e.g. postmark or aws-s3."),
  name: z.string().trim().min(2, "Vendor name is required.").max(200),
  purpose: z
    .string()
    .trim()
    .min(10, "Describe what the vendor actually does with personal data.")
    .max(500),
  region: z.string().trim().min(2, "Where does the vendor process?").max(200),
  transferMechanism: z
    .string()
    .trim()
    .min(2, "State the safeguard, or that none is required.")
    .max(200),
  dpaUrl: z
    .string()
    .trim()
    .url("Enter a full URL, or leave blank.")
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  effectiveFrom: z.coerce.date(),
  notes: z.string().trim().max(2000).optional(),
  /**
   * Set only to schedule a change sooner than the DPA's 30 days. Requires a
   * reason, and both are written to the audit log — shortening operators'
   * notice period should leave a trace with a name against it.
   */
  overrideNoticePeriod: z.boolean().optional().default(false),
  overrideReason: z.string().trim().max(1000).optional(),
});

export type SubprocessorInput = z.input<typeof subprocessorSchema>;

export const subprocessorUpdateSchema = subprocessorSchema
  .omit({ id: true, overrideNoticePeriod: true, overrideReason: true })
  .partial();

export const retireSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, "Say why this vendor is being retired.")
    .max(1000),
});
