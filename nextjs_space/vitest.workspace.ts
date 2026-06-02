import { defineWorkspace } from "vitest/config";
import { resolve } from "node:path";

const alias = { "@": resolve(__dirname, "./") };

// PRD-207 — two projects. `unit` is the fast, isolated, parallel default (mocked
// deps, no Docker). `integration` runs every tests/integration/** file in ONE
// non-isolated fork so the testcontainers Postgres singleton in
// tests/helpers/withPostgres.ts is started once and shared (isolate:false keeps
// module state — and therefore that container — alive across files; singleFork +
// fileParallelism:false serialise them so there is never more than one container).
export default defineWorkspace([
  {
    test: {
      name: "unit",
      environment: "node",
      setupFiles: ["./vitest.setup.ts"],
      include: ["tests/unit/**/*.test.ts", "lib/**/*.test.ts"],
    },
    resolve: { alias },
  },
  {
    test: {
      name: "integration",
      environment: "node",
      setupFiles: ["./vitest.setup.ts"],
      include: ["tests/integration/**/*.test.ts"],
      isolate: false,
      pool: "forks",
      poolOptions: { forks: { singleFork: true } },
      fileParallelism: false,
      testTimeout: 60_000,
      hookTimeout: 180_000,
    },
    resolve: { alias },
  },
]);
