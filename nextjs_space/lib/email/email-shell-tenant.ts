/**
 * US-011 — load the tenant fields US-010's branded shell renders.
 *
 * Split out of the pipeline so the pipeline itself stays pure (JSON in, HTML
 * out) and testable without a database, and so the campaign compose path
 * (US-017) and the preview path (US-015) read the shell's inputs from exactly
 * one query instead of assembling their own.
 *
 * Branding lives in a separate table from the postal address, and either row can
 * be missing on a tenant that never finished onboarding — both are flattened to
 * null here so the shell's "omit rather than fake it" rules apply.
 */

import { ApiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import type { EmailShellTenant } from "@/lib/email/email-shell";

/**
 * Every field the shell reads, and nothing else. `settings` is the whole Json
 * blob because `resolveBusinessAddress` parses it through the shared schema;
 * SMTP credentials live in there too, so this value must never leave the
 * render path.
 */
export async function loadEmailShellTenant(
  tenantId: string,
): Promise<EmailShellTenant | null> {
  // findFirst with a flat id filter, not findUnique: the tenant-scope $extends
  // rewrite is only safe over flat `where` fields (repo-wide convention).
  const tenant = await prisma.tenants.findFirst({
    where: { id: tenantId },
    select: {
      id: true,
      businessName: true,
      subdomain: true,
      customDomain: true,
      settings: true,
      businessAddress1: true,
      businessAddress2: true,
      businessCity: true,
      businessState: true,
      businessPostalCode: true,
      businessCountry: true,
      tenant_branding: { select: { logoUrl: true, primaryColor: true } },
    },
  });

  if (!tenant) return null;

  const { tenant_branding, ...rest } = tenant;
  return {
    ...rest,
    logoUrl: tenant_branding?.logoUrl ?? null,
    primaryColor: tenant_branding?.primaryColor ?? null,
  };
}

/**
 * Same lookup, for callers that cannot proceed without a tenant.
 *
 * A tenant-admin is authenticated FOR a tenant, so a miss here means the row was
 * deleted mid-request — a 404, not a 500, and never a render against
 * half-resolved branding.
 */
export async function requireEmailShellTenant(
  tenantId: string,
): Promise<EmailShellTenant> {
  const tenant = await loadEmailShellTenant(tenantId);
  if (!tenant) throw new ApiError("Store not found", 404);
  return tenant;
}
