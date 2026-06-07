import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "@/lib/security/encryption";

describe("vitest harness smoke", () => {
  it("round-trips a string through encrypt()/decrypt()", () => {
    const plaintext = "harness-smoke-value";
    const ciphertext = encrypt(plaintext);

    expect(ciphertext).not.toBe(plaintext);
    expect(ciphertext.startsWith("v2:")).toBe(true);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });
});
