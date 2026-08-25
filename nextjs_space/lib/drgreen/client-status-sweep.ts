import {
  doctorGreenRequest,
  extractClientsFromResponse,
  type DoctorGreenConfig,
} from "@/lib/drgreen/doctor-green-api";
import { canonicalAdminApproval, type AdminApproval } from "@/lib/drgreen/approval-status";
import { logger } from "@/lib/logger";

/**
 * Bulk client-status sweep for the tenant-admin "Refresh from Dr Green".
 *
 * Pages GET /dapp/clients (partner-key authed; Dr Green scopes rows to the
 * key's nftId server-side) and returns the status fields per client. This is
 * the ONLY sanctioned way to hydrate many statuses: the single-client
 * endpoint has a history of upstream 401s (see fetchClient's scan fallback)
 * and over-fetches the client's medicalRecord, which must never transit for
 * an admin list (PII).
 */

export interface SweptClientStatus {
  clientId: string;
  email: string | null;
  adminApproval: AdminApproval | null;
  isKYCVerified: boolean;
  isActive: boolean;
  verificationType: string | null;
  verifiedAt: string | null;
  rejectedAt: string | null;
}

const PAGE_SIZE = 200;
/** Same reach budget as scanClientList — a runaway-pagination backstop. */
const MAX_PAGES = 40;
/** The shared Dr Green client has no request timeout, so a hung upstream
 *  would pin the refresh action (and its throttle) indefinitely — bound each
 *  page and the whole sweep here instead of touching the shared transport. */
const PAGE_TIMEOUT_MS = 15_000;
const SWEEP_DEADLINE_MS = 60_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function sweepClientStatuses(
  config: DoctorGreenConfig,
): Promise<SweptClientStatus[]> {
  const results: SweptClientStatus[] = [];
  const seen = new Set<string>();
  const deadline = Date.now() + SWEEP_DEADLINE_MS;

  for (let page = 1; page <= MAX_PAGES; page++) {
    if (Date.now() > deadline) {
      throw new Error("client status sweep exceeded its time budget");
    }
    const response = await withTimeout(
      doctorGreenRequest<any>("/dapp/clients", {
        config,
        queryParams: { take: PAGE_SIZE, page, orderBy: "desc" },
      }),
      PAGE_TIMEOUT_MS,
      `client status sweep page ${page}`,
    );

    const clients = extractClientsFromResponse(response);
    if (clients.length === 0) break;

    for (const client of clients) {
      const clientId = typeof client?.id === "string" ? client.id : null;
      if (!clientId || seen.has(clientId)) continue;
      seen.add(clientId);
      results.push({
        clientId,
        email:
          typeof client?.email === "string" && client.email.trim()
            ? client.email.trim().toLowerCase()
            : null,
        adminApproval: canonicalAdminApproval(client?.adminApproval),
        isKYCVerified: client?.isKYCVerified === true,
        isActive: client?.isActive === true,
        verificationType:
          typeof client?.verificationType === "string" ? client.verificationType : null,
        verifiedAt: typeof client?.verifiedAt === "string" ? client.verifiedAt : null,
        rejectedAt: typeof client?.rejectedAt === "string" ? client.rejectedAt : null,
      });
    }

    if (clients.length < PAGE_SIZE) break;
    if (page === MAX_PAGES) {
      logger.warn("[status-sweep] page budget exhausted — tenant list truncated", {
        collected: results.length,
      });
    }
  }

  return results;
}

// ── Update planning (pure — unit-tested) ─────────────────────────

export interface MirrorRow {
  id: string;
  email: string;
  drGreenClientId: string | null;
  isKycVerified: boolean;
  adminApproval: string | null;
}

export interface PlannedUpdate {
  questionnaireId: string;
  isKycVerified: boolean;
  adminApproval: AdminApproval;
  /** Set when the row was matched by email and had no stored client id. */
  backfillDrGreenClientId?: string;
}

/**
 * Diff swept Dr Green statuses against the tenant's mirror rows and return
 * only the rows that actually need writing. Matching precedence:
 * drGreenClientId first, then lowercased email (also self-healing the
 * missing client id on email matches — the /api/shop/register history).
 * Swept clients with no matching local row are ignored: the sweep never
 * invents questionnaires.
 */
export function planStatusUpdates(
  swept: SweptClientStatus[],
  rows: MirrorRow[],
): PlannedUpdate[] {
  const byClientId = new Map<string, MirrorRow[]>();
  const byEmail = new Map<string, MirrorRow[]>();
  for (const row of rows) {
    if (row.drGreenClientId) {
      const list = byClientId.get(row.drGreenClientId) ?? [];
      list.push(row);
      byClientId.set(row.drGreenClientId, list);
    }
    const emailKey = row.email.trim().toLowerCase();
    const list = byEmail.get(emailKey) ?? [];
    list.push(row);
    byEmail.set(emailKey, list);
  }

  const updates: PlannedUpdate[] = [];
  const planned = new Set<string>();

  for (const client of swept) {
    // A client with no canonical approval value gives us nothing to mirror.
    const approval = client.adminApproval;
    if (!approval) continue;

    const idMatches = byClientId.get(client.clientId) ?? [];
    const matches =
      idMatches.length > 0
        ? idMatches
        : client.email
          ? (byEmail.get(client.email) ?? []).filter((r) => !r.drGreenClientId)
          : [];

    for (const row of matches) {
      if (planned.has(row.id)) continue;
      const needsBackfill = !row.drGreenClientId;
      const changed =
        row.isKycVerified !== client.isKYCVerified ||
        canonicalAdminApproval(row.adminApproval) !== approval ||
        // Rewrite legacy literals ("APPROVED") to the canonical value even
        // when they canonicalise equal — the sweep is the self-heal path.
        row.adminApproval !== approval;
      if (!changed && !needsBackfill) continue;
      planned.add(row.id);
      updates.push({
        questionnaireId: row.id,
        isKycVerified: client.isKYCVerified,
        adminApproval: approval,
        ...(needsBackfill ? { backfillDrGreenClientId: client.clientId } : {}),
      });
    }
  }

  return updates;
}
