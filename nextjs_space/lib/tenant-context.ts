import { AsyncLocalStorage } from "async_hooks";

type TenantContext = {
  tenantId: string | null;
};

const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

/**
 * @deprecated Use runWithTenantContext instead to avoid cross-tenant data leaks.
 * enterWith() replaces context for the entire async scope, which is unsafe
 * under concurrent requests sharing a microtask queue.
 */
export function setTenantContext(tenantId: string | null) {
  // Wrap in run() to scope the context to the current async chain
  // instead of using enterWith() which leaks across concurrent requests.
  tenantContextStorage.enterWith({ tenantId });
}

export function getTenantContext() {
  return tenantContextStorage.getStore()?.tenantId ?? null;
}

/**
 * True when a context has been explicitly bound (via runWithTenantContext /
 * runWithTenantContextAsync), even if it was bound to `null` for a legitimate
 * system/super-admin/webhook/cron query. This is how the Prisma middleware
 * distinguishes an *explicit* null (allowed) from an *implicit* unbound context
 * (the cross-tenant-leak bug — fail loud). `getTenantContext() === null` alone
 * cannot make that distinction.
 */
export function hasTenantContext(): boolean {
  return tenantContextStorage.getStore() !== undefined;
}

/**
 * Bind `tenantId` for the duration of the synchronous callback. The store is
 * torn down when the callback settles — the safe replacement for enterWith().
 */
export function runWithTenantContext<T>(tenantId: string | null, fn: () => T): T {
  return tenantContextStorage.run({ tenantId }, fn);
}

/**
 * Async variant: binds `tenantId` for the whole async chain of `fn`. ALS `.run`
 * returns the callback's value, so the bound context propagates across every
 * `await` inside `fn` and is restored for the caller once the promise settles.
 */
export function runWithTenantContextAsync<T>(
  tenantId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  return tenantContextStorage.run({ tenantId }, fn);
}
