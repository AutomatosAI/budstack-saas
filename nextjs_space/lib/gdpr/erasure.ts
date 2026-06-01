/**
 * GDPR lifecycle — canonical erasure & export (PRD-213).
 *
 * Single shared path used by all three erasure entry points:
 *   - self-service     DELETE /api/account/delete
 *   - admin-assisted   DELETE /api/tenant-admin/customers/[id]
 *   - Clerk webhook    user.deleted
 * and the two export entry points (self-service + admin-assisted).
 *
 * GDPR Article 17 (erasure): direct identifiers are nulled, the email is
 * replaced with a deletion marker, and the local Dr Green linkage is SEVERED
 * so an anonymised record cannot be re-identified through the external medical
 * profile (PRD-213 §1 item 4). Order/consultation history is RETAINED via the
 * user FK because tenants may have legal/financial obligations to keep
 * transaction records — full hard delete is out of scope.
 *
 * GDPR Article 15/20 (access/portability): exportUser returns the personal
 * data we hold plus owned orders/consultations/questionnaires.
 *
 * Every call writes ONE PII-redacted audit_logs row via createAuditLog
 * (lib/audit-log.ts redacts metadata through lib/redact.ts). Idempotent:
 * a second erasure of an already-anonymised user is a no-op that still audits.
 */

import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit-log";

// DPA (Art. 28) constants live in the client-safe lib/gdpr/dpa.ts so the
// onboarding client form can import them without pulling Prisma into the
// client bundle. Re-exported here for server callers that already reach for
// the GDPR module.
export {
  DPA_VERSION,
  DPA_ACCEPTED_AUDIT_ACTION,
  dpaAcceptanceSchema,
  type DpaAcceptance,
} from "@/lib/gdpr/dpa";

/** Marker domain written into the email of an erased user. */
export const ERASURE_EMAIL_DOMAIN = "deleted.local";

/** Sentinel password value stored after erasure (never a usable credential). */
export const ERASURE_PASSWORD_MARKER = "DELETED";

/** Audit actions emitted by the erasure/export flows (string-typed by design;
 *  AUDIT_ACTIONS in lib/audit-log.ts is PRD-208's lane — not modified here). */
export const ERASURE_AUDIT_ACTIONS = {
  SELF: "account.deleted_gdpr_self",
  CLERK: "account.erasure_clerk_user_deleted",
  ADMIN: "account.erasure_admin_assisted",
  NOOP_NOT_FOUND: "account.erasure_noop_user_not_found",
  EXPORTED: "account.data_exported",
} as const;

/** Why an erasure was triggered — determines the audit action + metadata. */
export type ErasureReason =
  | "self_service"
  | "clerk_user_deleted"
  | "admin_assisted";

export interface EraseUserOptions {
  /** Clerk user id — preferred resolution key (matched first). */
  clerkUserId?: string | null;
  /** Email fallback when no clerkUserId match is found. */
  email?: string | null;
  /** Local users.id direct key (admin-assisted path passes this). */
  userId?: string | null;
  /** Why erasure was triggered. */
  reason: ErasureReason;
  /** Clerk id of the admin performing an assisted erasure (audit only). */
  actingAdminId?: string | null;
  /** Whether the caller already tore the Clerk user down (audit metadata). */
  clerkDeleted?: boolean;
  /** Client info for the audit row (ip/userAgent). */
  clientInfo?: { ipAddress?: string; userAgent?: string };
}

/** The minimal user shape erasure needs to resolve + anonymise. */
export interface ResolvedUser {
  id: string;
  email: string;
  name: string | null;
  tenantId: string | null;
  role: string;
  drGreenClientId: string | null;
}

const RESOLVE_SELECT = {
  id: true,
  email: true,
  name: true,
  tenantId: true,
  role: true,
  drGreenClientId: true,
} as const;

/**
 * Resolve a local user by clerkUserId first, then explicit userId, then email.
 * Returns null when nothing matches (caller audits the no-op).
 */
export async function resolveLocalUser(
  opts: Pick<EraseUserOptions, "clerkUserId" | "userId" | "email">,
): Promise<ResolvedUser | null> {
  if (opts.clerkUserId) {
    const byClerk = await prisma.users.findUnique({
      where: { clerkUserId: opts.clerkUserId },
      select: RESOLVE_SELECT,
    });
    if (byClerk) return byClerk as ResolvedUser;
  }

  if (opts.userId) {
    const byId = await prisma.users.findUnique({
      where: { id: opts.userId },
      select: RESOLVE_SELECT,
    });
    if (byId) return byId as ResolvedUser;
  }

  if (opts.email) {
    const byEmail = await prisma.users.findFirst({
      where: { email: opts.email },
      select: RESOLVE_SELECT,
    });
    if (byEmail) return byEmail as ResolvedUser;
  }

  return null;
}

/**
 * Build the immutable anonymisation payload for a user. Nulls every direct
 * identifier, replaces the email with a per-id deletion marker, and SEVERS the
 * Dr Green linkage (drGreenClientId -> null). Returns a new object only.
 */
export function buildAnonymizedUserData(userId: string): {
  email: string;
  name: string;
  firstName: null;
  lastName: null;
  phone: null;
  address: null;
  password: string;
  isActive: false;
  resetToken: null;
  resetTokenExpiry: null;
  drGreenClientId: null;
  clerkUserId: null;
} {
  return {
    email: `deleted-${userId}@${ERASURE_EMAIL_DOMAIN}`,
    name: "Deleted User",
    firstName: null,
    lastName: null,
    phone: null,
    address: null,
    password: ERASURE_PASSWORD_MARKER,
    isActive: false,
    resetToken: null,
    resetTokenExpiry: null,
    drGreenClientId: null,
    clerkUserId: null,
  };
}

/** True once a user has already been anonymised (idempotency guard). */
export function isAlreadyErased(user: Pick<ResolvedUser, "email">): boolean {
  return user.email.endsWith(`@${ERASURE_EMAIL_DOMAIN}`);
}

function auditActionForReason(reason: ErasureReason): string {
  switch (reason) {
    case "clerk_user_deleted":
      return ERASURE_AUDIT_ACTIONS.CLERK;
    case "admin_assisted":
      return ERASURE_AUDIT_ACTIONS.ADMIN;
    case "self_service":
    default:
      return ERASURE_AUDIT_ACTIONS.SELF;
  }
}

export interface EraseUserResult {
  /** Whether a local user was found at all. */
  matchedLocalUser: boolean;
  /** Whether an anonymisation write was performed (false if already erased). */
  anonymized: boolean;
  /** Whether the local Dr Green linkage was cleared by this call. */
  drGreenLinkageCleared: boolean;
  /** The resolved user id, when matched. */
  userId?: string;
}

/**
 * Canonical erasure. Resolves the local user, anonymises PII + severs the Dr
 * Green linkage, and writes a redacted audit row. Idempotent and safe to call
 * twice. When no user is found, writes a `erasure_noop_user_not_found` row so a
 * missed Clerk mapping is visible rather than silent (AC-1b).
 */
export async function eraseUser(
  opts: EraseUserOptions,
): Promise<EraseUserResult> {
  const user = await resolveLocalUser(opts);

  if (!user) {
    await createAuditLog({
      action: ERASURE_AUDIT_ACTIONS.NOOP_NOT_FOUND,
      entityType: "User",
      userId: opts.actingAdminId || undefined,
      userEmail: opts.email || undefined,
      metadata: {
        reason: opts.reason,
        clerkUserId: opts.clerkUserId || null,
        lookupEmail: opts.email || null,
      },
      ...(opts.clientInfo ?? {}),
    });
    return {
      matchedLocalUser: false,
      anonymized: false,
      drGreenLinkageCleared: false,
    };
  }

  const drGreenLinkageCleared = user.drGreenClientId !== null;
  const alreadyErased = isAlreadyErased(user);

  if (!alreadyErased) {
    await prisma.users.update({
      where: { id: user.id },
      data: buildAnonymizedUserData(user.id),
    });
  }

  await createAuditLog({
    action: auditActionForReason(opts.reason),
    entityType: "User",
    entityId: user.id,
    userId: opts.actingAdminId || opts.clerkUserId || undefined,
    userEmail: user.email,
    tenantId: user.tenantId || undefined,
    metadata: {
      reason: opts.reason,
      matchedLocalUser: true,
      idempotentNoop: alreadyErased,
      clerkDeleted: opts.clerkDeleted ?? false,
      clerkUserId: opts.clerkUserId || null,
      actingAdminId: opts.actingAdminId || null,
      deletionType: "anonymization",
      targetUserEmail: user.email,
      targetUserName: user.name,
      drGreenLinkageCleared,
      // Dr Green exposes no client delete/anonymise endpoint (PRD-213 OQ-2):
      // local linkage is severed; remote deletion is not requestable today.
      drGreenRemoteDeletionRequested: false,
    },
    ...(opts.clientInfo ?? {}),
  });

  return {
    matchedLocalUser: true,
    anonymized: !alreadyErased,
    drGreenLinkageCleared,
    userId: user.id,
  };
}

export interface ExportUserOptions {
  clerkUserId?: string | null;
  email?: string | null;
  userId?: string | null;
  /** Clerk id of the requester (audit `userId`). */
  requestedByClerkId?: string | null;
  clientInfo?: { ipAddress?: string; userAgent?: string };
}

export interface ExportedUserData {
  exportedAt: string;
  profile: Record<string, unknown>;
  orders: unknown[];
  consultations: unknown[];
  questionnaires: unknown[];
  notes: string[];
}

/**
 * Canonical export (Art. 15/20). Returns the personal data we hold plus owned
 * orders/consultations/questionnaires, and writes a redacted audit row. Returns
 * null when no local user is found (caller maps to 404).
 */
export async function exportUser(
  opts: ExportUserOptions,
): Promise<ExportedUserData | null> {
  const profile = await prisma.users.findFirst({
    where: opts.clerkUserId
      ? { clerkUserId: opts.clerkUserId }
      : opts.userId
        ? { id: opts.userId }
        : { email: opts.email ?? "" },
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      phone: true,
      address: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      tenantId: true,
      drGreenClientId: true,
    },
  });

  if (!profile) return null;

  const [orders, consultations, questionnaires] = await Promise.all([
    prisma.orders.findMany({
      where: { userId: profile.id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.consultations.findMany({
      where: { userId: profile.id },
      select: { id: true, status: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.consultation_questionnaires.findMany({
      where: { email: { equals: profile.email, mode: "insensitive" } },
      select: {
        id: true,
        isKycVerified: true,
        adminApproval: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  await createAuditLog({
    action: ERASURE_AUDIT_ACTIONS.EXPORTED,
    entityType: "User",
    entityId: profile.id,
    userId: opts.requestedByClerkId || undefined,
    userEmail: profile.email,
    tenantId: profile.tenantId || undefined,
    metadata: {
      recordCounts: {
        orders: orders.length,
        consultations: consultations.length,
        questionnaires: questionnaires.length,
      },
    },
    ...(opts.clientInfo ?? {}),
  });

  return {
    exportedAt: new Date().toISOString(),
    profile,
    orders,
    consultations,
    questionnaires,
    notes: [
      "This export contains the personal data we hold about you in the BudStack platform.",
      "It does not include data held by integrated providers (e.g. Dr Green, Clerk) — request those from the providers directly.",
    ],
  };
}
