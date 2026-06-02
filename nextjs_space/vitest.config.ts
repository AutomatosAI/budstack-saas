import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Test discovery + per-project pool settings live in vitest.workspace.ts (the
// `unit` and `integration` projects). This root config carries only the
// run-global coverage settings, which a workspace cannot override per-project.
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["lib/**"],
      thresholds: {
        // PRD-207 — the four security-critical primitives carry a hard 95% gate
        // (auth wrapper, at-rest encryption, the tenant-context ALS, and the
        // Dr.Green webhook HMAC verifier). The repo-wide lib/** floor is set
        // from the first CI coverage report rather than guessed here, so the
        // gate ratchets up instead of going red on arrival.
        "lib/api-auth.ts": { lines: 95, functions: 95, statements: 95, branches: 95 },
        "lib/security/encryption.ts": { lines: 95, functions: 95, statements: 95, branches: 95 },
        "lib/tenant/tenant-context.ts": { lines: 95, functions: 95, statements: 95, branches: 95 },
        "lib/drgreen/drgreen-webhook-verify.ts": { lines: 95, functions: 95, statements: 95, branches: 95 },
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
    },
  },
});
