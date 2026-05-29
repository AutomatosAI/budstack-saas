import { describe, it, expect } from "vitest";
import { encrypt, isEncryptedValue } from "@/lib/encryption";

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
