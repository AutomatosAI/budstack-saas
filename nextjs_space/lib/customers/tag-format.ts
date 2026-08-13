/**
 * Canonical form + validation for customer tags (Email Phase 2, US-024).
 *
 * Client-safe on purpose: no prisma import, so the detail-page chips component
 * can share the exact normalisation the API stores under. The store functions
 * live in lib/customers/customer-tags.ts.
 */

import { z } from "zod";

/** Hard cap on the stored (normalised) tag length. */
export const TAG_MAX_LENGTH = 40;

/** Trim + lowercase — the single canonical form a tag is stored and matched in. */
export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Normalise, THEN validate: length runs against the canonical form, so a
 * 45-char input that trims to 40 chars is fine and `"   "` (empty after trim)
 * is rejected — not silently stored as `""`.
 */
export const tagSchema = z
  .string({ required_error: "A tag is required", invalid_type_error: "A tag is required" })
  .transform(normalizeTag)
  .pipe(
    z
      .string()
      .min(1, "A tag is required")
      .max(TAG_MAX_LENGTH, `Tags are limited to ${TAG_MAX_LENGTH} characters`),
  );
