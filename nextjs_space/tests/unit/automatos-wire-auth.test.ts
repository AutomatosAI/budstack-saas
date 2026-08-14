import crypto from "crypto";
import { describe, expect, it } from "vitest";

import { FEATURES } from "@/lib/entitlements/features";
import {
  verifyWireSignature,
  wireDraftRejection,
} from "@/lib/integrations/automatos-wire";

const SECRET = "test-secret-value";
const BODY = JSON.stringify({ title: "Hello", content: "<p>hi</p>" });
const sign = (body: string, secret: string) =>
  "sha256=" + crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");

describe("verifyWireSignature (US-011)", () => {
  it("accepts a correct sha256= signature", () => {
    expect(verifyWireSignature(BODY, sign(BODY, SECRET), SECRET)).toBe(true);
  });

  it("accepts the bare-hex form", () => {
    const bare = sign(BODY, SECRET).slice("sha256=".length);
    expect(verifyWireSignature(BODY, bare, SECRET)).toBe(true);
  });

  it("rejects a signature made with the wrong secret", () => {
    expect(verifyWireSignature(BODY, sign(BODY, "other"), SECRET)).toBe(false);
  });

  it("rejects when the body was tampered with", () => {
    expect(verifyWireSignature(BODY + " ", sign(BODY, SECRET), SECRET)).toBe(false);
  });

  it("rejects malformed headers without throwing", () => {
    for (const bad of [null, "", "sha256=", "sha256=zzzz", "sha256=abcd", "🌿"]) {
      expect(verifyWireSignature(BODY, bad as string | null, SECRET)).toBe(false);
    }
  });

  it("rejects everything when the tenant has no secret", () => {
    expect(verifyWireSignature(BODY, sign(BODY, SECRET), "")).toBe(false);
  });
});

describe("wireDraftRejection (US-011/US-013)", () => {
  const ENTITLED = [FEATURES.AUTOMATOS_WIRE as string];

  it("rejects without the entitlement even in ASSISTED mode", () => {
    expect(wireDraftRejection("ASSISTED", [])).toBe("NOT_ENTITLED");
  });

  it("rejects MANUAL mode even when entitled", () => {
    expect(wireDraftRejection("MANUAL", ENTITLED)).toBe("MODE_NOT_ASSISTED");
    expect(wireDraftRejection(null, ENTITLED)).toBe("MODE_NOT_ASSISTED");
  });

  it("passes only for entitled + ASSISTED", () => {
    expect(wireDraftRejection("ASSISTED", ENTITLED)).toBeNull();
  });
});
