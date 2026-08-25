/**
 * Canonical Dr Green approval-status vocabulary + display derivation.
 *
 * Dr Green's enum is VERIFIED | PENDING | REJECTED (AdminApprovalOnClient).
 * BudStacks historically wrote a fourth value, "APPROVED", from two paths
 * (the kyc-check mirror and the tenant-admin verifyKyc API) while the
 * webhook handlers wrote "VERIFIED" — and readers only accepted "VERIFIED",
 * so mirror-approved customers could read as unverified (the products-page
 * gate) while their dashboard said verified. Every reader and writer now
 * goes through this module; stored legacy "APPROVED" rows keep working via
 * read-side canonicalisation (an optional SQL backfill exists in
 * prisma/migrations/normalize_admin_approval_verified.sql).
 */

export const ADMIN_APPROVAL = {
  VERIFIED: "VERIFIED",
  PENDING: "PENDING",
  REJECTED: "REJECTED",
} as const;

export type AdminApproval = (typeof ADMIN_APPROVAL)[keyof typeof ADMIN_APPROVAL];

/** Map a stored/remote adminApproval value to the canonical enum.
 *  Legacy "APPROVED" → VERIFIED. Unknown/empty input → null (caller decides). */
export function canonicalAdminApproval(
  value: string | null | undefined,
): AdminApproval | null {
  switch ((value ?? "").trim().toUpperCase()) {
    case "VERIFIED":
    case "APPROVED":
      return ADMIN_APPROVAL.VERIFIED;
    case "REJECTED":
      return ADMIN_APPROVAL.REJECTED;
    case "PENDING":
      return ADMIN_APPROVAL.PENDING;
    default:
      return null;
  }
}

/** Display status for a customer on tenant-admin surfaces. */
export type CustomerVerificationStatus =
  | "VERIFIED"
  | "PENDING"
  | "REJECTED"
  | "ID_UPLOAD_FAILED"
  | "NOT_SUBMITTED";

export interface VerificationStatusInput {
  /** Whether any consultation_questionnaires row exists for this customer. */
  hasQuestionnaire: boolean;
  isKycVerified?: boolean | null;
  adminApproval?: string | null;
  /** UPLOADED | UPLOAD_FAILED | null (ID-upload tenants only). */
  idDocumentStatus?: string | null;
}

/**
 * Mirror-field → display status. "Verified" matches the customer-facing
 * read in app/actions/kyc-check.ts (isKYCVerified OR adminApproval=VERIFIED)
 * so the admin list and the customer dashboard never disagree.
 */
export function deriveVerificationStatus(
  input: VerificationStatusInput,
): CustomerVerificationStatus {
  if (!input.hasQuestionnaire) return "NOT_SUBMITTED";

  const approval = canonicalAdminApproval(input.adminApproval);
  const verified = input.isKycVerified === true || approval === ADMIN_APPROVAL.VERIFIED;
  if (verified) return "VERIFIED";
  if (approval === ADMIN_APPROVAL.REJECTED) return "REJECTED";
  if (input.idDocumentStatus === "UPLOAD_FAILED") return "ID_UPLOAD_FAILED";
  return "PENDING";
}

/** Pill labels/tones shared by the list, detail page and CSV export. */
export const VERIFICATION_STATUS_DISPLAY: Record<
  CustomerVerificationStatus,
  { label: string; tone: "emerald" | "amber" | "red" | "slate" }
> = {
  VERIFIED: { label: "Verified", tone: "emerald" },
  PENDING: { label: "Pending", tone: "amber" },
  REJECTED: { label: "Rejected", tone: "red" },
  ID_UPLOAD_FAILED: { label: "ID upload failed", tone: "red" },
  NOT_SUBMITTED: { label: "Not submitted", tone: "slate" },
};
