import { NextResponse } from "next/server";
import { z } from "zod";

const confirmationSchema = z.object({
  confirm: z.string().min(1),
});

/**
 * Typed confirmation guard for destructive actions (PRD-201 AC-3).
 *
 * Validates that the already-parsed request body carries a `confirm` string
 * equal to the expected target token (e.g. the tenant subdomain/slug) — not a
 * `?confirm=yes` query flag. Returns a `400 CONFIRMATION_MISMATCH` response on
 * a missing / non-string / mismatched token, or `null` to proceed.
 *
 * Takes the pre-parsed body (caller does `await req.json().catch(() => null)`)
 * so this stays free of request I/O and easy to unit test.
 */
export function requireConfirmation(
  body: unknown,
  expected: string,
): NextResponse | null {
  const parsed = confirmationSchema.safeParse(body);
  if (!parsed.success || parsed.data.confirm !== expected) {
    return NextResponse.json(
      {
        error: `Confirmation required: resend with { "confirm": "${expected}" } to proceed.`,
        code: "CONFIRMATION_MISMATCH",
      },
      { status: 400 },
    );
  }
  return null;
}
