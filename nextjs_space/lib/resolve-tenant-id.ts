import { prisma } from "@/lib/db";

/**
 * Resolves a database tenant ID from a Clerk organization ID.
 * 
 * The issue: Clerk organization IDs (e.g., "org_38evxeRP8KLqsmjZR8R5wvluths") 
 * are stored in user.publicMetadata.tenantId, but the database uses UUIDs 
 * for tenant IDs. This function bridges that gap.
 * 
 * @param clerkOrgId - The Clerk organization ID from user metadata
 * @param userEmail - Optional user email for fallback lookup
 * @returns The database tenant ID (UUID) or null if not found
 */
export async function resolveTenantIdFromClerkOrg(
  clerkOrgId: string | null | undefined,
  userEmail?: string | null
): Promise<string | null> {
  let tenantId: string | null = null;

  // First, try to find tenant by Clerk Org ID in settings using raw query
  if (clerkOrgId) {
    try {
      const tenantWithClerkOrg = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM tenants 
        WHERE settings->>'clerkOrgId' = ${clerkOrgId}
        LIMIT 1
      `;

      if (tenantWithClerkOrg && tenantWithClerkOrg.length > 0) {
        tenantId = tenantWithClerkOrg[0].id;
      }
    } catch (error) {
      console.warn("Error querying tenant by Clerk Org ID:", error);
    }
  }

  // Fallback: Find tenant via user's email and their tenant relationship
  if (!tenantId && userEmail) {
    const dbUser = await prisma.users.findFirst({
      where: { email: userEmail },
      include: { tenants: true },
    });

    if (dbUser?.tenants) {
      tenantId = dbUser.tenants.id;
    }
  }

  return tenantId;
}
