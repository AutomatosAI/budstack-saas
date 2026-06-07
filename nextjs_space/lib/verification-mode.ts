/**
 * Per-tenant customer verification mode (South Africa only).
 *
 * A ZA tenant chooses ONE of two mutually-exclusive ways for their customers to
 * become orderable:
 *   - "KYC"        — today's flow: consultation + First-AML KYC.
 *   - "ID_UPLOAD"  — skip the consultation, upload a valid ID (Dr Green reviews).
 *
 * See tasks/prd-sa-id-upload-verification.md.
 */

export type VerificationMode = "KYC" | "ID_UPLOAD";

export const VERIFICATION_MODES: readonly VerificationMode[] = [
  "KYC",
  "ID_UPLOAD",
] as const;

// Budstacks stores tenant.countryCode as ISO 3166-1 alpha-2 ("ZA").
export const SA_TENANT_COUNTRY_CODE = "ZA";

// Dr Green expects the shipping countryCode as ISO 3166-1 alpha-3 ("ZAF") and
// only skips First-AML / the medical record when it sees exactly this value.
// Map ZA → ZAF when calling Dr Green's createClient on the ID-upload path.
export const DR_GREEN_SA_COUNTRY_CODE = "ZAF";

type TenantVerificationFields = {
  countryCode?: string | null;
  settings?: unknown;
};

/** Only South-African tenants may choose the verification mode. */
export function isSaIdEligibleTenant(tenant: TenantVerificationFields): boolean {
  return (tenant.countryCode ?? "").toUpperCase() === SA_TENANT_COUNTRY_CODE;
}

/**
 * Budstacks mirror of Dr Green's global SA_ID_ENABLED flag. Dr Green's flag is
 * per-environment and not readable by us; it decides whether uploads are
 * accepted. This mirror decides whether we show the ID-upload UX, so we never
 * surface a path Dr Green would 403.
 */
export function isSaIdUploadEnabled(): boolean {
  return process.env.SA_ID_UPLOAD_ENABLED === "true";
}

/**
 * The tenant's effective verification mode. Defaults to "KYC" (today's flow)
 * and is forced to "KYC" for any non-SA tenant, so the ID-upload path can never
 * be active outside South Africa regardless of what is stored in settings.
 */
export function getTenantVerificationMode(
  tenant: TenantVerificationFields,
): VerificationMode {
  if (!isSaIdEligibleTenant(tenant)) return "KYC";
  const mode = (tenant.settings as { verificationMode?: unknown } | null | undefined)
    ?.verificationMode;
  return mode === "ID_UPLOAD" ? "ID_UPLOAD" : "KYC";
}
