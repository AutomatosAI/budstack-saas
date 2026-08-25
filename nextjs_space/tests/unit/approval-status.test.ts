import { describe, it, expect } from "vitest";

import {
  ADMIN_APPROVAL,
  canonicalAdminApproval,
  deriveVerificationStatus,
} from "@/lib/drgreen/approval-status";

/**
 * The vocabulary bug this module closes: two write paths stored "APPROVED"
 * while the webhook wrote "VERIFIED" and readers only accepted "VERIFIED" —
 * so a mirror-approved customer read as unverified on the products gate
 * while their dashboard said verified.
 */
describe("canonicalAdminApproval", () => {
  it("maps the legacy APPROVED literal to VERIFIED", () => {
    expect(canonicalAdminApproval("APPROVED")).toBe(ADMIN_APPROVAL.VERIFIED);
    expect(canonicalAdminApproval("approved")).toBe(ADMIN_APPROVAL.VERIFIED);
  });

  it("passes canonical values through", () => {
    expect(canonicalAdminApproval("VERIFIED")).toBe("VERIFIED");
    expect(canonicalAdminApproval("PENDING")).toBe("PENDING");
    expect(canonicalAdminApproval("REJECTED")).toBe("REJECTED");
    expect(canonicalAdminApproval(" rejected ")).toBe("REJECTED");
  });

  it("returns null for unknown or empty input", () => {
    expect(canonicalAdminApproval("")).toBeNull();
    expect(canonicalAdminApproval(null)).toBeNull();
    expect(canonicalAdminApproval(undefined)).toBeNull();
    expect(canonicalAdminApproval("BANANA")).toBeNull();
  });
});

describe("deriveVerificationStatus", () => {
  it("NOT_SUBMITTED when no questionnaire exists", () => {
    expect(deriveVerificationStatus({ hasQuestionnaire: false })).toBe("NOT_SUBMITTED");
  });

  it("VERIFIED via isKycVerified, matching the kyc-check read", () => {
    expect(
      deriveVerificationStatus({
        hasQuestionnaire: true,
        isKycVerified: true,
        adminApproval: "PENDING",
      }),
    ).toBe("VERIFIED");
  });

  it("VERIFIED via adminApproval, including the legacy APPROVED literal", () => {
    expect(
      deriveVerificationStatus({
        hasQuestionnaire: true,
        isKycVerified: false,
        adminApproval: "VERIFIED",
      }),
    ).toBe("VERIFIED");
    expect(
      deriveVerificationStatus({
        hasQuestionnaire: true,
        isKycVerified: false,
        adminApproval: "APPROVED",
      }),
    ).toBe("VERIFIED");
  });

  it("verified wins over a stale upload-failed marker", () => {
    expect(
      deriveVerificationStatus({
        hasQuestionnaire: true,
        isKycVerified: true,
        adminApproval: "VERIFIED",
        idDocumentStatus: "UPLOAD_FAILED",
      }),
    ).toBe("VERIFIED");
  });

  it("REJECTED when not verified and approval is REJECTED", () => {
    expect(
      deriveVerificationStatus({
        hasQuestionnaire: true,
        isKycVerified: false,
        adminApproval: "REJECTED",
        idDocumentStatus: "UPLOAD_FAILED",
      }),
    ).toBe("REJECTED");
  });

  it("ID_UPLOAD_FAILED when unverified with a failed inline upload", () => {
    expect(
      deriveVerificationStatus({
        hasQuestionnaire: true,
        isKycVerified: false,
        adminApproval: "PENDING",
        idDocumentStatus: "UPLOAD_FAILED",
      }),
    ).toBe("ID_UPLOAD_FAILED");
  });

  it("PENDING otherwise, including unknown approval values", () => {
    expect(
      deriveVerificationStatus({
        hasQuestionnaire: true,
        isKycVerified: false,
        adminApproval: "PENDING",
      }),
    ).toBe("PENDING");
    expect(
      deriveVerificationStatus({
        hasQuestionnaire: true,
        isKycVerified: false,
        adminApproval: "WEIRD_VALUE",
      }),
    ).toBe("PENDING");
  });
});
