import { vi } from "vitest";
import { config } from "dotenv";
import { resolve } from "node:path";

// React 18.2's stable build doesn't export `cache` — Next.js injects it at
// runtime. Modules like lib/tenant/tenant.ts call `cache(...)` at top-level, so
// under bare vitest the import is `undefined` and evaluation throws. Shim it as
// an identity passthrough (memoization is a per-request optimization the tests
// don't depend on). Global here so every route-importing suite gets it for free.
vi.mock("react", async (importActual) => {
  const actual = await importActual<typeof import("react")>();
  return { ...actual, cache: actual.cache ?? (<T>(fn: T) => fn) };
});

// Load ONLY the throwaway test env — never the real .env (which is gitignored and
// absent from this worktree anyway). Tests must not read real secrets.
config({ path: resolve(process.cwd(), ".env.test") });

// Deterministic fallback so the suite is self-contained even when .env.test is
// missing (the repo gitignores all .env* files). NOT a real secret: getKey() runs
// scryptSync over the value, so any string yields a valid in-process key.
// (Vitest already sets NODE_ENV='test', so it needs no fallback here.)
if (!process.env.ENCRYPTION_KEY) {
  process.env.ENCRYPTION_KEY = "budstack-test-encryption-key-not-a-secret";
}
