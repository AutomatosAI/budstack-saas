import { describe, it, expect } from "vitest";
import { encrypt, decrypt, DecryptionError } from "@/lib/encryption";

// AC-9: prove lib/encryption round-trips and fails closed. This suite guards the
// PRD-211 versioned-key fallback contract.
describe("lib/encryption", () => {
  it("round-trips: decrypt(encrypt(x)) === x", () => {
    const plain = "Dr Green signing key ABC-123 with unicode 🌿";
    const ciphertext = encrypt(plain);
    expect(ciphertext).not.toBe(plain);
    expect(decrypt(ciphertext)).toBe(plain);
  });

  it("emits the v2 format (v2:iv:authTag:ciphertext) and decrypts it", () => {
    const ciphertext = encrypt("hello world");
    const parts = ciphertext.split(":");
    expect(parts[0]).toBe("v2");
    expect(parts).toHaveLength(4);
    expect(decrypt(ciphertext)).toBe("hello world");
  });

  it("throws DecryptionError (never returns garbage) when the authTag is tampered", () => {
    const [v, iv, authTag, data] = encrypt("sensitive").split(":");
    const badTag = authTag.replace(/^./, (c) => (c === "0" ? "1" : "0"));
    const tampered = [v, iv, badTag, data].join(":");
    expect(() => decrypt(tampered)).toThrow(DecryptionError);
  });

  it("fails closed: a plain unencrypted value is NOT silently passed through", () => {
    expect(() => decrypt("this-is-not-encrypted-plaintext")).toThrow(DecryptionError);
  });

  it("treats empty string as empty without throwing", () => {
    expect(encrypt("")).toBe("");
    expect(decrypt("")).toBe("");
  });
});
