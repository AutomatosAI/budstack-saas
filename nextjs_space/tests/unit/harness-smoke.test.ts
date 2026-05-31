import { describe, expect, it } from "vitest";

// Proves the Vitest runner + ts resolution + @/ alias are wired before any
// PRD-218 security units are added.
describe("vitest harness smoke", () => {
  it("runs a trivial assertion", () => {
    expect(1 + 1).toBe(2);
  });
});
