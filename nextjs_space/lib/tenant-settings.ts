/**
 * PRD-208 — Typed `tenant.settings` parse-on-read helper (AC-3 / AC-3a).
 *
 * `tenants.settings` is a `Json?` blob that, before this module, was read via
 * `settings as any` in ~34 sites. Reading it is a SYSTEM BOUNDARY (the value can
 * come from an older onboarding write, a manual DB edit, or a future schema
 * change) and the global rule mandates Zod validation at boundaries.
 *
 * SHARED CONTRACT (AC-3c): the write side (PRD-204, `lib/validation/tenant-
 * settings`) and this read side share the SAME conceptual schema. PRD-204 owns
 * the security-bounding / strict-rejection of scalars on write; this module owns
 * the READ. The PRD-204 schemas are re-exported below so there is one
 * discoverable place for both.
 *
 * RICH READ TYPE: the read `TenantSettings` (re-exported from `@/lib/types` and
 * consumed by the storefront/footer/theme-provider) keeps the fully-typed nested
 * objects (`businessInfo`, `businessHours`, `footer`, `pageContent`) so those
 * consumers stay typed. PRD-204's write schema leaves those structural blobs as
 * `unknown` (it only bounds the security-sensitive scalars); the read schema is
 * a richer SUPERSET for ergonomics, and `.passthrough()` keeps any unknown key
 * a live tenant relies on (OQ-4).
 *
 * Reads must NEVER throw into a render path — `parseTenantSettings` uses
 * `.safeParse` and returns a typed default on failure.
 */

import { z } from "zod";
import {
  tenantSettingsLenientSchema,
  tenantSettingsSchema,
} from "@/lib/validation/tenant-settings";

// Re-export the shared PRD-204 schemas (AC-3c) so the read side and write side
// reach the same contract from one module.
export { tenantSettingsLenientSchema, tenantSettingsSchema };

// ── Rich nested leaf schemas (read-side ergonomics) ──────────────────────────

const businessInfoSchema = z
  .object({
    phone: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    emergencyLine: z.string().optional(),
    supportHours: z.string().optional(),
  })
  .passthrough();

const businessHoursDaySchema = z
  .object({
    open: z.string().optional(),
    close: z.string().optional(),
    closed: z.boolean().optional(),
  })
  .passthrough();

const businessHoursSchema = z
  .object({
    monday: businessHoursDaySchema.optional(),
    tuesday: businessHoursDaySchema.optional(),
    wednesday: businessHoursDaySchema.optional(),
    thursday: businessHoursDaySchema.optional(),
    friday: businessHoursDaySchema.optional(),
    saturday: businessHoursDaySchema.optional(),
    sunday: businessHoursDaySchema.optional(),
  })
  .passthrough();

const labeledLinkSchema = z
  .object({ label: z.string(), url: z.string() })
  .passthrough();

const footerSchema = z
  .object({
    description: z.string().optional(),
    certifications: z
      .array(z.object({ name: z.string(), icon: z.string().optional() }).passthrough())
      .optional(),
    quickLinks: z.array(labeledLinkSchema).optional(),
    supportLinks: z.array(labeledLinkSchema).optional(),
    contactInfo: z
      .object({
        phone: z.string().optional(),
        email: z.string().optional(),
        address: z.string().optional(),
        supportHours: z.string().optional(),
      })
      .passthrough()
      .optional(),
    socialMedia: z
      .object({
        facebook: z.string().optional(),
        twitter: z.string().optional(),
        instagram: z.string().optional(),
        linkedin: z.string().optional(),
      })
      .passthrough()
      .optional(),
    legalLinks: z.array(labeledLinkSchema).optional(),
    copyrightText: z.string().optional(),
    servingArea: z.string().optional(),
    servingDetails: z.string().optional(),
  })
  .passthrough();

// `pageContent` is deeply nested + tenant-editable. Keep it permissive but typed
// as an object so consumers can index it without `unknown` friction.
const pageContentSchema = z.record(z.string(), z.any());

/**
 * The read schema: PRD-204's lenient (passthrough) contract, EXTENDED with the
 * rich nested objects above. `.merge` overrides the structural `unknown` shapes
 * with typed ones; `.passthrough()` (inherited) keeps unknown top-level keys.
 */
export const tenantSettingsReadSchema = tenantSettingsLenientSchema.merge(
  z.object({
    businessInfo: businessInfoSchema.optional(),
    businessHours: businessHoursSchema.optional(),
    footer: footerSchema.optional(),
    pageContent: pageContentSchema.optional(),
    template: z.enum(["modern", "minimalist", "bold"]).optional(),
    contactInfo: z.string().optional(),
    heroType: z.enum(["gradient", "gradient-image", "image", "video"]).optional(),
    doctorGreenCredentials: z
      .object({
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
        nftContractId: z.string().optional(),
        nftTokenId: z.string().optional(),
      })
      .passthrough()
      .optional(),
  }),
);

/**
 * The static `TenantSettings` type (PRD-208 AC-3), derived from the rich read
 * schema. Re-exported from `@/lib/types` for backward compatibility with the
 * existing importers (branding-form, branding route, footer, theme-provider).
 */
export type TenantSettings = z.infer<typeof tenantSettingsReadSchema>;

/** Result of a `parseTenantSettings` call — branch on `ok` when needed. */
export interface ParseTenantSettingsResult {
  readonly settings: TenantSettings;
  readonly ok: boolean;
  readonly issueCount: number;
}

/**
 * Internal: redacted, structured failure log. Emits the
 * `security.tenant_settings_parse_failed` signal (PRD-208 §10) WITHOUT leaking
 * the raw blob (which can contain credentials). Should be zero in steady state.
 */
function logParseFailure(
  issueCount: number,
  context?: { tenantId?: string },
): void {
  // eslint-disable-next-line no-console
  console.error("[tenant-settings] parse failed", {
    event: "security.tenant_settings_parse_failed",
    tenantId: context?.tenantId ?? "unknown",
    zodIssueCount: issueCount,
  });
}

/**
 * Parse-on-read for `tenants.settings` (PRD-208 AC-3a). The ONLY sanctioned
 * reader of `tenant.settings` — replaces every `settings as any` read.
 *
 * - Uses `.safeParse` so a malformed blob NEVER throws into a render path.
 * - On failure, logs a redacted server-side signal and returns a typed default
 *   ( `{}` — every field is optional ) so callers degrade gracefully.
 * - `null` / `undefined` (a tenant with no settings yet) is a valid empty blob.
 *
 * @param raw     The untrusted `tenants.settings` value (`Json?` from Prisma).
 * @param context Optional `{ tenantId }` for the failure log only.
 */
export function parseTenantSettings(
  raw: unknown,
  context?: { tenantId?: string },
): TenantSettings {
  return parseTenantSettingsResult(raw, context).settings;
}

/**
 * Like {@link parseTenantSettings} but returns the full result
 * (`{ settings, ok, issueCount }`) for callers/tests that need to branch on
 * validity. The render-path helper above discards everything but `settings`.
 */
export function parseTenantSettingsResult(
  raw: unknown,
  context?: { tenantId?: string },
): ParseTenantSettingsResult {
  if (raw === null || raw === undefined) {
    return { settings: {}, ok: true, issueCount: 0 };
  }

  const result = tenantSettingsReadSchema.safeParse(raw);
  if (result.success) {
    return { settings: result.data, ok: true, issueCount: 0 };
  }

  const issueCount = result.error.issues.length;
  logParseFailure(issueCount, context);
  return { settings: {}, ok: false, issueCount };
}
