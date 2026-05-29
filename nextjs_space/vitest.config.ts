import { defineConfig } from 'vitest/config';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // Mirror tsconfig "paths": { "@/*": ["./*"] } so test imports match app imports.
    alias: {
      '@': rootDir,
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // Unit suites only. Playwright (.spec.ts) and Docker-gated integration suites are excluded.
    include: ['tests/unit/**/*.test.ts', 'lib/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      'tests/integration/**',
      'tests/e2e/**',
      '**/*.spec.ts',
    ],
    coverage: {
      provider: 'v8',
      include: ['lib/**'],
    },
  },
});
