import crypto from "crypto";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-error";
import type { TeamRole } from "@/lib/permissions/preset-roles";

export const INVITATION_TTL_DAYS = 7;

/** Cryptographically-strong, URL-safe invitation token. */
export function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function expiryFromNow(days = INVITATION_TTL_DAYS): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export interface CreateInvitationInput {
  tenantId: string;
  email: string;
  role: TeamRole;
  invitedBy: string; // Clerk user id of the inviting admin
}

/**
 * Create or renew the pending invitation for (tenant, email). Runs inside the
 * admin's bound tenant context. Uses find-then-create/update (NOT a compound-key
 * upsert) to avoid the tenant-scope $extends compound-`@@unique` rewrite trap.
 */
export async function createOrRenewInvitation(input: CreateInvitationInput) {
  const email = input.email.trim().toLowerCase();
  const { tenantId, role, invitedBy } = input;

  // Don't invite someone who is already an active member of this tenant.
  const member = await prisma.users.findFirst({
    where: { email, role: "TENANT_ADMIN", isActive: true },
    select: { id: true },
  });
  if (member) throw new ApiError("That person is already a team member.", 409);

  const token = generateInvitationToken();
  const existing = await prisma.team_invitations.findFirst({ where: { email } });

  if (existing) {
    return prisma.team_invitations.update({
      where: { id: existing.id },
      data: {
        role,
        invitationToken: token,
        invitedBy,
        status: "pending",
        acceptedAt: null,
        expiresAt: expiryFromNow(),
        sentAt: new Date(),
      },
    });
  }

  return prisma.team_invitations.create({
    data: {
      tenantId,
      email,
      role,
      invitationToken: token,
      invitedBy,
      status: "pending",
      expiresAt: expiryFromNow(),
    },
  });
}

/** Pending invitations for the current (bound) tenant, newest first. */
export function listPendingInvitations() {
  return prisma.team_invitations.findMany({
    where: { status: "pending" },
    orderBy: { sentAt: "desc" },
  });
}

/** Fetch one invitation (scoped) by id, or throw 404. */
async function requireInvitation(id: string) {
  const inv = await prisma.team_invitations.findFirst({ where: { id } });
  if (!inv) throw new ApiError("Invitation not found.", 404);
  return inv;
}

/** Re-issue a fresh token + expiry (for "resend"). Returns the updated row. */
export async function renewInvitation(id: string) {
  const inv = await requireInvitation(id);
  return prisma.team_invitations.update({
    where: { id: inv.id },
    data: {
      invitationToken: generateInvitationToken(),
      status: "pending",
      acceptedAt: null,
      expiresAt: expiryFromNow(),
      sentAt: new Date(),
    },
  });
}

/** Mark an invitation revoked (keeps the row for audit). */
export async function revokeInvitation(id: string) {
  const inv = await requireInvitation(id);
  return prisma.team_invitations.update({
    where: { id: inv.id },
    data: { status: "revoked" },
  });
}
