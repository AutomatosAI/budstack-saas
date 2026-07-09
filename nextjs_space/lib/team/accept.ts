import crypto from "crypto";
import { prisma } from "@/lib/db";
import { clerkClient } from "@clerk/nextjs/server";
import { runWithTenantContextAsync } from "@/lib/tenant/tenant-context";
import { ApiError } from "@/lib/api-error";
import { isTeamRole } from "@/lib/permissions/preset-roles";

export interface InvitationPreview {
  tenantId: string;
  tenantName: string;
  email: string;
  role: string;
}

function clerkOrgIdOf(settings: unknown): string | null {
  if (settings && typeof settings === "object") {
    const v = (settings as Record<string, unknown>).clerkOrgId;
    return typeof v === "string" ? v : null;
  }
  return null;
}

/**
 * Look up an invitation by its globally-unique token WITHOUT tenant scope — the
 * accepter has no tenant context yet, so the whole flow runs as an explicit-null
 * (system) context. Validates status + expiry; returns tenant display info.
 */
export async function getInvitationPreview(token: string): Promise<InvitationPreview> {
  return runWithTenantContextAsync(null, async () => {
    const invitation = await prisma.team_invitations.findFirst({
      where: { invitationToken: token },
    });
    if (!invitation) throw new ApiError("This invitation link is invalid.", 404);
    if (invitation.status !== "pending") {
      throw new ApiError("This invitation is no longer valid.", 410);
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new ApiError("This invitation has expired.", 410);
    }

    const tenant = await prisma.tenants.findFirst({
      where: { id: invitation.tenantId },
      select: { businessName: true, isActive: true },
    });
    if (!tenant || !tenant.isActive) {
      throw new ApiError("This organization is no longer available.", 410);
    }

    return {
      tenantId: invitation.tenantId,
      tenantName: tenant.businessName,
      email: invitation.email,
      role: invitation.role,
    };
  });
}

export interface AcceptInvitationInput {
  token: string;
  clerkUserId: string;
  email: string;
}

/**
 * Accept an invitation: link the (already Clerk-authenticated) user to the tenant
 * as a TENANT_ADMIN with the invited teamRole, mark the invite accepted, and point
 * their Clerk publicMetadata at the tenant's org so getCurrentUser resolves them.
 * Runs as a system (null) context — the accepter is cross-tenant by nature.
 */
export async function acceptInvitation(input: AcceptInvitationInput) {
  const email = input.email.trim().toLowerCase();
  const { token, clerkUserId } = input;

  return runWithTenantContextAsync(null, async () => {
    const invitation = await prisma.team_invitations.findFirst({
      where: { invitationToken: token },
    });
    if (!invitation) throw new ApiError("This invitation link is invalid.", 404);
    if (invitation.status === "accepted") {
      throw new ApiError("This invitation has already been accepted.", 409);
    }
    if (invitation.status !== "pending") {
      throw new ApiError("This invitation is no longer valid.", 410);
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new ApiError("This invitation has expired.", 410);
    }
    if (invitation.email.trim().toLowerCase() !== email) {
      throw new ApiError("This invitation was sent to a different email address.", 403);
    }

    const role = isTeamRole(invitation.role) ? invitation.role : "editor";
    const tenantId = invitation.tenantId;

    const tenant = await prisma.tenants.findFirst({
      where: { id: tenantId },
      select: { settings: true, isActive: true },
    });
    if (!tenant || !tenant.isActive) {
      throw new ApiError("This organization is no longer available.", 410);
    }

    const existing = await prisma.users.findFirst({
      where: { email },
      select: { id: true, tenantId: true },
    });
    // Pre-PRD-208 the email is globally unique — refuse to steal a user that
    // already belongs to a different tenant.
    if (existing && existing.tenantId && existing.tenantId !== tenantId) {
      throw new ApiError(
        "This email is already registered to another BudStacks account.",
        409,
      );
    }

    if (existing) {
      await prisma.users.update({
        where: { id: existing.id },
        data: {
          clerkUserId,
          role: "TENANT_ADMIN",
          teamRole: role,
          tenantId,
          isActive: true,
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.users.create({
        data: {
          id: crypto.randomUUID(),
          email,
          clerkUserId,
          password: "CLERK_MANAGED_ACCOUNT",
          role: "TENANT_ADMIN",
          teamRole: role,
          tenantId,
          isActive: true,
          updatedAt: new Date(),
        },
      });
    }

    await prisma.team_invitations.update({
      where: { id: invitation.id },
      data: { status: "accepted", acceptedAt: new Date() },
    });

    // Point the Clerk user at this tenant's org so getCurrentUser resolves them.
    const clerkOrgId = clerkOrgIdOf(tenant.settings);
    if (clerkOrgId) {
      const client = await clerkClient();
      await client.users.updateUserMetadata(clerkUserId, {
        publicMetadata: { role: "TENANT_ADMIN", tenantId: clerkOrgId },
      });
    }

    return { tenantId, role };
  });
}
