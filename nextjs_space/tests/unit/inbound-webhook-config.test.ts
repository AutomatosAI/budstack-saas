import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Inbound partner-webhook config resolution.
 *
 * The property that matters most here is FAIL-SOFT: inbound signature
 * verification is a live path shared by every tenant, so an admin-console
 * feature that is half-deployed (table not yet created by the hand-run
 * migration), or a stored value that cannot be decrypted, must fall back to
 * the environment variable rather than throwing — otherwise shipping the
 * console would start rejecting Dr Green.
 */

const prismaMock = vi.hoisted(() => ({
  platform_webhook_config: { findUnique: vi.fn() },
}));
const cryptoMock = vi.hoisted(() => ({ decrypt: vi.fn(), encrypt: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/security/encryption", () => ({
  decrypt: cryptoMock.decrypt,
  encrypt: cryptoMock.encrypt,
}));

import {
  resolveInboundVerification,
  getInboundWebhookStatus,
} from "@/lib/drgreen/inbound-webhook-config";

const ORIGINAL_ENV = process.env.DRGREEN_WEBHOOK_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.DRGREEN_WEBHOOK_SECRET;
});

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.DRGREEN_WEBHOOK_SECRET;
  else process.env.DRGREEN_WEBHOOK_SECRET = ORIGINAL_ENV;
});

describe("resolveInboundVerification", () => {
  it("prefers the stored secret, decrypted", async () => {
    prismaMock.platform_webhook_config.findUnique.mockResolvedValue({
      secret: "enc:abc",
      isEnabled: true,
      updatedAt: new Date(),
      updatedBy: "ops@budstacks.io",
    });
    cryptoMock.decrypt.mockReturnValue("plaintext-secret");

    await expect(resolveInboundVerification()).resolves.toEqual({
      enabled: true,
      secret: "plaintext-secret",
    });
  });

  it("falls back to env when the table is missing (migration not applied)", async () => {
    process.env.DRGREEN_WEBHOOK_SECRET = "env-secret";
    prismaMock.platform_webhook_config.findUnique.mockRejectedValue(
      new Error('relation "platform_webhook_config" does not exist'),
    );

    await expect(resolveInboundVerification()).resolves.toEqual({
      enabled: true,
      secret: "env-secret",
    });
  });

  it("falls back to env when the stored secret cannot be decrypted", async () => {
    process.env.DRGREEN_WEBHOOK_SECRET = "env-secret";
    prismaMock.platform_webhook_config.findUnique.mockResolvedValue({
      secret: "corrupt",
      isEnabled: true,
      updatedAt: new Date(),
      updatedBy: null,
    });
    cryptoMock.decrypt.mockImplementation(() => {
      throw new Error("bad key");
    });

    await expect(resolveInboundVerification()).resolves.toEqual({
      enabled: true,
      secret: "env-secret",
    });
  });

  it("reports disabled distinctly from unconfigured", async () => {
    process.env.DRGREEN_WEBHOOK_SECRET = "env-secret";
    prismaMock.platform_webhook_config.findUnique.mockResolvedValue({
      secret: "enc:abc",
      isEnabled: false,
      updatedAt: new Date(),
      updatedBy: null,
    });

    // enabled:false must NOT be confused with "no secret" — the receiver
    // rejects on the former and falls through to per-tenant on the latter.
    await expect(resolveInboundVerification()).resolves.toEqual({
      enabled: false,
      secret: null,
    });
  });

  it("returns no secret when neither source has one", async () => {
    prismaMock.platform_webhook_config.findUnique.mockResolvedValue(null);
    await expect(resolveInboundVerification()).resolves.toEqual({
      enabled: true,
      secret: null,
    });
  });
});

describe("getInboundWebhookStatus", () => {
  it("flags an unprovisioned table without throwing", async () => {
    process.env.DRGREEN_WEBHOOK_SECRET = "env-secret";
    prismaMock.platform_webhook_config.findUnique.mockRejectedValue(new Error("no table"));

    const status = await getInboundWebhookStatus();

    expect(status.tableProvisioned).toBe(false);
    expect(status.configured).toBe(true);
    expect(status.source).toBe("environment");
  });

  it("reports the database as the source when a secret is stored", async () => {
    process.env.DRGREEN_WEBHOOK_SECRET = "env-secret";
    prismaMock.platform_webhook_config.findUnique.mockResolvedValue({
      secret: "enc:abc",
      isEnabled: true,
      updatedAt: new Date("2026-08-25T10:00:00Z"),
      updatedBy: "ops@budstacks.io",
    });

    const status = await getInboundWebhookStatus();

    expect(status).toMatchObject({
      configured: true,
      source: "database",
      isEnabled: true,
      tableProvisioned: true,
      updatedBy: "ops@budstacks.io",
    });
  });

  it("never returns the secret itself", async () => {
    prismaMock.platform_webhook_config.findUnique.mockResolvedValue({
      secret: "enc:super-sensitive",
      isEnabled: true,
      updatedAt: new Date(),
      updatedBy: null,
    });

    const status = await getInboundWebhookStatus();
    expect(JSON.stringify(status)).not.toContain("super-sensitive");
  });
});
