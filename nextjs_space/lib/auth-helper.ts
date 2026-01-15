import { currentUser } from "@clerk/nextjs/server";

export async function getCurrentUser() {
    const user = await currentUser();

    if (!user) {
        return null;
    }

    // Extract roles and tenant from publicMetadata
    // We assume the metadata structure: { role: string, tenantId: string, ... }
    const role = (user.publicMetadata.role as string) || "user";
    const tenantId = (user.publicMetadata.tenantId as string) || null;

    return {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
        image: user.imageUrl,
        role,
        tenantId,
    };
}
