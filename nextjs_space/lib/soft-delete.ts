/**
 * PRD-208 — Soft-delete substrate for the Prisma `$use` middleware.
 *
 * This module is PURE + DB-free so the query-rewrite logic is unit-testable
 * without a Postgres container (the live-table behaviour is covered by the
 * Docker integration test, which is RALPH_BLOCKED on PRD-207).
 *
 * Behaviour (AC-2):
 *   - Soft-deletable models get `deletedAt: null` injected into default `find*`
 *     / `count` / `aggregate` / `groupBy` so deleted rows are invisible.
 *   - `delete` / `deleteMany` are REWRITTEN to `update` / `updateMany` that set
 *     `deletedAt = now()` instead of issuing a hard `DELETE`.
 *   - Two escape hatches (AC-2/2a):
 *       • `withDeleted(fn)`  — read INCLUDING soft-deleted rows (admin views).
 *       • `hardDelete(fn)`   — issue a real `DELETE` (GDPR erasure, PRD-213).
 *
 * The escape hatches use AsyncLocalStorage (same pattern as tenant-context) so a
 * call deep inside `fn` opts out without threading a flag through every layer.
 *
 * IMMUTABILITY: every rewrite returns a NEW params object — the input is never
 * mutated (global coding-style rule).
 */

import { AsyncLocalStorage } from "async_hooks";

/**
 * Models that carry a `deletedAt DateTime?` column (PRD-208 AC-1). Deletion of
 * these is recoverable. Leaf/log tables (`email_logs`, `drgreen_webhook_logs`,
 * `webhook_deliveries`, `audit_logs`, …) are intentionally EXCLUDED — they hard
 * delete (documented in PRD-208 §13).
 */
export const softDeletableModels = new Set<string>([
  "tenants",
  "tenant_templates",
  "products",
  "templates",
  "marketplace_submissions",
]);

/** Read actions whose `where` should be filtered to non-deleted rows. */
const softDeleteReadActions = new Set<string>([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);

type SoftDeleteFlags = {
  /** Include soft-deleted rows in reads (skip the `deletedAt: null` filter). */
  withDeleted: boolean;
  /** Perform a real hard `DELETE` instead of the soft-delete rewrite. */
  hardDelete: boolean;
};

const softDeleteFlagStorage = new AsyncLocalStorage<SoftDeleteFlags>();

/** Current escape-hatch flags (defaults: both off → standard soft-delete). */
export function getSoftDeleteFlags(): SoftDeleteFlags {
  return (
    softDeleteFlagStorage.getStore() ?? { withDeleted: false, hardDelete: false }
  );
}

function runWithFlags<T>(flags: SoftDeleteFlags, fn: () => Promise<T>): Promise<T> {
  // Merge over any already-active flags so nesting (e.g. withDeleted inside
  // hardDelete) is additive rather than clobbering.
  const current = getSoftDeleteFlags();
  return softDeleteFlagStorage.run({ ...current, ...flags }, fn);
}

/**
 * Run `fn` with soft-deleted rows VISIBLE to default reads (AC-2 escape hatch).
 * Use for admin/super-admin views that need to see or restore deleted records.
 */
export function withDeleted<T>(fn: () => Promise<T>): Promise<T> {
  return runWithFlags({ ...getSoftDeleteFlags(), withDeleted: true }, fn);
}

/**
 * Run `fn` so `delete` / `deleteMany` issue a REAL hard `DELETE` (AC-2a).
 * This is the sanctioned GDPR-erasure path (PRD-213) — soft-delete is the
 * default; true erasure is explicit and must be audited by the caller.
 */
export function hardDelete<T>(fn: () => Promise<T>): Promise<T> {
  return runWithFlags({ ...getSoftDeleteFlags(), hardDelete: true }, fn);
}

/** True if `model` carries a `deletedAt` column. */
export function isSoftDeletable(model: string | undefined): boolean {
  return !!model && softDeletableModels.has(model);
}

/**
 * Inject `deletedAt: null` into a `where` so soft-deleted rows are hidden.
 * Returns a NEW where object. If the caller already constrained `deletedAt`
 * explicitly, their constraint wins (so `withDeleted` / explicit queries work).
 */
export function injectNotDeleted(
  where: Record<string, any> | undefined,
): Record<string, any> {
  if (where && Object.prototype.hasOwnProperty.call(where, "deletedAt")) {
    return { ...where };
  }
  return { ...(where ?? {}), deletedAt: null };
}

/** Shape this module produces/consumes — a subset of Prisma's middleware params. */
export interface MiddlewareParams {
  model?: string;
  action: string;
  args?: Record<string, any>;
}

/**
 * Apply soft-delete semantics to a single Prisma middleware `params`.
 *
 * Pure: returns a NEW params object (input untouched). Non-soft-deletable models
 * and unaffected actions are returned structurally unchanged.
 *
 * @param params Prisma middleware params (post tenant-scope rewrite).
 * @param flags  Escape-hatch flags (defaults to "no bypass").
 * @param now    Clock injection for deterministic tests (defaults to real now).
 */
export function applySoftDelete(
  params: MiddlewareParams,
  flags: SoftDeleteFlags = { withDeleted: false, hardDelete: false },
  now: () => Date = () => new Date(),
): MiddlewareParams {
  if (!isSoftDeletable(params.model)) {
    return params;
  }

  // delete / deleteMany → rewrite to update / updateMany set deletedAt = now()
  // (unless an explicit hardDelete() escape hatch is active).
  if (!flags.hardDelete && (params.action === "delete" || params.action === "deleteMany")) {
    const isMany = params.action === "deleteMany";
    const existingData =
      params.args && typeof params.args.data === "object" ? params.args.data : {};
    return {
      ...params,
      action: isMany ? "updateMany" : "update",
      args: {
        ...(params.args ?? {}),
        data: { ...existingData, deletedAt: now() },
      },
    };
  }

  // Default reads → hide soft-deleted rows (unless withDeleted() is active).
  if (!flags.withDeleted && softDeleteReadActions.has(params.action)) {
    return {
      ...params,
      args: {
        ...(params.args ?? {}),
        where: injectNotDeleted(params.args?.where),
      },
    };
  }

  return params;
}
