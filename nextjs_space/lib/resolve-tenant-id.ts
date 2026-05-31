import {
  resolveTenant,
  isAmbiguousTenantResolution,
} from "@/lib/tenant-resolver";

/**
 * Resolves a database tenant ID from a Clerk organization ID (and an optional
 * email fallback).
 *
 * The issue: Clerk organization IDs (e.g., "org_38evxeRP8KLqsmjZR8R5wvluths") are
 * stored in user.publicMetadata.tenantId, but the database uses UUIDs for tenant
 * IDs. This function bridges that gap.
 *
 * PRD-205 (AC-1b / AC-2): a thin delegator onto the canonical
 * resolveTenant({ kind: 'clerk' }). This closes two gaps the old raw-SQL +
 * unscoped-email implementation had:
 *   - isActive is now enforced on BOTH the clerk-org and the email lookups (the
 *     old email fallback resolved inactive tenants).
 *   - an email matching >1 ACTIVE tenant returns null (deny) instead of silently
 *     picking the first row. The resolver has already emitted the structured
 *     tenant.resolution_ambiguous audit event; here we simply refuse to guess.
 *
 * @param clerkOrgId - The Clerk organization ID from user metadata
 * @param userEmail - Optional user email for fallback lookup
 * @returns The database tenant ID (UUID) or null if not found / ambiguous
 */
export async function resolveTenantIdFromClerkOrg(
  clerkOrgId: string | null | undefined,
  userEmail?: string | null,
): Promise<string | null> {
  const resolved = await resolveTenant({
    kind: "clerk",
    clerkOrgId,
    email: userEmail,
  });

  if (resolved == null || isAmbiguousTenantResolution(resolved)) {
    return null;
  }

  return resolved.tenantId;
}
