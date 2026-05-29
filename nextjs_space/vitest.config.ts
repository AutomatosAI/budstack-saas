import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit-test harness for server-side lib/** code (PRD-207 Phase 1).
// Node environment, `@/` alias mirrors tsconfig paths. Playwright `.spec.ts`
// files are excluded so the two runners never collide.
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
      // Thresholds (report-only) are configured in US-006 / PRD-207 AC-12.
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
