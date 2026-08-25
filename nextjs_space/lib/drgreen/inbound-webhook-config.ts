import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/security/encryption";
import { logger } from "@/lib/logger";

/**
 * Inbound partner-webhook config (Dr Green → BudStacks).
 *
 * Platform scope, not tenant scope: Dr Green signs with ONE shared secret for
 * the whole platform and BudStacks routes each event to a tenant internally
 * (clientId → questionnaire → tenant). A tenant admin must never see or set
 * this value — it authenticates events for every tenant.
 *
 * Resolution order for the verification secret:
 *   1. platform_webhook_config.secret (set in super-admin, encrypted at rest)
 *   2. DRGREEN_WEBHOOK_SECRET env var (the pre-existing mechanism)
 *
 * Every read FAILS SOFT: a missing table (migration not yet applied), an
 * unreadable row or an undecryptable value falls through to the env var
 * rather than throwing. Inbound verification is a live path — it must never
 * start rejecting Dr Green because an admin-console feature is half-deployed.
 */

/** The one channel that exists today. */
export const DRGREEN_CHANNEL = "drgreen";

export interface InboundWebhookStatus {
  /** A secret is available from some source. */
  configured: boolean;
  /** Where the active secret comes from — null when there is none. */
  source: "database" | "environment" | null;
  /** Channel switched off in the console (rejects even valid signatures). */
  isEnabled: boolean;
  /** False when the table is missing — i.e. the migration has not been run. */
  tableProvisioned: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface StoredRow {
  secret: string | null;
  isEnabled: boolean;
  updatedAt: Date;
  updatedBy: string | null;
}

/** Read the stored row, or null if unavailable for ANY reason. */
async function readRow(channel: string): Promise<StoredRow | null> {
  try {
    const row = await prisma.platform_webhook_config.findUnique({
      where: { id: channel },
      select: { secret: true, isEnabled: true, updatedAt: true, updatedBy: true },
    });
    return row ?? null;
  } catch (error) {
    // Missing table (migration not applied) or any other read failure.
    logger.info("[inbound-webhook] config table unreadable — using env", {
      channel,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function envSecret(): string | null {
  const value = process.env.DRGREEN_WEBHOOK_SECRET;
  return value && value.trim() ? value : null;
}

export interface InboundVerification {
  /** False = the console switched this channel off; reject the delivery. */
  enabled: boolean;
  /** Platform secret to verify with; null = keep the per-tenant fallback. */
  secret: string | null;
}

/**
 * What the inbound receiver needs to decide how to authenticate a delivery.
 * `enabled: false` is a deliberate rejection, distinct from `secret: null`
 * (nothing configured platform-wide — the caller keeps its existing
 * per-tenant verification path).
 */
export async function resolveInboundVerification(
  channel: string = DRGREEN_CHANNEL,
): Promise<InboundVerification> {
  const row = await readRow(channel);

  if (row && !row.isEnabled) {
    logger.warn("[inbound-webhook] channel disabled in super-admin", { channel });
    return { enabled: false, secret: null };
  }

  if (row?.secret) {
    try {
      return { enabled: true, secret: decrypt(row.secret, { allowUnencryptedMigration: true }) };
    } catch (error) {
      // A stored value we cannot read must not take the channel down.
      logger.error("[inbound-webhook] stored secret undecryptable — using env", {
        channel,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { enabled: true, secret: envSecret() };
}

/** Console status — never returns the secret itself. */
export async function getInboundWebhookStatus(
  channel: string = DRGREEN_CHANNEL,
): Promise<InboundWebhookStatus> {
  let tableProvisioned = true;
  let row: StoredRow | null = null;
  try {
    row = await prisma.platform_webhook_config.findUnique({
      where: { id: channel },
      select: { secret: true, isEnabled: true, updatedAt: true, updatedBy: true },
    });
  } catch {
    tableProvisioned = false;
  }

  const hasStored = Boolean(row?.secret);
  const hasEnv = Boolean(envSecret());

  return {
    configured: hasStored || hasEnv,
    source: hasStored ? "database" : hasEnv ? "environment" : null,
    isEnabled: row?.isEnabled ?? true,
    tableProvisioned,
    updatedAt: row?.updatedAt?.toISOString() ?? null,
    updatedBy: row?.updatedBy ?? null,
  };
}

/** Store (or rotate) the secret. Encrypted at rest; never read back out. */
export async function saveInboundWebhookSecret(params: {
  channel?: string;
  secret: string;
  updatedBy: string;
}): Promise<void> {
  const channel = params.channel ?? DRGREEN_CHANNEL;
  const encrypted = encrypt(params.secret);
  const now = new Date();
  await prisma.platform_webhook_config.upsert({
    where: { id: channel },
    update: { secret: encrypted, updatedBy: params.updatedBy, updatedAt: now },
    create: {
      id: channel,
      secret: encrypted,
      isEnabled: true,
      updatedBy: params.updatedBy,
      updatedAt: now,
    },
  });
}

/** Turn the channel on/off without discarding the stored secret. */
export async function setInboundWebhookEnabled(params: {
  channel?: string;
  isEnabled: boolean;
  updatedBy: string;
}): Promise<void> {
  const channel = params.channel ?? DRGREEN_CHANNEL;
  const now = new Date();
  await prisma.platform_webhook_config.upsert({
    where: { id: channel },
    update: { isEnabled: params.isEnabled, updatedBy: params.updatedBy, updatedAt: now },
    create: {
      id: channel,
      isEnabled: params.isEnabled,
      updatedBy: params.updatedBy,
      updatedAt: now,
    },
  });
}
