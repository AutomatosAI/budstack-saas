import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PRD-215 AC-1 / AC-1a — logger level gating + redaction at the log boundary.
 *
 * The logger writes JSON to stdout via pino. We capture `process.stdout.write`
 * to assert on the emitted lines. The module reads NODE_ENV / LOG_LEVEL at
 * import time, so each scenario sets env then dynamically (re-)imports the
 * module in isolation via `vi.resetModules()`.
 */

const captured: string[] = [];
const originalWrite = process.stdout.write.bind(process.stdout);

beforeEach(() => {
  captured.length = 0;
  // pino writes JSON lines to stdout; capture them. Typed loosely because
  // process.stdout.write is overloaded and vi.spyOn can't model both shapes.
  process.stdout.write = ((chunk: unknown): boolean => {
    captured.push(
      typeof chunk === "string" ? chunk : Buffer.from(chunk as Uint8Array).toString(),
    );
    return true;
  }) as typeof process.stdout.write;
});

afterEach(() => {
  process.stdout.write = originalWrite;
  vi.resetModules();
  vi.unstubAllEnvs();
});

async function loadLogger() {
  vi.resetModules();
  return import("@/lib/logger");
}

describe("logger level gating", () => {
  it("emits info but suppresses debug at info level (production-like)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOG_LEVEL", "info");
    const { logger } = await loadLogger();

    logger.debug("debug-line");
    logger.info("info-line");

    const joined = captured.join("");
    expect(joined).not.toContain("debug-line");
    expect(joined).toContain("info-line");
  });

  it("emits debug when LOG_LEVEL=debug", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOG_LEVEL", "debug");
    const { logger } = await loadLogger();

    logger.debug("verbose-line");
    expect(captured.join("")).toContain("verbose-line");
  });

  it("exposes the resolved level", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOG_LEVEL", "warn");
    const { logger } = await loadLogger();
    expect(logger.level).toBe("warn");
  });
});

describe("logger redaction at the boundary (AC-1a)", () => {
  it("strips email/name/phone from a structured context object", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("LOG_LEVEL", "info");
    const { logger } = await loadLogger();

    logger.info("user event", {
      email: "patient@example.com",
      firstName: "Ada",
      phone: "+15551234567",
      tenantId: "t-1",
    });

    const joined = captured.join("");
    expect(joined).not.toContain("patient@example.com");
    expect(joined).not.toContain("Ada");
    expect(joined).not.toContain("5551234567");
    expect(joined).toContain("t-1"); // non-PII survives
  });

  it("never dumps a raw Dr Green response", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("LOG_LEVEL", "info");
    const { logger } = await loadLogger();

    logger.error("dr green failure", {
      drGreenResponse: { data: { client: { email: "leak@example.com", kycLink: "https://k/secret" } } },
    });

    const joined = captured.join("");
    expect(joined).not.toContain("leak@example.com");
    expect(joined).not.toContain("https://k/secret");
  });
});

describe("child logger carries correlation id (AC-1)", () => {
  it("stamps the correlationId on every line", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("LOG_LEVEL", "info");
    const { requestLogger } = await loadLogger();

    const child = requestLogger("corr-xyz");
    child.info("scoped line");

    const joined = captured.join("");
    expect(joined).toContain("corr-xyz");
    expect(joined).toContain("scoped line");
  });
});
