import { AsyncLocalStorage } from "async_hooks";

type TenantContext = {
  tenantId: string | null;
};

const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

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
 * Async variant: binds `tenantId` for the whole async chain of `fn`. We `await`
 * `fn()` *inside* the bound store rather than returning it directly. Prisma query
 * promises are lazy — the query does not run until the promise is awaited — so a
 * callback such as `() => prisma.users.findFirst(...)` would otherwise have its
 * query execute only once the caller awaits the result, by which point `.run` has
 * already torn the store down and the tenant scope is silently lost. Awaiting here
 * forces any such deferred work to run while the context is still bound.
 */
export function runWithTenantContextAsync<T>(
  tenantId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  return tenantContextStorage.run({ tenantId }, async () => {
    const result = await fn();
    return result;
  });
}
