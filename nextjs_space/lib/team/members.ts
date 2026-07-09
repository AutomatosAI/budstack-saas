import { prisma } from "@/lib/db";
import { clerkClient } from "@clerk/nextjs/server";
import { ApiError } from "@/lib/api-error";

export interface TeamMember {
  id: string;
  email: string | null;
  name: string | null;
  teamRole: string | null;
  isActive: boolean;
  createdAt: Date;
  clerkUserId: string | null;
}

/** Staff (role = TENANT_ADMIN) for the current bound tenant, oldest first. */
export function listMembers(): Promise<TeamMember[]> {
  return prisma.users.findMany({
    where: { role: "TENANT_ADMIN" },
    select: {
      id: true,
      email: true,
      name: true,
      teamRole: true,
      isActive: true,
      createdAt: true,
      clerkUserId: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

/** Count of active admins — used to protect the last one from removal. */
export function countActiveAdmins(): Promise<number> {
  return prisma.users.count({ where: { role: "TENANT_ADMIN", isActive: true } });
}

/**
 * Revoke a member's access: deactivate the local row (the tenant resolver honours
 * `isActive`) and best-effort clear their Clerk metadata so they can't resolve
 * back to this tenant. The route guards against removing yourself / the last admin.
 */
export async function removeMember(localUserId: string) {
  const member = await prisma.users.findFirst({
    where: { id: localUserId, role: "TENANT_ADMIN" },
    select: { id: true, clerkUserId: true, email: true },
  });
  if (!member) throw new ApiError("Team member not found.", 404);

  await prisma.users.update({
    where: { id: member.id },
    data: { isActive: false, updatedAt: new Date() },
  });

  if (member.clerkUserId) {
    try {
      const client = await clerkClient();
      await client.users.updateUserMetadata(member.clerkUserId, {
        publicMetadata: { role: null, tenantId: null },
      });
    } catch (err) {
      console.error("[team] Failed to clear Clerk metadata on member removal:", err);
    }
  }

  return member;
}
