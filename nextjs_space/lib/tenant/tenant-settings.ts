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
  /**
   * Top-level keys dropped to make the rest of the blob parse. Empty when `ok`.
   * Names only, never values — this is safe to log (see {@link logParseFailure}).
   */
  readonly droppedKeys: readonly string[];
}

/**
 * Internal: redacted, structured failure log. Emits the
 * `security.tenant_settings_parse_failed` signal (PRD-208 §10) WITHOUT leaking
 * the raw blob (which can contain credentials). Should be zero in steady state.
 *
 * `droppedKeys` carries KEY NAMES only. They come from the schema's own shape,
 * not from tenant data, so they cannot leak a stored value — and without them a
 * failure signal says only "something was wrong", which is what let a single bad
 * key sit in production unattributed (see {@link parseTenantSettingsResult}).
 */
function logParseFailure(
  issueCount: number,
  droppedKeys: readonly string[],
  context?: { tenantId?: string },
): void {
  // eslint-disable-next-line no-console
  console.error("[tenant-settings] parse failed", {
    event: "security.tenant_settings_parse_failed",
    tenantId: context?.tenantId ?? "unknown",
    zodIssueCount: issueCount,
    droppedKeys,
  });
}

/** Max key names in one failure log — a bounded blob can still hold many keys. */
const MAX_LOGGED_DROPPED_KEYS = 20;

/**
 * The top-level key each Zod issue is rooted at, deduped.
 *
 * A nested issue (`businessInfo.phone`) is attributed to its top-level owner,
 * so dropping is coarser than the issue but always terminates: removing the key
 * removes every issue rooted at it. An issue with an EMPTY path is not
 * attributable to any key (the blob itself is the wrong type, e.g. a string),
 * and is reported as such by returning no key for it.
 */
function topLevelIssueKeys(issues: readonly z.ZodIssue[]): string[] {
  const keys = new Set<string>();
  for (const issue of issues) {
    const [first] = issue.path;
    if (typeof first === "string") keys.add(first);
  }
  return [...keys];
}

/**
 * Parse-on-read for `tenants.settings` (PRD-208 AC-3a). The ONLY sanctioned
 * reader of `tenant.settings` — replaces every `settings as any` read.
 *
 * - Uses `.safeParse` so a malformed blob NEVER throws into a render path.
 * - On failure, drops only the offending top-level keys and keeps the rest; logs
 *   a redacted server-side signal either way. Falls back to `{}` (every field is
 *   optional) when nothing can be salvaged.
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
 * (`{ settings, ok, issueCount, droppedKeys }`) for callers/tests that need to
 * branch on validity. The render-path helper above discards all but `settings`.
 *
 * WHY THIS DEGRADES PER KEY RATHER THAN AS A UNIT — the defect that forced it:
 * a tenant's `letterSpacingPreset` held the letter-spacing MAP instead of one of
 * its keys (`app/tenant-admin/branding/branding-form-initial-data.ts` used to
 * read the design system's whole `typography.letterSpacing` node into a `string`
 * field). That is ONE cosmetic key, and it made this function return `{}` on
 * EVERY storefront render, which silently switched off that store's Search
 * Console and Bing verification tags, its GA4 tag, its tagline, its AI-crawler
 * policy, its social links and its cookie-banner copy. Google reported the
 * verification tag as missing from `<head>`, which it was — the token never
 * survived the parse. Nothing was logged beyond an unattributed issue count.
 *
 * Three call sites had already reasoned about this failure mode in comments —
 * `reorderReminderDays`, the three verification keys, `aiCrawlerPolicy` and
 * `socialLinks` are each bounded loosely HERE and pinned exactly by their own
 * route/reader precisely so they could not take the blob down as a unit. That
 * defends the keys someone thought of; it does not defend the blob. A cosmetic
 * key nobody listed did the damage instead, so the containment belongs here, in
 * the parser, where it holds for every key including the ones not yet written.
 *
 * The drop is coarse ON PURPOSE: a nested issue takes its whole top-level key
 * with it. Salvaging a partially-valid `businessInfo` would mean guessing which
 * half a caller can trust, and a caller reading an object this module has
 * already rewritten is worse than a caller reading a default.
 */
export function parseTenantSettingsResult(
  raw: unknown,
  context?: { tenantId?: string },
): ParseTenantSettingsResult {
  if (raw === null || raw === undefined) {
    return { settings: {}, ok: true, issueCount: 0, droppedKeys: [] };
  }

  const result = tenantSettingsReadSchema.safeParse(raw);
  if (result.success) {
    return { settings: result.data, ok: true, issueCount: 0, droppedKeys: [] };
  }

  const issueCount = result.error.issues.length;
  const failedKeys = topLevelIssueKeys(result.error.issues);

  // No attributable key (the blob itself is not an object), or dropping them
  // still does not parse — the typed default is all that is left.
  const salvageable =
    failedKeys.length > 0 &&
    typeof raw === "object" &&
    !Array.isArray(raw);

  if (!salvageable) {
    logParseFailure(issueCount, [], context);
    return { settings: {}, ok: false, issueCount, droppedKeys: [] };
  }

  const withoutFailed = Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(
      ([key]) => !failedKeys.includes(key),
    ),
  );

  const retry = tenantSettingsReadSchema.safeParse(withoutFailed);
  const droppedKeys = failedKeys.slice(0, MAX_LOGGED_DROPPED_KEYS);
  logParseFailure(issueCount, droppedKeys, context);

  // A second failure means the remainder is bad in a way dropping cannot fix;
  // one retry, never a loop, because this runs on every storefront render.
  return retry.success
    ? { settings: retry.data, ok: false, issueCount, droppedKeys }
    : { settings: {}, ok: false, issueCount, droppedKeys };
}
