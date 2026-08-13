/**
 * CRM-lite customer tag persistence (Email Phase 2, US-024).
 *
 * Tags are stored in their canonical form only — see lib/customers/tag-format.ts,
 * which both the API routes and the client chips share. Every function here
 * takes `tenantId` explicitly and puts it in the query itself rather than
 * relying on the lib/db.ts scope layer alone (the same posture as
 * lib/email/suppression-store.ts): inside a bound request context the scope
 * layer merges the same tenantId, and any future out-of-context caller stays
 * tenant-correct.
 */

import { prisma } from "@/lib/db";

/** Postgres unique-violation surfaced by Prisma. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * Attach a (normalised) tag to a customer. Idempotent: re-adding an existing
 * tag hits the (tenantId, userId, tag) unique key and is treated as a no-op —
 * the original row, with its original createdAt, stays.
 */
export async function addCustomerTag(
  tenantId: string,
  userId: string,
  tag: string,
): Promise<void> {
  try {
    await prisma.customer_tags.create({ data: { tenantId, userId, tag } });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
}

/** Detach a (normalised) tag. Idempotent: removing an absent tag is a no-op. */
export async function removeCustomerTag(
  tenantId: string,
  userId: string,
  tag: string,
): Promise<void> {
  await prisma.customer_tags.deleteMany({ where: { tenantId, userId, tag } });
}

/** All tags on one customer, alphabetical — the detail page's chip list. */
export async function listCustomerTags(
  tenantId: string,
  userId: string,
): Promise<string[]> {
  const rows = await prisma.customer_tags.findMany({
    where: { tenantId, userId },
    select: { tag: true },
    orderBy: { tag: "asc" },
  });
  return rows.map((row: { tag: string }) => row.tag);
}

/**
 * Every distinct tag in use across a tenant's customers, alphabetical — the
 * option list for the customers-page tag filter. `tenantId` may be undefined
 * only for the super-admin cross-tenant list view, mirroring how that page
 * scopes every other query.
 */
export async function listTenantTags(
  tenantId: string | undefined,
): Promise<string[]> {
  const rows = await prisma.customer_tags.findMany({
    where: { ...(tenantId && { tenantId }) },
    select: { tag: true },
    distinct: ["tag"],
    orderBy: { tag: "asc" },
  });
  return rows.map((row: { tag: string }) => row.tag);
}
