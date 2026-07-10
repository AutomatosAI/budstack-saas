import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { IMPERSONATION_COOKIE } from "./constants";
import { hashImpersonationToken } from "./token";
import { rejectSessionRow } from "./validate";

/**
 * PRD-302: request-time resolution of the impersonation cookie to a live
 * session. READ-ONLY by design — this runs inside getCurrentUser() on every
 * authenticated API request and inside the tenant-admin layout render, so it
 * must never write (expired rows are stamped by the lazy-expire sweep in
 * sessions.ts, which runs on the start/end/list endpoints).
 */

export interface ActiveImpersonation {
  sessionId: string;
  tenantId: string;
  tenantBusinessName: string;
  tenantSubdomain: string;
  tenantEmail: string | null;
  superAdminClerkId: string;
  superAdminEmail: string;
  startedAt: Date;
  expiresAt: Date;
}

/**
 * Resolve the caller's impersonation cookie to an active session.
 *
 * Only ever called AFTER the caller is known to be a SUPER_ADMIN — the cookie is
 * ignored entirely for every other role (fail-closed; a stolen or stale cookie
 * on a non-super-admin session grants nothing). Returns null outside a request
 * scope (build/cron) or when the cookie is absent/invalid/expired/foreign.
 */
export async function resolveActiveImpersonation(
  clerkUserId: string,
): Promise<ActiveImpersonation | null> {
  let rawToken: string | undefined;
  try {
    rawToken = cookies().get(IMPERSONATION_COOKIE)?.value;
  } catch {
    // cookies() throws outside a request scope (static build, cron) — no session.
    return null;
  }
  if (!rawToken) return null;

  const row = await prisma.impersonation_sessions.findFirst({
    where: { tokenHash: hashImpersonationToken(rawToken) },
    include: {
      tenants: {
        select: {
          businessName: true,
          subdomain: true,
          isActive: true,
          deletedAt: true,
        },
      },
    },
  });
  if (!row) return null;

  const rejection = rejectSessionRow(
    {
      superAdminClerkId: row.superAdminClerkId,
      endedAt: row.endedAt,
      expiresAt: row.expiresAt,
      tenant: row.tenants
        ? { isActive: row.tenants.isActive, deletedAt: row.tenants.deletedAt }
        : null,
    },
    clerkUserId,
    new Date(),
  );
  if (rejection) {
    // A foreign cookie on a super-admin session is anomalous enough to log
    // (never the token). Expired/ended cookies are routine — stay quiet.
    if (rejection === "not_owner") {
      logger.warn("[impersonation] cookie/session owner mismatch — ignored", {
        sessionId: row.id,
        clerkUserId,
      });
    }
    return null;
  }

  return {
    sessionId: row.id,
    tenantId: row.tenantId,
    tenantBusinessName: row.tenants?.businessName ?? "Unknown tenant",
    tenantSubdomain: row.tenants?.subdomain ?? "",
    tenantEmail: row.tenantEmail,
    superAdminClerkId: row.superAdminClerkId,
    superAdminEmail: row.superAdminEmail,
    startedAt: row.startedAt,
    expiresAt: row.expiresAt,
  };
}
