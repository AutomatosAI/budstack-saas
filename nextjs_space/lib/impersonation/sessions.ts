import crypto from "crypto";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-error";
import { impersonationExpiry } from "./constants";
import { generateImpersonationToken, hashImpersonationToken } from "./token";

/**
 * PRD-302: impersonation session lifecycle (write side).
 *
 * All functions here are reached ONLY via withSuperAdmin routes (tenant context
 * explicitly bound to null) or the Clerk user.deleted webhook. Explicit return
 * types on every export — `prisma` is `any` (lib/db.ts), and un-annotated
 * returns break strict implicit-any in `next build` (the PR #188 lesson).
 */

export interface ImpersonationSessionRecord {
  id: string;
  superAdminClerkId: string;
  superAdminEmail: string;
  tenantId: string;
  tenantEmail: string | null;
  startedAt: Date;
  expiresAt: Date;
  endedAt: Date | null;
  endedReason: string | null;
  superAdminIpAddress: string | null;
  notes: string | null;
}

export interface StartImpersonationResult {
  session: ImpersonationSessionRecord;
  /** Raw bearer token for the cookie — returned once, never persisted. */
  rawToken: string;
  tenantBusinessName: string;
}

export interface StartImpersonationParams {
  superAdminClerkId: string;
  superAdminEmail: string;
  tenantId: string;
  notes?: string | null;
  ipAddress?: string | null;
}

/**
 * Start an impersonation session against an active tenant.
 *
 * Any prior active session for this super-admin is ended with reason
 * 'replaced' first — a browser holds exactly one impersonation cookie, and the
 * partial unique index enforces one active row per admin at the DB level.
 */
export async function startImpersonation(
  params: StartImpersonationParams,
): Promise<StartImpersonationResult> {
  const tenant = await prisma.tenants.findFirst({
    where: { id: params.tenantId, isActive: true, deletedAt: null },
    select: { id: true, businessName: true },
  });
  if (!tenant) {
    throw new ApiError("Tenant not found or not active.", 404);
  }

  // Snapshot the tenant's owner-admin email for the sessions table / banner —
  // tenants have no email column. Oldest TENANT_ADMIN row = the owner by the
  // PRD-301 onboarding convention. Explicit tenantId filter: this runs under an
  // explicitly-null tenant context, so nothing is auto-scoped.
  const owner = await prisma.users.findFirst({
    where: { tenantId: params.tenantId, role: "TENANT_ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { email: true },
  });

  const now = new Date();
  await prisma.impersonation_sessions.updateMany({
    where: { superAdminClerkId: params.superAdminClerkId, endedAt: null },
    data: { endedAt: now, endedReason: "replaced" },
  });

  const rawToken = generateImpersonationToken();
  const session = await prisma.impersonation_sessions.create({
    data: {
      id: crypto.randomUUID(),
      superAdminClerkId: params.superAdminClerkId,
      superAdminEmail: params.superAdminEmail,
      tenantId: params.tenantId,
      tenantEmail: owner?.email ?? null,
      tokenHash: hashImpersonationToken(rawToken),
      startedAt: now,
      expiresAt: impersonationExpiry(now),
      superAdminIpAddress: params.ipAddress ?? null,
      notes: params.notes ?? null,
    },
  });

  return {
    session: toRecord(session),
    rawToken,
    tenantBusinessName: tenant.businessName,
  };
}

/**
 * End the caller's active session (banner "Exit Impersonation", or GDPR/webhook
 * cleanup). Returns the ended session, or null when none was active — ending is
 * idempotent so a stale banner click still lands on a clean state.
 */
export async function endImpersonation(
  superAdminClerkId: string,
  reason: "manual" | "super_admin_deleted",
): Promise<ImpersonationSessionRecord | null> {
  const active = await prisma.impersonation_sessions.findFirst({
    where: { superAdminClerkId, endedAt: null },
  });
  if (!active) return null;

  const ended = await prisma.impersonation_sessions.update({
    where: { id: active.id },
    data: { endedAt: new Date(), endedReason: reason },
  });
  return toRecord(ended);
}

/**
 * Stamp endedAt/'timeout' on every over-deadline active session. Runs on the
 * start/end/list endpoints (NOT on the hot auth path). Raw SQL so endedAt gets
 * each row's own expiresAt — accurate durations, no read-modify-write loop.
 */
export async function lazyExpireSessions(): Promise<number> {
  const count = await prisma.$executeRaw`
    UPDATE "impersonation_sessions"
    SET "endedAt" = "expiresAt", "endedReason" = 'timeout'
    WHERE "endedAt" IS NULL AND "expiresAt" < NOW()
  `;
  return Number(count);
}

export type SessionStatusFilter = "all" | "active" | "completed";

export interface ImpersonationSessionListItem {
  id: string;
  superAdminEmail: string;
  tenantId: string;
  tenantName: string;
  tenantEmail: string | null;
  startedAt: Date;
  endedAt: Date | null;
  endedReason: string | null;
  expiresAt: Date;
  durationSeconds: number;
  status: "active" | "completed";
  ipAddress: string | null;
  notes: string | null;
}

export interface ListSessionsResult {
  sessions: ImpersonationSessionListItem[];
  total: number;
}

/** AC-3: sessions table, newest first. Sweeps expired rows before reading. */
export async function listSessions(options: {
  status: SessionStatusFilter;
  limit: number;
  offset: number;
}): Promise<ListSessionsResult> {
  await lazyExpireSessions();

  const where =
    options.status === "active"
      ? { endedAt: null }
      : options.status === "completed"
        ? { endedAt: { not: null } }
        : {};

  const [rows, total] = await Promise.all([
    prisma.impersonation_sessions.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: options.limit,
      skip: options.offset,
      include: { tenants: { select: { businessName: true } } },
    }),
    prisma.impersonation_sessions.count({ where }),
  ]);

  const now = Date.now();
  const sessions: ImpersonationSessionListItem[] = rows.map(
    (row: {
      id: string;
      superAdminEmail: string;
      tenantId: string;
      tenantEmail: string | null;
      startedAt: Date;
      endedAt: Date | null;
      endedReason: string | null;
      expiresAt: Date;
      superAdminIpAddress: string | null;
      notes: string | null;
      tenants: { businessName: string } | null;
    }) => ({
      id: row.id,
      superAdminEmail: row.superAdminEmail,
      tenantId: row.tenantId,
      tenantName: row.tenants?.businessName ?? "(deleted tenant)",
      tenantEmail: row.tenantEmail,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      endedReason: row.endedReason,
      expiresAt: row.expiresAt,
      durationSeconds: Math.max(
        0,
        Math.floor(
          ((row.endedAt?.getTime() ?? now) - row.startedAt.getTime()) / 1000,
        ),
      ),
      status: row.endedAt === null ? "active" : "completed",
      ipAddress: row.superAdminIpAddress,
      notes: row.notes,
    }),
  );

  return { sessions, total };
}

/** A single session row (audit-log page header). Null when unknown. */
export async function getSessionById(
  sessionId: string,
): Promise<(ImpersonationSessionRecord & { tenantName: string }) | null> {
  const row = await prisma.impersonation_sessions.findFirst({
    where: { id: sessionId },
    include: { tenants: { select: { businessName: true } } },
  });
  if (!row) return null;
  return {
    ...toRecord(row),
    tenantName: row.tenants?.businessName ?? "(deleted tenant)",
  };
}

function toRecord(row: {
  id: string;
  superAdminClerkId: string;
  superAdminEmail: string;
  tenantId: string;
  tenantEmail: string | null;
  startedAt: Date;
  expiresAt: Date;
  endedAt: Date | null;
  endedReason: string | null;
  superAdminIpAddress: string | null;
  notes: string | null;
}): ImpersonationSessionRecord {
  return {
    id: row.id,
    superAdminClerkId: row.superAdminClerkId,
    superAdminEmail: row.superAdminEmail,
    tenantId: row.tenantId,
    tenantEmail: row.tenantEmail,
    startedAt: row.startedAt,
    expiresAt: row.expiresAt,
    endedAt: row.endedAt,
    endedReason: row.endedReason,
    superAdminIpAddress: row.superAdminIpAddress,
    notes: row.notes,
  };
}
