import { describe, it, expect } from 'vitest';
import { getTenantContext } from '@/lib/tenant-context';

describe('vitest harness smoke', () => {
  it('runs and resolves the @/ alias', () => {
    expect(typeof getTenantContext).toBe('function');
  });

  it('loads NODE_ENV from .env.test', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});
