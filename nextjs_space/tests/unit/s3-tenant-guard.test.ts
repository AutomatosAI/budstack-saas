import { describe, it, expect } from 'vitest';
import { ApiError } from '@/lib/api-error';
import {
  assertKeyInTenantScope,
  isKeyInTenantScope,
} from '@/lib/storage/s3-tenant-guard';

// Placeholder ids: ME = caller, VICTIM = a different tenant. No real/template
// values — the guard keys off the tenantId + prefix convention only.
const ME = 'tenantA';
const VICTIM = 'tenantB';

function expectDenied(
  key: string,
  tenantId: string,
  opts?: { folderPrefix?: string },
): void {
  expect(isKeyInTenantScope(key, tenantId, opts)).toBe(false);

  let thrown: unknown;
  try {
    assertKeyInTenantScope(key, tenantId, opts);
  } catch (err) {
    thrown = err;
  }
  expect(thrown).toBeInstanceOf(ApiError);
  expect((thrown as ApiError).status).toBe(403);
}

function expectAllowed(
  key: string,
  tenantId: string,
  opts?: { folderPrefix?: string },
): void {
  expect(isKeyInTenantScope(key, tenantId, opts)).toBe(true);
  expect(() => assertKeyInTenantScope(key, tenantId, opts)).not.toThrow();
}

describe('s3-tenant-guard — in-scope keys are allowed', () => {
  it('accepts a key directly under the caller tenant prefix', () => {
    expectAllowed(`tenants/${ME}/templates/x/logo.png`, ME);
  });

  it('accepts a folderPrefix-prefixed key for the caller tenant', () => {
    expectAllowed(`development/tenants/${ME}/uploads/1-a.png`, ME, {
      folderPrefix: 'development/',
    });
  });

  it('accepts a key missing the folderPrefix even when one is configured', () => {
    expectAllowed(`tenants/${ME}/uploads/1-a.png`, ME, {
      folderPrefix: 'development/',
    });
  });
});

describe('s3-tenant-guard — AC-1a bypass strings are all rejected', () => {
  const bypassKeys: Array<[string, string]> = [
    ['nested victim/me path (substring, not a true prefix)', `tenants/${VICTIM}/x/tenants/${ME}/y`],
    ['prefix-extension sibling tenant', `tenants/${ME}-evil/file`],
    ['parent-traversal escape', `tenants/${ME}/../${VICTIM}/secret`],
    ['url-encoded traversal escape', `tenants/${ME}/..%2F${VICTIM}/secret`],
    ['leading-slash victim path', `/tenants/${VICTIM}/secret.png`],
    ['double-slash victim path', `tenants//${VICTIM}/secret.png`],
    ['another tenant outright', `tenants/${VICTIM}/logo.png`],
  ];

  it.each(bypassKeys)('rejects %s', (_label, key) => {
    expectDenied(key, ME);
  });
});

describe('s3-tenant-guard — malformed encoding fails closed', () => {
  it('rejects a key whose percent-encoding cannot be decoded', () => {
    expectDenied(`tenants/${ME}/bad%zz.png`, ME);
  });

  it('rejects a key containing a backslash separator', () => {
    expectDenied(`tenants\\${ME}\\secret.png`, ME);
  });
});

describe('s3-tenant-guard — invalid tenantId is rejected', () => {
  it('rejects an empty tenantId', () => {
    expectDenied(`tenants//logo.png`, '');
  });

  it('rejects a whitespace-only tenantId', () => {
    expectDenied(`tenants/${ME}/logo.png`, '   ');
  });
});
