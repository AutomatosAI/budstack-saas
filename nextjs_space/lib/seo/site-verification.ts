/**
 * SEO Supercharge US-026 — search-engine verification and the GA4 tag, as
 * STRUCTURED FIELDS.
 *
 * WHAT THIS DELIBERATELY IS NOT: a "paste your head HTML here" box. Every
 * platform that ships one ends up with a stored `<script>` an owner copied off a
 * forum, rendered into every storefront page under the tenant's own domain and
 * cookies — a persistent XSS with a settings form in front of it. The three
 * things a store actually needs from that box are a Google token, a Bing token
 * and a GA4 measurement id, so those are the three fields, each pinned to a
 * charset and a length, and nothing else is accepted.
 *
 * TWO CHECKS, TWO PLACES, ON PURPOSE:
 *  - `lib/validation/tenant-settings.ts` bounds the LENGTH of the three keys in
 *    the shared read/write blob schema — deliberately not the charset. That
 *    schema is what `parseTenantSettings` runs on every storefront read, and it
 *    fails as a UNIT: one value that no longer matches would return `{}` and
 *    take the tenant's tagline, colours and cookie banner down with it. It is
 *    the same reasoning as `reorderReminderDays` (bounded loosely there, exact
 *    window applied by the route on the way in and re-applied on the way out).
 *  - HERE, the exact charset is enforced on the way IN (the write route) and
 *    re-applied on the way OUT ({@link readSiteVerification}), so a value that
 *    reached the column some other way is dropped from the render instead of
 *    emitting a meta tag nobody authored.
 *
 * PRO ONLY, BY DEGRADING (the `lib/entitlements/require-feature.ts` storefront
 * contract): a Basic tenant's stored tokens stay stored and stop rendering. The
 * storefront never blocks on plan.
 *
 * Pure module — no prisma, no next/server, no request, no `parseTenantSettings`
 * (importing that would close a cycle: it depends on the validation module that
 * depends on this one for its bounds). It runs inside `generateMetadata`, which
 * has no `error.tsx` boundary above it, so every path degrades to "emit
 * nothing" rather than throwing a blank page.
 */

import type { Metadata } from "next";

import { isSeoProUnlocked } from "@/lib/seo/pro-features";

/**
 * Google Search Console's HTML-tag token: 43 base64url characters today. Bounded
 * 8..128 so a format change does not need a deploy to accept.
 */
export const GOOGLE_SITE_VERIFICATION_MAX_LENGTH = 128;
const GOOGLE_SITE_VERIFICATION_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

/** Bing Webmaster Tools' `msvalidate.01`: 32 hex characters today. */
export const BING_SITE_VERIFICATION_MAX_LENGTH = 64;
const BING_SITE_VERIFICATION_PATTERN = /^[A-Za-z0-9]{8,64}$/;

/** A GA4 measurement id — `G-` then the stream's uppercase alphanumeric id. */
export const GA4_MEASUREMENT_ID_MAX_LENGTH = 24;
const GA4_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{4,22}$/;

/**
 * Bing has no dedicated slot in Next's `Metadata.verification`, so it is emitted
 * through `verification.other` under the name Bing looks for. Google's own token
 * goes through `verification.google`, which renders
 * `<meta name="google-site-verification">`.
 */
export const BING_VERIFICATION_META_NAME = "msvalidate.01";

/** The three keys, in the order the settings section renders them. */
export const SITE_VERIFICATION_KEYS = [
  "googleSiteVerification",
  "bingSiteVerification",
  "ga4MeasurementId",
] as const;

export type SiteVerificationKey = (typeof SITE_VERIFICATION_KEYS)[number];

/**
 * Pull the token out of a pasted verification snippet.
 *
 * Search Console and Bing both hand an owner a whole `<meta …>` tag, and pasting
 * it is the obvious thing to do. Extracting the `content` here is what lets the
 * field stay structured while still accepting what the owner was given —
 * anything that is not a meta tag, and any tag with no readable content, falls
 * through unchanged and is then refused by the charset check, so this can only
 * ever narrow an input, never widen what is stored.
 */
export function normalizeVerificationToken(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("<")) return trimmed;
  const match = /content\s*=\s*["']([^"']*)["']/i.exec(trimmed);
  return match ? match[1].trim() : trimmed;
}

/** GA4 ids are uppercase; owners paste them either way. */
export function normalizeGa4MeasurementId(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toUpperCase() : "";
}

/** One field's contract — shared by the write route and the settings section. */
export interface SiteVerificationFieldSpec {
  readonly key: SiteVerificationKey;
  readonly label: string;
  readonly maxLength: number;
  readonly placeholder: string;
  /** Normalise first, then test — the pattern never sees untrimmed input. */
  readonly normalize: (raw: unknown) => string;
  readonly pattern: RegExp;
  /** Shown verbatim to the owner by both the field and the route. */
  readonly invalidMessage: string;
}

export const SITE_VERIFICATION_FIELDS: readonly SiteVerificationFieldSpec[] = [
  {
    key: "googleSiteVerification",
    label: "Google Search Console",
    maxLength: GOOGLE_SITE_VERIFICATION_MAX_LENGTH,
    placeholder: "AbC123_dEf456-…",
    normalize: normalizeVerificationToken,
    pattern: GOOGLE_SITE_VERIFICATION_PATTERN,
    invalidMessage:
      "That is not a Google verification token. In Search Console choose the HTML tag method and paste either the whole meta tag or just its content value.",
  },
  {
    key: "bingSiteVerification",
    label: "Bing Webmaster Tools",
    maxLength: BING_SITE_VERIFICATION_MAX_LENGTH,
    placeholder: "0123456789ABCDEF0123456789ABCDEF",
    normalize: normalizeVerificationToken,
    pattern: BING_SITE_VERIFICATION_PATTERN,
    invalidMessage:
      "That is not a Bing verification token. In Bing Webmaster Tools choose the meta-tag method and paste either the whole meta tag or just its content value.",
  },
  {
    key: "ga4MeasurementId",
    label: "Google Analytics 4",
    maxLength: GA4_MEASUREMENT_ID_MAX_LENGTH,
    placeholder: "G-XXXXXXXXXX",
    normalize: normalizeGa4MeasurementId,
    pattern: GA4_MEASUREMENT_ID_PATTERN,
    invalidMessage:
      "A GA4 measurement ID looks like G-XXXXXXXXXX. Find it in Google Analytics under Admin → Data streams.",
  },
] as const;

/**
 * The normalised value, or "" when this input is not a token of that kind.
 *
 * "" is also how the section clears a field, which is why an empty input is
 * VALID here rather than an error: refusing it would leave an owner unable to
 * remove a token they had set.
 */
export function checkSiteVerificationField(
  spec: SiteVerificationFieldSpec,
  raw: unknown,
): { ok: true; value: string } | { ok: false; message: string } {
  const value = spec.normalize(raw);
  if (!value) return { ok: true, value: "" };
  if (value.length > spec.maxLength || !spec.pattern.test(value)) {
    return { ok: false, message: spec.invalidMessage };
  }
  return { ok: true, value };
}

/** The `tenants.settings` keys this module reads. Every one is optional. */
export interface SiteVerificationSettings {
  readonly googleSiteVerification?: string | null;
  readonly bingSiteVerification?: string | null;
  readonly ga4MeasurementId?: string | null;
  /**
   * The store's own "we use analytics cookies" switch
   * (`/tenant-admin/cookie-settings`). Absent means OFF — see
   * {@link storeGa4MeasurementId} for why the tag waits for it.
   */
  readonly analyticsEnabled?: boolean | null;
}

/** The three stored values, each "" when unset or no longer well-formed. */
export type SiteVerificationValues = Readonly<
  Record<SiteVerificationKey, string>
>;

const EMPTY_VALUES: SiteVerificationValues = {
  googleSiteVerification: "",
  bingSiteVerification: "",
  ga4MeasurementId: "",
};

/**
 * Read the three fields back off a parsed settings blob, re-applying each
 * field's own charset — the "on the way out" half of the two-place check in the
 * module docstring.
 */
export function readSiteVerification(
  settings: SiteVerificationSettings | null | undefined,
): SiteVerificationValues {
  if (!settings) return EMPTY_VALUES;

  return SITE_VERIFICATION_FIELDS.reduce<SiteVerificationValues>(
    (values, spec) => {
      const checked = checkSiteVerificationField(spec, settings[spec.key]);
      return { ...values, [spec.key]: checked.ok ? checked.value : "" };
    },
    EMPTY_VALUES,
  );
}

/** What a storefront needs to decide whether any of this renders. */
export interface SiteVerificationSource {
  /** `tenants.id` — the plan gate's subject. */
  readonly tenantId?: string;
  /** Raw `tenants.plan`; parsed fail-closed, so an absent value means Basic. */
  readonly plan?: unknown;
  /** Already parsed — see the module docstring on why this is not raw Json. */
  readonly settings?: SiteVerificationSettings | null;
}

/**
 * `Metadata["verification"]` for a store, or undefined when there is nothing to
 * say. Declared on the store LAYOUT, so every page carries it: a verification
 * meta tag is only strictly needed on the homepage, but a crawler pointed at any
 * URL of the store finds it there too, and it costs one tag.
 */
export function storeVerificationMetadata(
  source: SiteVerificationSource,
): Metadata["verification"] | undefined {
  if (!isSeoProUnlocked({ id: source.tenantId ?? "", plan: source.plan })) {
    return undefined;
  }

  const { googleSiteVerification, bingSiteVerification } =
    readSiteVerification(source.settings);

  if (!googleSiteVerification && !bingSiteVerification) return undefined;

  return {
    ...(googleSiteVerification ? { google: googleSiteVerification } : {}),
    ...(bingSiteVerification
      ? { other: { [BING_VERIFICATION_META_NAME]: bingSiteVerification } }
      : {}),
  };
}

/**
 * The measurement id this store should load GA4 with, or null.
 *
 * THREE conditions, all required, and the third is the one worth stating.
 *  1. the tenant holds `seo.pro`;
 *  2. a well-formed id is stored;
 *  3. the store's own Analytics Cookies switch is ON
 *     (`tenants.settings.analyticsEnabled`, `/tenant-admin/cookie-settings`).
 *
 * (3) is the integration the PRD asks for, and it is a precondition rather than
 * a nicety: that switch is what the store's cookie banner and cookie policy
 * describe to a visitor. Loading an analytics tag while the store's own
 * published position is "we do not use analytics cookies" would make the policy
 * false. It is not the visitor's consent — that is a per-visitor decision the
 * browser holds, checked in `Ga4ConsentScripts`; this is the store-level
 * declaration that the category exists at all. The settings section says so
 * beside the field, because the flag defaults to OFF and a silently dormant tag
 * is a support ticket.
 */
export function storeGa4MeasurementId(
  source: SiteVerificationSource,
): string | null {
  if (!isSeoProUnlocked({ id: source.tenantId ?? "", plan: source.plan })) {
    return null;
  }
  if (source.settings?.analyticsEnabled !== true) return null;

  return readSiteVerification(source.settings).ga4MeasurementId || null;
}

/** Re-check before an id is written into a script tag. See `Ga4ConsentScripts`. */
export function isGa4MeasurementId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= GA4_MEASUREMENT_ID_MAX_LENGTH &&
    GA4_MEASUREMENT_ID_PATTERN.test(value)
  );
}
