import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit-test harness for server-side lib/** code (PRD-207 Phase 1).
// Node environment, `@/` alias mirrors tsconfig paths. Playwright `.spec.ts`
// files are excluded so the two runners never collide.

// US-006 / PRD-207 AC-12 — coverage gate. REPORT-ONLY by default (OQ-4: the
// thresholds are *defined* in this PRD but enforced as a hard CI gate by
// PRD-216). Until the seed integration suites land, lib/** aggregate sits far
// below 80%, so enforcing locally would be a permanent false-red. PRD-216's CI
// step sets COVERAGE_ENFORCE=1 to flip the same numbers into a real gate.
const enforceCoverage = process.env.COVERAGE_ENFORCE === "1";

// 95% security-critical set (AC-12). lib/with-tenant-context.ts joins this set
// once PRD-202 creates it.
const criticalThreshold = { lines: 95, branches: 95, functions: 95, statements: 95 };

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/unit/**/*.test.ts", "lib/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/*.spec.ts",
      "tests/e2e/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/**/*.ts"],
      thresholds: enforceCoverage
        ? {
            // 80% lines/branches aggregate (AC-12).
            lines: 80,
            branches: 80,
            functions: 80,
            statements: 80,
            // 95% per-file on the security-critical modules (AC-12).
            "lib/encryption.ts": criticalThreshold,
            "lib/drgreen-webhook-verify.ts": criticalThreshold,
            "lib/api-auth.ts": criticalThreshold,
            "lib/tenant-context.ts": criticalThreshold,
          }
        : undefined,
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
