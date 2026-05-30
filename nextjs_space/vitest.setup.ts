import { config } from "dotenv";
import { resolve } from "node:path";

// Load ONLY the throwaway test env — never the real .env (gitignored and absent
// from this worktree anyway). Tests must not read real secrets. PRD-218 units
// (CSP/nonce) need no env, but keep the loader so future units can opt in.
config({ path: resolve(process.cwd(), ".env.test") });
