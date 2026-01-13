import { AsyncLocalStorage } from "async_hooks";

type TenantContext = {
  tenantId: string | null;
};

const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

export function setTenantContext(tenantId: string | null) {
  tenantContextStorage.enterWith({ tenantId });
}

export function getTenantContext() {
  return tenantContextStorage.getStore()?.tenantId ?? null;
}

export function runWithTenantContext<T>(tenantId: string | null, fn: () => T): T {
  return tenantContextStorage.run({ tenantId }, fn);
}
