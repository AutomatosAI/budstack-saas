import { z } from "zod";

import {
  BING_SITE_VERIFICATION_MAX_LENGTH,
  GA4_MEASUREMENT_ID_MAX_LENGTH,
  GOOGLE_SITE_VERIFICATION_MAX_LENGTH,
} from "@/lib/seo/site-verification";

/**
 * Tenant `settings` JSON-blob validation (PRD-204 AC-4; consumed by PRD-208).
 *
 * The settings blob is a large, open-ended theming + configuration object
 * written from many routes (branding, cookie-settings, select-template,
 * onboarding, smtp, automatos, domain provisioning, ...). Two schemas are
 * exported because the live clients and the target end-state differ:
 *
 * - `tenantSettingsSchema` (.strict()) — the canonical contract. Unknown
 *   top-level keys are rejected. PRD-208 should migrate clients to send only
 *   known keys (partials) and then flip routes onto this schema under test.
 *
 * - `tenantSettingsLenientSchema` (.passthrough()) — for incremental rollout
 *   TODAY. It validates/bounds the known (security-sensitive + free-text)
 *   keys but tolerates unknown keys, because the super-admin tenant edit form
 *   round-trips the ENTIRE existing settings blob on every save
 *   (app/super-admin/tenants/[id]/tenant-edit-form.tsx). A strict schema would
 *   400 every legitimate save until that client is migrated.
 *
 * Scalars accept null and are generously capped to avoid false-rejecting
 * already-stored values on round-trip; structural sub-objects are left as
 * `unknown` (PRD-208 can tighten them with proper test coverage + a DB).
 */

const shortString = z.string().max(200).nullable();
const colorString = z.string().max(64).nullable();
const urlString = z.string().max(2048).nullable();
const styleToken = z.string().max(100).nullable();
const numericish = z.union([z.string().max(32), z.number()]).nullable();
const flag = z.boolean().nullable();
/** Structural sub-config; shape varies, bounded only by the outer body cap. */
const structural = z.unknown();

const tenantSettingsShape = {
  // Business / contact (free text the super-admin form actively edits)
  businessName: z.string().max(200).nullable().optional(),
  tagline: z.string().max(300).nullable().optional(),
  contactEmail: z.string().max(320).nullable().optional(),
  contactPhone: z.string().max(50).nullable().optional(),
  address: z.union([z.string().max(1000), z.record(z.unknown())]).nullable().optional(),
  // Email Phase 2 US-010 — the postal address printed in the email footer.
  // Deliberately separate from `address` (a storefront display value that is
  // sometimes an object): this one is a single free-text line an operator sets
  // to exactly what their jurisdiction requires marketing mail to carry, and it
  // has to stay a string because the footer prints it verbatim.
  businessAddress: z.string().max(500).nullable().optional(),
  socialMedia: structural.optional(),

  // Brand colors
  primaryColor: colorString.optional(),
  secondaryColor: colorString.optional(),
  accentColor: colorString.optional(),
  textColor: colorString.optional(),
  backgroundColor: colorString.optional(),
  headingColor: colorString.optional(),

  // Assets / URLs
  logoPath: urlString.optional(),
  logoUrl: urlString.optional(),
  faviconPath: urlString.optional(),
  faviconUrl: urlString.optional(),
  heroImagePath: urlString.optional(),
  googleFontsUrl: urlString.optional(),
  cookiePolicyUrl: urlString.optional(),

  // Typography
  fontFamily: shortString.optional(),
  headingFontFamily: shortString.optional(),
  fontSize: numericish.optional(),
  headingFontSize: numericish.optional(),
  sectionFontSize: numericish.optional(),
  heroFontSize: numericish.optional(),
  fontWeight: numericish.optional(),
  headingFontWeight: numericish.optional(),
  letterSpacingPreset: styleToken.optional(),

  // Layout / style tokens
  spacing: styleToken.optional(),
  shadowStyle: styleToken.optional(),
  glassEffect: styleToken.optional(),
  dividerStyle: styleToken.optional(),
  buttonStyle: styleToken.optional(),
  buttonSize: styleToken.optional(),
  borderRadius: styleToken.optional(),
  animationType: styleToken.optional(),
  navigationStyle: styleToken.optional(),
  footerStyle: styleToken.optional(),
  buttonHoverEffect: styleToken.optional(),
  wrapperClass: styleToken.optional(),
  useTemplatePadding: flag.optional(),

  // Free-form CSS — XSS vector, so explicitly size-capped (200 KB)
  customCSS: z.string().max(200_000).nullable().optional(),

  // Structural config blobs (shape varies — left permissive)
  sectionConfigs: structural.optional(),
  sectionColorOverrides: structural.optional(),
  navColorOverrides: structural.optional(),
  footerColorOverrides: structural.optional(),
  layoutSections: structural.optional(),
  navigationConfig: structural.optional(),
  footerConfig: structural.optional(),
  pageContent: structural.optional(),
  template: structural.optional(),

  // Cookie / analytics consent
  cookieConsentEnabled: flag.optional(),
  marketingCookiesEnabled: flag.optional(),
  analyticsEnabled: flag.optional(),
  cookieBannerMessage: z.string().max(2000).nullable().optional(),

  // Email Phase 2 US-027 — per-tenant open/click tracking on marketing
  // campaigns. Absent means OFF, which is the default and the only safe
  // interpretation of a settings blob that has never mentioned it: the store's
  // privacy notice only discloses tracking while this is true.
  emailTrackingEnabled: flag.optional(),

  // Email Phase 2 US-028 — the reorder-reminder automation. Absent means OFF,
  // the same reading as the tracking flag above and for the same reason: a
  // store that has never mentioned this has not agreed to it mailing anyone.
  //
  // The interval is bounded HERE only loosely enough to round-trip whatever is
  // already stored; the exact window
  // (MIN_REORDER_REMINDER_DAYS..MAX_REORDER_REMINDER_DAYS in
  // `lib/email/reorder-reminder.ts`) is enforced by the settings route on the
  // way in and re-applied on the way out, so an out-of-range value that reached
  // the column some other way falls back to the default instead of sending. The
  // constants are deliberately not imported: this module is a dependency of
  // `parseTenantSettings`, which that one reads, and the cycle would leave the
  // bounds undefined at module-init time.
  reorderReminderEnabled: flag.optional(),
  reorderReminderDays: z.number().int().min(1).max(3650).nullable().optional(),

  // SEO US-026 — search-engine verification + the GA4 tag, as three STRUCTURED
  // fields rather than a block of head HTML (see lib/seo/site-verification.ts
  // for why that box does not exist).
  //
  // Bounded by length here and NOT by charset, deliberately: this schema is what
  // `parseTenantSettings` runs on every storefront read and it fails as a unit,
  // so a token that no longer matched its charset would return `{}` and take the
  // tenant's tagline, colours and cookie banner down with it. The exact charset
  // is enforced by the write route on the way in and re-applied by
  // `readSiteVerification` on the way out, which drops a bad value from the
  // render instead. Same split as `reorderReminderDays` above.
  googleSiteVerification: z
    .string()
    .max(GOOGLE_SITE_VERIFICATION_MAX_LENGTH)
    .nullable()
    .optional(),
  bingSiteVerification: z
    .string()
    .max(BING_SITE_VERIFICATION_MAX_LENGTH)
    .nullable()
    .optional(),
  ga4MeasurementId: z
    .string()
    .max(GA4_MEASUREMENT_ID_MAX_LENGTH)
    .nullable()
    .optional(),

  // Third-party integration credentials / ids (bounded)
  automatosApiKey: z.string().max(500).nullable().optional(),
  automatosAgentId: shortString.optional(),
  automatosHelperAgentId: shortString.optional(),
  smtp: structural.optional(),

  // Server-managed keys — included so the full-blob round-trip is accepted.
  // (The route re-applies these AFTER caller settings, so they can't be
  // spoofed by the client regardless.)
  clerkOrgId: shortString.optional(),
  railwayDomainId: shortString.optional(),
  railwayDnsRecords: structural.optional(),
  domainVerification: structural.optional(),
  customDomain: z.string().max(255).nullable().optional(),
  domain: z.string().max(255).nullable().optional(),
  dnsVerified: flag.optional(),
} as const;

/** Canonical strict contract — rejects unknown top-level keys (for PRD-208). */
export const tenantSettingsSchema = z.object(tenantSettingsShape).strict();

/** Rollout-safe variant — validates known keys, tolerates unknown ones. */
export const tenantSettingsLenientSchema = z
  .object(tenantSettingsShape)
  .passthrough();

export type TenantSettings = z.infer<typeof tenantSettingsSchema>;
