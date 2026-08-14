import crypto from "crypto";

import { FEATURES, hasFeature } from "@/lib/entitlements/features";

/**
 * Auth + gating helpers for the assisted-Wire inbound endpoint
 * (POST /api/integrations/automatos/posts). Pure functions — unit-tested
 * without the route harness.
 */

export const WIRE_SIGNATURE_HEADER = "x-automatos-signature";
export const WIRE_TENANT_HEADER = "x-budstacks-tenant-id";

/**
 * Constant-time verification of `sha256=<hex hmac>` over the raw request
 * body. False for malformed headers, wrong length, or mismatch — never
 * throws on attacker-controlled input.
 */
export function verifyWireSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;
  const provided = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader;
  if (!/^[0-9a-f]{64}$/i.test(provided)) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(provided, "hex"),
      Buffer.from(expected, "hex"),
    );
  } catch {
    return false;
  }
}

export type WireRejection =
  | "NOT_ENTITLED"
  | "MODE_NOT_ASSISTED"
  | null;

/**
 * Drafts land only for tenants that BOTH hold the automatos.wire entitlement
 * AND opted The Wire into ASSISTED mode. Returns the rejection reason or null.
 */
export function wireDraftRejection(
  wireMode: string | null | undefined,
  features: Iterable<string>,
): WireRejection {
  if (!hasFeature(features, FEATURES.AUTOMATOS_WIRE)) return "NOT_ENTITLED";
  if (wireMode !== "ASSISTED") return "MODE_NOT_ASSISTED";
  return null;
}
