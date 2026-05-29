import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "@/lib/encryption";

// Smoke test for the PRD-207 unit harness: proves the `@/` alias resolves and
// the deterministic test ENCRYPTION_KEY (never a real secret) is loaded.
describe("vitest unit harness", () => {
  it("loads the deterministic throwaway test ENCRYPTION_KEY from the test env", () => {
    expect(process.env.ENCRYPTION_KEY).toBe(
      "budstack-unit-test-key-not-a-real-secret-0123456789",
    );
  });

  it("resolves the @/ alias to nextjs_space modules", () => {
    expect(typeof encrypt).toBe("function");
    expect(typeof decrypt).toBe("function");
  });
});
