import { runWithTenantContext } from "@/lib/tenant/tenant-context";

/**
 * PRD-202 AC-6 / AC-6a — fail-loud policy for the Prisma tenant-scope middleware.
 *
 * A tenant-scoped query that runs with NO bound tenant context is the
 * cross-tenant-leak bug this PRD fixes: under the old `enterWith` binding a
 * concurrent request could observe an unbound (or another tenant's) context and
 * the middleware would silently read/write the wrong tenant's rows. The hardened
 * middleware now refuses to run a tenant-scoped query against an *implicit*
 * unbound context.
 *
 * The distinction that makes this safe is `bound` (from
 * `hasTenantContext()` — store presence), NOT `tenantId === null`:
 *   - bound === true  → a context was deliberately set (possibly to null, e.g. a
 *                       system/super-admin/webhook/cron query) → ALLOW unscoped.
 *   - bound === false → nobody bound a context → the leak vector → THROW (strict)
 *                       or WARN (migration window) per the env flag.
 */

/** Thrown when a tenant-scoped model is queried with no bound tenant context. */
export class TenantContextMissingError extends Error {
  readonly model: string;
  readonly action: string;

  constructor(model: string, action: string) {
    super(
      `Tenant context missing for tenant-scoped model "${model}" (action "${action}"). ` +
        `A tenant-scoped query ran without a bound tenant context, which risks ` +
        `reading or writing another tenant's data. Wrap the request boundary in ` +
        `withTenantContext()/runWithTenantContext(), or bind an explicit null via ` +
        `bypassTenantScope() for a deliberate system query.`,
    );
    this.name = "TenantContextMissingError";
    this.model = model;
    this.action = action;
  }
}

/**
 * Models that are permitted to run unscoped even with no bound context (OQ-2).
 * Default-deny: empty. A model is added here only with an explicit, reviewed
 * justification — never to silence the warning for a route that simply has not
 * been wrapped yet (those keep working via the warn-not-throw default).
 */
export const contextFreeAllowList = new Set<string>([]);

/**
 * Strict mode makes a missing context a hard error. Default OFF (per OQ-3) so
 * not-yet-wrapped routes keep working through the PRD-203 migration window; the
 * deploy flips this ON once the migration completes. Read from an injectable env
 * map so it is unit-testable without mutating `process.env`.
 */
export function isStrictTenantContext(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.TENANT_CONTEXT_STRICT === "true";
}

export type MissingContextDecision = "allow" | "warn" | "throw";

/**
 * Decide what to do when a tenant-scoped model is queried with `tenantId` null.
 * Pure — no I/O, no env reads — so the whole matrix is unit-testable.
 */
export function decideMissingContext(input: {
  model: string;
  bound: boolean;
  strict: boolean;
  allowList?: Set<string>;
}): MissingContextDecision {
  const { model, bound, strict, allowList = contextFreeAllowList } = input;
  // A deliberately bound context (even bound to null) is an allowed system query.
  if (bound) return "allow";
  // Explicitly allow-listed context-free model.
  if (allowList.has(model)) return "allow";
  // Implicit unbound context on a tenant-scoped model — the leak vector.
  return strict ? "throw" : "warn";
}

/**
 * Structured audit signal for an implicit-unbound tenant-scoped query.
 * `console.warn` (not `console.log`) is the sanctioned channel for this
 * `security.tenant_context_missing` event.
 */
export function emitTenantContextMissing(model: string, action: string): void {
  console.warn(
    "security.tenant_context_missing",
    JSON.stringify({
      event: "security.tenant_context_missing",
      model,
      action,
    }),
  );
}

/**
 * Run a deliberate, non-tenant-scoped query (system/super-admin/webhook/cron)
 * under an EXPLICIT null context. `hasTenantContext()` is true inside `fn`, so
 * the middleware treats it as an allowed system query rather than the
 * implicit-unbound failure. Works for sync and async `fn` (ALS `.run` returns
 * and propagates across the whole chain).
 */
export function bypassTenantScope<T>(fn: () => T): T {
  return runWithTenantContext(null, fn);
}
