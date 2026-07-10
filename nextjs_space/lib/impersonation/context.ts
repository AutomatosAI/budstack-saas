import { AsyncLocalStorage } from "async_hooks";

/**
 * PRD-302 AC-5: ambient impersonation context for audit stamping.
 *
 * Mirrors lib/tenant/tenant-context.ts. The API auth wrappers bind this for the
 * duration of a request handled by an impersonating super-admin; createAuditLog
 * reads it to stamp `impersonationSessionId` on every audit row written inside
 * the session — no per-route changes required.
 */

export interface ImpersonationAuditContext {
  sessionId: string;
  superAdminClerkId: string;
  superAdminEmail: string;
}

const impersonationStorage = new AsyncLocalStorage<ImpersonationAuditContext>();

/** The active impersonation audit context, or null outside one. */
export function getImpersonationContext(): ImpersonationAuditContext | null {
  return impersonationStorage.getStore() ?? null;
}

/**
 * Bind `ctx` for the whole async chain of `fn`. A null ctx is a no-op passthrough
 * so callers can bind unconditionally. `fn()` is awaited INSIDE the bound store —
 * same lazy-promise rationale as runWithTenantContextAsync.
 */
export function runWithImpersonationContextAsync<T>(
  ctx: ImpersonationAuditContext | null,
  fn: () => Promise<T>,
): Promise<T> {
  if (!ctx) return fn();
  return impersonationStorage.run(ctx, async () => {
    const result = await fn();
    return result;
  });
}
