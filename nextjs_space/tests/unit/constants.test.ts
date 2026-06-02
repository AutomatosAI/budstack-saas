import { describe, it, expect } from "vitest";
import {
  ENCRYPTION_KEY_BYTES,
  ENCRYPTION_SCRYPT_PARAMS,
  ZIP_MAX_TOTAL_UNCOMPRESSED,
  ZIP_MAX_FILE_UNCOMPRESSED,
  ZIP_MAX_ENTRIES,
  ZIP_DOWNLOAD_MAX_BYTES,
  UPLOAD_MAX_FILE_SIZE,
  UPLOAD_MAX_VIDEO_SIZE,
  RATE_LIMIT_DEFAULT_MAX_REQUESTS,
  RATE_LIMIT_DEFAULT_WINDOW_MS,
} from "@/lib/constants";

const MB = 1024 * 1024;

describe("encryption policy constants", () => {
  it("pins the AES-256 key length to 32 bytes", () => {
    expect(ENCRYPTION_KEY_BYTES).toBe(32);
  });

  // Guard rail: changing any scrypt parameter re-derives a different key and
  // makes all existing v2 ciphertext undecryptable. This test makes such a
  // change fail loudly in CI rather than silently in production.
  it("pins the scrypt KDF cost (N=16384, r=8, p=1)", () => {
    expect(ENCRYPTION_SCRYPT_PARAMS).toEqual({ N: 16384, r: 8, p: 1 });
  });

  it("keeps scrypt N a power of two", () => {
    const { N } = ENCRYPTION_SCRYPT_PARAMS;
    expect(Number.isInteger(Math.log2(N))).toBe(true);
  });
});

describe("ZIP extraction caps", () => {
  it("matches the documented zip-bomb guard policy", () => {
    expect(ZIP_MAX_TOTAL_UNCOMPRESSED).toBe(500 * MB);
    expect(ZIP_MAX_FILE_UNCOMPRESSED).toBe(50 * MB);
    expect(ZIP_MAX_ENTRIES).toBe(5_000);
    expect(ZIP_DOWNLOAD_MAX_BYTES).toBe(100 * MB);
  });

  it("keeps the per-file cap below the cumulative cap", () => {
    expect(ZIP_MAX_FILE_UNCOMPRESSED).toBeLessThan(ZIP_MAX_TOTAL_UNCOMPRESSED);
  });
});

describe("upload caps", () => {
  it("matches the documented upload size policy", () => {
    expect(UPLOAD_MAX_FILE_SIZE).toBe(10 * MB);
    expect(UPLOAD_MAX_VIDEO_SIZE).toBe(100 * MB);
  });
});

describe("rate-limit defaults", () => {
  it("matches the documented fixed-window defaults", () => {
    expect(RATE_LIMIT_DEFAULT_MAX_REQUESTS).toBe(20);
    expect(RATE_LIMIT_DEFAULT_WINDOW_MS).toBe(60_000);
  });
});
