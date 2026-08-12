import { ApiError } from '@/lib/api-error';

/**
 * PRD-206 — strict tenant-scope guard for S3 keys.
 *
 * The bug this closes is a bypassable substring `.includes('tenants/{id}/')`
 * check (route handlers + a preview passthrough). This guard instead does a
 * STRICT path-SEGMENT prefix match against `tenants/{tenantId}/`, after a
 * conservative normalisation that rejects traversal/encoding tricks.
 *
 * Pure by design: it does NOT read getBucketConfig(); callers pass the
 * optional `folderPrefix` (e.g. "development/") so the guard stays testable.
 */

export interface TenantScopeOptions {
  /** Bucket folder prefix from getBucketConfig() (e.g. "development/"). */
  folderPrefix?: string;
}

const DENIED_MESSAGE = 'Cross-tenant S3 access denied';

/** Decode percent-escapes exactly once; null if the input is malformed. */
function decodeOnce(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/**
 * Normalise a raw S3 key for prefix comparison, or return null if the key
 * is structurally unsafe (malformed encoding, traversal, or backslash).
 *
 * Exported so callers that must derive a key from untrusted input (the public
 * image route, US-005) clean it with exactly the same rules this guard checks
 * against, instead of hand-rolling a second normaliser that could drift.
 */
export function normaliseTenantScopedKey(key: string, folderPrefix?: string): string | null {
  const decoded = decodeOnce(key);
  if (decoded === null) return null;
  // Reject traversal and Windows-separator tricks outright (post-decode so
  // `..%2F` style escapes are caught too).
  if (decoded.includes('..') || decoded.includes('\\')) return null;

  let normalised = decoded.replace(/\/{2,}/g, '/');
  if (normalised.startsWith('/')) normalised = normalised.slice(1);
  if (folderPrefix && normalised.startsWith(folderPrefix)) {
    normalised = normalised.slice(folderPrefix.length);
  }
  return normalised;
}

/**
 * Non-throwing scope check. True only when `key` resolves to a path whose
 * first segments are exactly `tenants/${tenantId}/` (segment boundary
 * enforced by the trailing slash — never a substring match).
 */
export function isKeyInTenantScope(
  key: string,
  tenantId: string,
  opts?: TenantScopeOptions,
): boolean {
  if (!key) return false;
  if (!tenantId || tenantId.trim() === '') return false;

  const normalised = normaliseTenantScopedKey(key, opts?.folderPrefix);
  if (normalised === null) return false;

  return normalised.startsWith(`tenants/${tenantId}/`);
}

/**
 * Throwing scope assertion. Throws ApiError(403) unless `key` is within the
 * caller's `tenants/${tenantId}/` prefix (or tenantId is empty).
 */
export function assertKeyInTenantScope(
  key: string,
  tenantId: string,
  opts?: TenantScopeOptions,
): void {
  if (!isKeyInTenantScope(key, tenantId, opts)) {
    throw new ApiError(DENIED_MESSAGE, 403);
  }
}
