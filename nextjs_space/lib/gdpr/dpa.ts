/**
 * Data Processing Agreement (GDPR Art. 28) constants + validation (PRD-213).
 *
 * Client-safe: this module has NO server-only imports (no Prisma, no audit
 * log), so it can be imported by both the onboarding client form and the
 * onboarding server route without leaking server code into the client bundle.
 */

import { z } from "zod";

/**
 * Current Data Processing Agreement version. MUST match the version surfaced
 * on app/dpa/page.tsx. Bump this string when the DPA text changes so
 * re-acceptance can be enforced.
 */
export const DPA_VERSION = "2026-04-25.v1";

/** Audit action for a tenant accepting the DPA at onboarding. */
export const DPA_ACCEPTED_AUDIT_ACTION = "tenant.dpa_accepted";

/**
 * Zod schema fragment for the DPA click-through fields on the onboarding
 * payload. `dpaVersion` must equal the current DPA_VERSION (stale/missing
 * versions are rejected, AC-2a); `dpaAcceptedAt` is an ISO datetime string.
 */
export const dpaAcceptanceSchema = z.object({
  dpaVersion: z.literal(DPA_VERSION, {
    errorMap: () => ({
      message: "A current Data Processing Agreement acceptance is required.",
    }),
  }),
  dpaAcceptedAt: z.string().datetime(),
});

export type DpaAcceptance = z.infer<typeof dpaAcceptanceSchema>;
