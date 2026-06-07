import { describe, it, expect } from "vitest";
import { encrypt, decrypt, isEncryptedValue, DecryptionError } from "@/lib/security/encryption";

describe("isEncryptedValue", () => {
  it("returns true for v2 ciphertext produced by encrypt()", () => {
    expect(isEncryptedValue(encrypt("secret-value"))).toBe(true);
  });

  it("returns true for a hand-built 3-part legacy hex value", () => {
    expect(isEncryptedValue("aabbccdd:11223344:deadbeef")).toBe(true);
  });

  it("returns false for plaintext", () => {
    expect(isEncryptedValue("hello")).toBe(false);
  });

  it("returns false for a v2 value with a non-hex segment", () => {
    expect(isEncryptedValue("v2:nothex:1122:3344")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isEncryptedValue("")).toBe(false);
  });

  it("returns false for a legacy-length value with a non-hex segment", () => {
    expect(isEncryptedValue("aabb:nothex:ccdd")).toBe(false);
  });

  it("returns false for a v2 prefix with the wrong part count", () => {
    expect(isEncryptedValue("v2:aabb:ccdd")).toBe(false);
  });
});

describe("decrypt (fail-closed)", () => {
  it("returns '' for empty input", () => {
    expect(decrypt("")).toBe("");
  });

  it("round-trips v2 ciphertext produced by encrypt()", () => {
    const plaintext = "drgreen-api-secret-42";
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("throws DecryptionError for a non-encrypted value when migration is NOT allowed", () => {
    expect(() => decrypt("not-encrypted-plaintext")).toThrow(DecryptionError);
  });

  it("throws DecryptionError for a tampered v2 value (auth tag mismatch)", () => {
    const valid = encrypt("tamper-me");
    // Flip the final hex digit of the ciphertext — still valid hex shape, so
    // isEncryptedValue() stays true, but GCM auth verification must fail.
    const lastChar = valid.slice(-1);
    const flipped = lastChar === "0" ? "1" : "0";
    const tampered = valid.slice(0, -1) + flipped;
    expect(() => decrypt(tampered)).toThrow(DecryptionError);
  });

  it("returns a genuinely non-encrypted value as-is under an open migration window", () => {
    const legacyPlaintext = "plain-legacy-token";
    expect(
      decrypt(legacyPlaintext, {
        allowUnencryptedMigration: true,
        migrationDeadline: "2099-12-31",
      })
    ).toBe(legacyPlaintext);
  });

  it("still throws for an encrypted-looking value that fails to decrypt, even under migration", () => {
    // v2-shaped, valid hex, but not real ciphertext — must NOT be returned as-is.
    expect(() =>
      decrypt("v2:aabb:ccdd:eeff", {
        allowUnencryptedMigration: true,
        migrationDeadline: "2099-12-31",
      })
    ).toThrow(DecryptionError);
  });
});
