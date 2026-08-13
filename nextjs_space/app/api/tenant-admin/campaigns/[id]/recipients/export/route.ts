import { NextResponse } from "next/server";

import { streamCsv, type CsvPage } from "@/lib/admin/csv-stream";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import {
  CAMPAIGN_EXPORT_MAX_ROWS,
  CAMPAIGN_EXPORT_PAGE_SIZE,
  CAMPAIGN_EXPORT_RATE_LIMIT,
  CAMPAIGN_RECIPIENT_CSV_HEADER,
  campaignExportRateLimitKey,
  campaignRecipientCsvFilename,
  campaignRecipientCsvRow,
  type CampaignRecipientExportRow,
} from "@/lib/email/campaign-export";
import { requirePermissionParams } from "@/lib/permissions/require-permission";
import { can } from "@/lib/permissions/resolve";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { runWithTenantContextAsync } from "@/lib/tenant/tenant-context";
import { parseUuid } from "@/lib/validation/parse-uuid";

const ROUTE = "GET /api/tenant-admin/campaigns/[id]/recipients/export";

const NOT_FOUND_MESSAGE = "Campaign not found or access denied";

const FORBIDDEN_MESSAGE = "You do not have permission to do that.";

/** One page of recipients, keyed on the id cursor the previous page ended at. */
interface RecipientRow {
  id: string;
  email: string;
  status: CampaignRecipientExportRow["status"];
  createdAt: Date | null;
  unsubscribedAt: Date | null;
  error: string | null;
  emailLogId: string | null;
}

interface LogRow {
  id: string;
  sentAt: Date | null;
  errorMessage: string | null;
  smtpResponse: string | null;
}

/**
 * Read one page and attach each row's linked log (US-008).
 *
 * Two queries per page rather than a Prisma `include`: `emailLogId` is a plain
 * column, not a relation — deliberately, so a recipient row outlives a pruned
 * log — so the join is made here, over at most one page of ids. `tenantId` is
 * re-asserted on the log read: `email_logs` is a tenant-scoped model and a
 * linkage column is a weaker guarantee than the filter that would catch it
 * being wrong.
 */
async function readRecipientPage(
  campaignId: string,
  tenantId: string,
  cursor: string | null,
): Promise<CsvPage<CampaignRecipientExportRow>> {
  const rows: RecipientRow[] = await prisma.campaign_recipients.findMany({
    where: {
      campaignId,
      ...(cursor ? { id: { gt: cursor } } : {}),
    },
    select: {
      id: true,
      email: true,
      status: true,
      createdAt: true,
      unsubscribedAt: true,
      error: true,
      emailLogId: true,
    },
    // Keyset pagination on the primary key: `skip` is O(offset), and an export
    // that pages with it does quadratic work on exactly the campaigns big
    // enough to need streaming in the first place.
    orderBy: { id: "asc" },
    take: CAMPAIGN_EXPORT_PAGE_SIZE,
  });

  if (rows.length === 0) return { rows: [], nextCursor: null };

  const logIds = rows
    .map((row) => row.emailLogId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  const logs: LogRow[] = logIds.length
    ? await prisma.email_logs.findMany({
        where: { id: { in: logIds }, tenantId },
        select: {
          id: true,
          sentAt: true,
          errorMessage: true,
          smtpResponse: true,
        },
      })
    : [];

  const byId = new Map(logs.map((log) => [log.id, log]));

  return {
    rows: rows.map((row) => {
      const log = row.emailLogId ? byId.get(row.emailLogId) : undefined;
      return {
        email: row.email,
        status: row.status,
        createdAt: row.createdAt,
        unsubscribedAt: row.unsubscribedAt,
        error: row.error,
        deliveredAt: log?.sentAt ?? null,
        logError: log?.errorMessage ?? null,
        logResponse: log?.smtpResponse ?? null,
      };
    }),
    // A short page is the last page; a full one may not be, so the cursor
    // advances and the next pull decides.
    nextCursor:
      rows.length < CAMPAIGN_EXPORT_PAGE_SIZE
        ? null
        : rows[rows.length - 1].id,
  };
}

/**
 * The same page read, with the tenant context bound around it.
 *
 * THIS IS NOT BELT-AND-BRACES. Every other route inherits the context
 * `withTenantAuth` binds, because its queries run while the handler is still on
 * the stack. These do not: the handler returns a stream and each page is read
 * later, from the response writer's own async context, by which point the ALS
 * store that wrapped the handler is long gone. `email_logs` is a tenant-scoped
 * model, so an unbound read of it warns on `security.tenant_context_missing`
 * today and THROWS the moment TENANT_CONTEXT_STRICT is enabled — mid-download,
 * on every campaign that has a linked log, which is all of them. The explicit
 * tenantId in each `where` is what makes these queries correct; this is what
 * keeps them legal. Same reasoning as the campaign page's Server Component,
 * and the same reasoning the worker's `bypassTenantScope` follows.
 */
function fetchRecipientPage(
  campaignId: string,
  tenantId: string,
  cursor: string | null,
): Promise<CsvPage<CampaignRecipientExportRow>> {
  return runWithTenantContextAsync(tenantId, () =>
    readRecipientPage(campaignId, tenantId, cursor),
  );
}

/**
 * GET /api/tenant-admin/campaigns/[id]/recipients/export — US-026.
 *
 * Every address a campaign was fanned out to, with its outcome, streamed as
 * CSV. This is the one campaign endpoint that hands over the mailing list
 * itself, which is why it is gated on `canExportCustomers` and not on the
 * `canViewEmails` that opens the results page: a support agent who may read how
 * a campaign performed is not thereby someone who may walk away with the list.
 *
 * BOTH permissions are required. `canExportCustomers` alone belongs to a role
 * that may export the customers it can already see; it is not a way into the
 * email surface US-009 closed, and the addresses here include newsletter
 * subscribers who are not customers at all.
 */
export const GET = requirePermissionParams(
  "canExportCustomers",
  async (_req, { user, tenantId, permissions }, params) => {
    try {
      if (!can(permissions, "canViewEmails")) {
        return apiError(new Error(FORBIDDEN_MESSAGE), {
          route: ROUTE,
          status: 403,
          safeMessage: FORBIDDEN_MESSAGE,
        });
      }

      const id = parseUuid(params.id);

      const limit = await checkRateLimit(
        campaignExportRateLimitKey(user.id),
        CAMPAIGN_EXPORT_RATE_LIMIT,
      );
      if (!limit.success) return limit.response;

      // Ownership BEFORE a single byte is streamed: once the response has a 200
      // and a chunk on the wire, a 404 is no longer available.
      const campaign: { id: string } | null = await prisma.campaigns.findFirst({
        where: { id, tenantId },
        select: { id: true },
      });

      if (!campaign) {
        return apiError(new Error(NOT_FOUND_MESSAGE), {
          route: ROUTE,
          status: 404,
          safeMessage: NOT_FOUND_MESSAGE,
        });
      }

      const body = streamCsv<CampaignRecipientExportRow>({
        header: CAMPAIGN_RECIPIENT_CSV_HEADER,
        fetchPage: (cursor) => fetchRecipientPage(campaign.id, tenantId, cursor),
        toRow: campaignRecipientCsvRow,
        maxRows: CAMPAIGN_EXPORT_MAX_ROWS,
      });

      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${campaignRecipientCsvFilename(campaign.id, new Date())}"`,
          // The file is generated per request and contains customer addresses.
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      return apiError(error, { route: ROUTE });
    }
  },
);
