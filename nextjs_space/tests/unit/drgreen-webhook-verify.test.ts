import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import {
  verifyDrGreenWebhookSignature,
  validateWebhookTimestamp,
} from "@/lib/drgreen-webhook-verify";

// AC-10: prove webhook signatures and timestamps are validated. The signing
// secret is a throwaway test value (never a real secret).
const SECRET = "test-webhook-secret-not-a-real-secret";

function sign(payload: string, secret = SECRET): string {
  return crypto.createHash("sha256").update(payload + secret).digest("hex");
}

describe("verifyDrGreenWebhookSignature", () => {
  it("accepts a valid SHA-256(payload+secret) hex signature", () => {
    const payload = JSON.stringify({ event: "order.updated", orderId: "o1" });
    expect(verifyDrGreenWebhookSignature(payload, sign(payload), SECRET)).toBe(true);
  });

  it("accepts the same signature base64-encoded", () => {
    const payload = JSON.stringify({ event: "order.updated" });
    const base64 = Buffer.from(sign(payload), "hex").toString("base64");
    expect(verifyDrGreenWebhookSignature(payload, base64, SECRET)).toBe(true);
  });

  it("rejects a tampered payload", () => {
    const original = JSON.stringify({ event: "order.updated", amount: 10 });
    const signature = sign(original);
    const tampered = JSON.stringify({ event: "order.updated", amount: 9999 });
    expect(verifyDrGreenWebhookSignature(tampered, signature, SECRET)).toBe(false);
  });

  it("rejects an empty signature or empty secret", () => {
    const payload = "{}";
    expect(verifyDrGreenWebhookSignature(payload, "", SECRET)).toBe(false);
    expect(verifyDrGreenWebhookSignature(payload, sign(payload), "")).toBe(false);
  });
});

describe("validateWebhookTimestamp", () => {
  it("accepts a fresh timestamp", () => {
    expect(validateWebhookTimestamp(new Date().toISOString()).valid).toBe(true);
  });

  it("rejects a stale (>5 min old) timestamp", () => {
    const stale = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    const result = validateWebhookTimestamp(stale);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/expired/i);
  });

  it("rejects a far-future timestamp", () => {
    const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const result = validateWebhookTimestamp(future);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/future/i);
  });

  it("rejects a missing or unparseable timestamp", () => {
    expect(validateWebhookTimestamp("").valid).toBe(false);
    expect(validateWebhookTimestamp("not-a-date").valid).toBe(false);
  });
});
