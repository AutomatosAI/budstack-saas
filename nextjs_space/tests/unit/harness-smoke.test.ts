import { describe, it, expect } from 'vitest';
import { ApiError } from '@/lib/api-error';

describe('vitest harness smoke', () => {
  it('runs and resolves the @/ alias', () => {
    expect(typeof ApiError).toBe('function');
  });
});
