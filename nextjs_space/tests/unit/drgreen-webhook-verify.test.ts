import { afterEach, describe, expect, it } from "vitest";
import crypto from "crypto";
import {
  verifyDrGreenWebhookSignature,
  validateWebhookTimestamp,
} from "@/lib/drgreen-webhook-verify";

// Known-answer vectors computed independently (see scripts/ralph/progress.txt US-004).
const PAYLOAD = '{"event":"order.updated","timestamp":"2026-05-29T00:00:00Z"}';
const SECRET = "drgreen-shared-secret";
const HMAC_HEX =
  "1ff13c3c2becc7003c9fe27e02b14961d113a93dc45fc6ca8515be263e24e45d";
const HMAC_B64 = "H/E8PCvsxwA8n+J+ArFJYdETqT3EX8bKhRW+Jj4k5F0=";
const LEGACY_HEX =
  "b8c81548f2be8b08744c751d80de81beed9d51f82df8aa927eb5920f49abaaf9";

const LEGACY_FLAG = "DRGREEN_WEBHOOK_LEGACY_HASH_ACCEPT";

afterEach(() => {
  delete process.env[LEGACY_FLAG];
});

describe("verifyDrGreenWebhookSignature", () => {
  it("accepts a known HMAC-SHA256 hex vector", () => {
    expect(verifyDrGreenWebhookSignature(PAYLOAD, HMAC_HEX, SECRET)).toBe(true);
  });

  it("accepts the base64 encoding of the HMAC vector", () => {
    expect(verifyDrGreenWebhookSignature(PAYLOAD, HMAC_B64, SECRET)).toBe(true);
  });

  it("accepts a signature carrying the sha256= prefix", () => {
    expect(
      verifyDrGreenWebhookSignature(PAYLOAD, `sha256=${HMAC_HEX}`, SECRET),
    ).toBe(true);
  });

  it("rejects the legacy plain-hash value when the flag is off (default)", () => {
    expect(verifyDrGreenWebhookSignature(PAYLOAD, LEGACY_HEX, SECRET)).toBe(false);
  });

  it("accepts the legacy plain-hash value only when the flag is on", () => {
    process.env[LEGACY_FLAG] = "true";
    expect(verifyDrGreenWebhookSignature(PAYLOAD, LEGACY_HEX, SECRET)).toBe(true);
  });

  it("still accepts the HMAC value when the legacy flag is on", () => {
    process.env[LEGACY_FLAG] = "true";
    expect(verifyDrGreenWebhookSignature(PAYLOAD, HMAC_HEX, SECRET)).toBe(true);
  });

  it("rejects a wrong signature", () => {
    const wrong = crypto.createHmac("sha256", SECRET).update("other").digest("hex");
    expect(verifyDrGreenWebhookSignature(PAYLOAD, wrong, SECRET)).toBe(false);
  });

  it("rejects a too-short signature without throwing", () => {
    expect(verifyDrGreenWebhookSignature(PAYLOAD, "deadbeef", SECRET)).toBe(false);
  });

  it("rejects when signature or secret is missing", () => {
    expect(verifyDrGreenWebhookSignature(PAYLOAD, "", SECRET)).toBe(false);
    expect(verifyDrGreenWebhookSignature(PAYLOAD, HMAC_HEX, "")).toBe(false);
  });
});

describe("validateWebhookTimestamp", () => {
  it("accepts a current timestamp", () => {
    expect(validateWebhookTimestamp(new Date().toISOString()).valid).toBe(true);
  });

  it("rejects a timestamp older than 5 minutes", () => {
    const old = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    const result = validateWebhookTimestamp(old);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/expired/i);
  });

  it("rejects a far-future timestamp", () => {
    const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    expect(validateWebhookTimestamp(future).valid).toBe(false);
  });

  it("rejects an empty or malformed timestamp", () => {
    expect(validateWebhookTimestamp("").valid).toBe(false);
    expect(validateWebhookTimestamp("not-a-date").valid).toBe(false);
  });
});
