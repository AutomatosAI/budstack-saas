import { currentUser } from "@clerk/nextjs/server";
import { resolveTenantIdFromClerkOrg } from "./resolve-tenant-id";

export async function getCurrentUser() {
    const user = await currentUser();

    if (!user) {
        return null;
    }

    // Extract roles and tenant from publicMetadata
    // NOTE: user.publicMetadata.tenantId is actually a Clerk Org ID (e.g., "org_...")
    // We need to resolve it to the actual database tenant UUID
    const role = (user.publicMetadata.role as string) || "user";
    const clerkOrgId = (user.publicMetadata.tenantId as string) || null;
    const email = user.emailAddresses[0]?.emailAddress;

    // Resolve Clerk Org ID to database tenant UUID
    const tenantId = await resolveTenantIdFromClerkOrg(clerkOrgId, email);

    return {
        id: user.id,
        email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
        image: user.imageUrl,
        role,
        tenantId, // Now this is the actual database tenant UUID, not Clerk Org ID
        clerkOrgId, // Keep Clerk Org ID available if needed
    };
}
