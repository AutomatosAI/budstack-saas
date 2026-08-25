"use server";

import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions/require-page-permission";
import { getActiveAdminTenant } from "@/lib/tenant/active-admin-tenant";
import { getTenantDrGreenConfig } from "@/lib/tenant/tenant-config";
import {
  sweepClientStatuses,
  planStatusUpdates,
} from "@/lib/drgreen/client-status-sweep";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { logger } from "@/lib/logger";

/** Minimum interval between refreshes per tenant. */
const REFRESH_THROTTLE_MS = 60_000;

export interface RefreshStatusResult {
  ok: boolean;
  /** Safe, user-facing message on failure. */
  error?: string;
  updated?: number;
  swept?: number;
  syncedAt?: string;
}

/**
 * "Refresh from Dr Green" — bulk-sync the tenant's customer approval mirror.
 *
 * One paginated sweep of GET /dapp/clients (Dr Green scopes rows to the
 * tenant's partner key), diffed against consultation_questionnaires, writing
 * only changed rows. The audit-log row doubles as the last-synced marker and
 * the throttle, so no schema change is needed (this repo's migrations are
 * hand-applied SQL — a deploy must never depend on one).
 */
export async function refreshCustomerStatuses(): Promise<RefreshStatusResult> {
  // Stricter than the page's view gate: this action WRITES the KYC/approval
  // mirror for every customer, and the customer_support/manager presets hold
  // canViewCustomers as an explicitly read-only grant. Redirects (throws)
  // when unauthenticated or denied — the button is permission-hidden too.
  await requirePagePermission("canEditCustomers");
  const user = await currentUser();

  // Tenant scope, matching the Customers page: impersonating super-admin →
  // impersonated tenant; tenant admin → own tenant. A non-impersonating
  // super-admin has no single tenant to sweep — the UI hides the button.
  let tenantId: string | undefined;
  const active = await getActiveAdminTenant();
  if (active?.isImpersonating) {
    tenantId = active.tenantId;
  } else if (user?.publicMetadata.role === "TENANT_ADMIN") {
    const email = user.emailAddresses[0]?.emailAddress;
    const localUser = email
      ? await prisma.users.findFirst({ where: { email }, select: { tenantId: true } })
      : null;
    tenantId = localUser?.tenantId ?? undefined;
  }

  if (!tenantId) {
    return { ok: false, error: "Select a store to refresh customer statuses." };
  }

  // Throttle from the audit trail — the previous refresh row.
  const lastRefresh = await prisma.audit_logs.findFirst({
    where: { action: AUDIT_ACTIONS.CUSTOMER_STATUS_REFRESHED, tenantId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (lastRefresh && Date.now() - lastRefresh.createdAt.getTime() < REFRESH_THROTTLE_MS) {
    return {
      ok: false,
      error: "Statuses were refreshed less than a minute ago.",
      syncedAt: lastRefresh.createdAt.toISOString(),
    };
  }

  let config;
  try {
    config = await getTenantDrGreenConfig(tenantId);
  } catch {
    return {
      ok: false,
      error: "Dr Green API keys are not configured for this store.",
    };
  }

  // Claim the throttle BEFORE the sweep, not after: the sweep can run for
  // many seconds, and writing the marker only on completion left the whole
  // sweep duration as a race window for concurrent refreshes (double-click,
  // second tab). A failed sweep still holds the 60s throttle — intended.
  await createAuditLog({
    action: AUDIT_ACTIONS.CUSTOMER_STATUS_REFRESHED,
    entityType: "Tenant",
    entityId: tenantId,
    userId: user?.id,
    userEmail: user?.emailAddresses[0]?.emailAddress,
    tenantId,
    metadata: { phase: "started" },
  });

  let swept;
  try {
    swept = await sweepClientStatuses(config);
  } catch (error) {
    logger.error("[status-refresh] sweep failed", {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      error: "Dr Green did not respond — try again in a few minutes.",
    };
  }

  const rows = await prisma.consultation_questionnaires.findMany({
    where: { tenantId },
    select: {
      id: true,
      email: true,
      drGreenClientId: true,
      isKycVerified: true,
      adminApproval: true,
    },
  });

  const updates = planStatusUpdates(swept, rows);

  // Write only changed rows, in small parallel batches.
  const BATCH = 10;
  for (let i = 0; i < updates.length; i += BATCH) {
    await Promise.all(
      updates.slice(i, i + BATCH).map((u) =>
        prisma.consultation_questionnaires.update({
          where: { id: u.questionnaireId },
          data: {
            isKycVerified: u.isKycVerified,
            adminApproval: u.adminApproval,
            ...(u.backfillDrGreenClientId
              ? { drGreenClientId: u.backfillDrGreenClientId }
              : {}),
            updatedAt: new Date(),
          },
        }),
      ),
    );
  }

  // Self-heal users.drGreenClientId (the /api/shop/register history) by
  // email match — only rows actually missing the id are touched.
  const usersMissingId = await prisma.users.findMany({
    where: { tenantId, role: "PATIENT", drGreenClientId: null },
    select: { id: true, email: true },
  });
  const sweptByEmail = new Map(
    swept.filter((c) => c.email).map((c) => [c.email as string, c.clientId]),
  );
  let usersBackfilled = 0;
  for (const u of usersMissingId) {
    const clientId = sweptByEmail.get(u.email.toLowerCase());
    if (!clientId) continue;
    await prisma.users.update({
      where: { id: u.id },
      data: { drGreenClientId: clientId, updatedAt: new Date() },
    });
    usersBackfilled++;
  }

  const syncedAt = new Date();
  await createAuditLog({
    action: AUDIT_ACTIONS.CUSTOMER_STATUS_REFRESHED,
    entityType: "Tenant",
    entityId: tenantId,
    userId: user?.id,
    userEmail: user?.emailAddresses[0]?.emailAddress,
    tenantId,
    metadata: {
      phase: "completed",
      sweptCount: swept.length,
      updatedRows: updates.length,
      usersBackfilled,
    },
  });

  logger.info("[status-refresh] completed", {
    tenantId,
    swept: swept.length,
    updated: updates.length,
    usersBackfilled,
  });

  return {
    ok: true,
    updated: updates.length,
    swept: swept.length,
    syncedAt: syncedAt.toISOString(),
  };
}
