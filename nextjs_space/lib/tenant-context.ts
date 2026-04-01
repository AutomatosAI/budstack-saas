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

export function runWithTenantContext<T>(tenantId: string | null, fn: () => T): T {
  return tenantContextStorage.run({ tenantId }, fn);
}
