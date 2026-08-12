/**
 * Persistence for the per-tenant marketing suppression list (US-004).
 *
 * Every function takes `tenantId` explicitly and puts it in the query itself
 * rather than relying on the lib/db.ts scope layer. That is what lets the email
 * worker — which runs outside any request and therefore has no bound tenant
 * context — call these under `bypassTenantScope()` and still be tenant-correct.
 * Inside a bound context (the storefront routes) the scope layer merges the
 * same tenantId, so both callers get identical SQL.
 */

import { prisma } from "@/lib/db";
import {
  type SuppressionReason,
  normalizeEmail,
  recipientAddresses,
  shouldCheckSuppression,
} from "@/lib/email/suppression";

/** Postgres unique-violation surfaced by Prisma. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/** Which of `emails` this tenant is forbidden to send marketing to. */
export async function findSuppressedRecipients(
  tenantId: string,
  emails: readonly string[],
): Promise<string[]> {
  if (emails.length === 0) return [];

  const rows = await prisma.email_suppressions.findMany({
    where: { tenantId, email: { in: [...emails] } },
    select: { email: true },
  });

  return rows.map((row: { email: string }) => row.email);
}

export interface SuppressEmailInput {
  readonly tenantId: string;
  readonly email: string;
  readonly reason: SuppressionReason;
}

/**
 * Add an address to the list. Idempotent: a second call for an address that is
 * already suppressed is a no-op that leaves the ORIGINAL reason in place — the
 * first thing that took the address off marketing is the interesting one, and
 * an address cannot become "less suppressed".
 */
export async function suppressEmail(input: SuppressEmailInput): Promise<void> {
  try {
    await prisma.email_suppressions.create({
      data: {
        tenantId: input.tenantId,
        email: normalizeEmail(input.email),
        reason: input.reason,
      },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
}

export interface SuppressionBlock {
  /** True when this job must not be sent at all. */
  readonly blocked: boolean;
  /** The suppressed addresses, for the log line. */
  readonly suppressed: readonly string[];
}

const NOT_BLOCKED: SuppressionBlock = { blocked: false, suppressed: [] };

/**
 * The whole send-time decision, in one testable call: may this queued job go
 * out?
 *
 * A transactional job never reaches the database — suppression does not apply
 * to it and a lookup per receipt would be pure cost. A marketing job with ANY
 * suppressed recipient is blocked outright rather than partially delivered: one
 * `sendMail` cannot drop a single address from its envelope, so trimming the
 * list here would silently change who a message was addressed to. Marketing
 * fan-out is one message per recipient (US-019), which makes that all-or-
 * nothing rule exact rather than blunt.
 */
export async function resolveSuppressionBlock(input: {
  tenantId: string;
  to: unknown;
  category: unknown;
}): Promise<SuppressionBlock> {
  if (!shouldCheckSuppression(input.category)) return NOT_BLOCKED;

  const recipients = recipientAddresses(input.to);
  if (recipients.length === 0) return NOT_BLOCKED;

  const suppressed = await findSuppressedRecipients(input.tenantId, recipients);
  return suppressed.length > 0 ? { blocked: true, suppressed } : NOT_BLOCKED;
}
