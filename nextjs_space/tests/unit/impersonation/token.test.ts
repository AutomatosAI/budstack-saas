import { describe, it, expect } from "vitest";
import {
  generateImpersonationToken,
  hashImpersonationToken,
} from "@/lib/impersonation/token";

describe("generateImpersonationToken", () => {
  it("produces 64 lowercase hex chars (256 bits)", () => {
    const token = generateImpersonationToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces unique tokens across calls", () => {
    const seen = new Set(
      Array.from({ length: 50 }, () => generateImpersonationToken()),
    );
    expect(seen.size).toBe(50);
  });
});

describe("hashImpersonationToken", () => {
  it("is deterministic SHA-256 (known vector)", () => {
    // sha256("test")
    expect(hashImpersonationToken("test")).toBe(
      "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    );
  });

  it("different tokens hash differently; same token hashes identically", () => {
    const a = generateImpersonationToken();
    const b = generateImpersonationToken();
    expect(hashImpersonationToken(a)).toBe(hashImpersonationToken(a));
    expect(hashImpersonationToken(a)).not.toBe(hashImpersonationToken(b));
  });

  it("never echoes the raw token (hash differs from input)", () => {
    const raw = generateImpersonationToken();
    expect(hashImpersonationToken(raw)).not.toBe(raw);
  });
});
