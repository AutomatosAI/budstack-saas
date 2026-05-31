import { config } from "dotenv";
import { resolve } from "node:path";

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
