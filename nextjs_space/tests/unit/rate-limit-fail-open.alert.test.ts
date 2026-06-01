import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PRD-215 AC-7 — when Redis is unavailable the limiter fails open AND pages
 * on-call via the alert channel (not just a console line). We mock both ioredis
 * (to force the failure) and `@/lib/alert` (to assert the page fires with the
 * `ops.rate_limit_fail_open` event and a HASHED identifier — no raw IP/user id).
 */

const redisState = { fail: true };

vi.mock("ioredis", () => {
  class MockRedis {
    multi() {
      const pipeline = {
        incr: () => pipeline,
        pexpire: () => pipeline,
        exec: async () => {
          if (redisState.fail) throw new Error("Redis connection refused");
          return [
            [null, 1],
            [null, 1],
          ];
        },
      };
      return pipeline;
    }
    async pttl() {
      if (redisState.fail) throw new Error("Redis connection refused");
      return 60_000;
    }
  }
  return { default: MockRedis };
});

const sendAlertMock = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/alert", () => ({
  sendAlert: (...args: unknown[]) => sendAlertMock(...args),
}));

import { checkRateLimit } from "@/lib/rate-limit";

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  redisState.fail = true;
  sendAlertMock.mockClear();
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("rate-limit fail-open alerting", () => {
  it("fires ops.rate_limit_fail_open to the alert channel on Redis failure (fail-open)", async () => {
    const result = await checkRateLimit("203.0.113.7", { failMode: "open" });
    expect(result.success).toBe(true);

    expect(sendAlertMock).toHaveBeenCalledTimes(1);
    const payload = sendAlertMock.mock.calls[0][0] as {
      event: string;
      severity: string;
      context: { identifier: string; failMode: string; reason: string };
    };
    expect(payload.event).toBe("ops.rate_limit_fail_open");
    expect(payload.severity).toBe("warning");
    expect(payload.context.failMode).toBe("open");
    expect(payload.context.reason).toBe("redis_unavailable");
    // Identifier must be hashed — the raw IP must NOT appear.
    expect(payload.context.identifier).not.toBe("203.0.113.7");
    expect(payload.context.identifier).toMatch(/^[0-9a-f]{16}$/);
  });

  it("pages with critical severity when failing closed", async () => {
    const result = await checkRateLimit("user-9", { failMode: "closed" });
    expect(result.success).toBe(false);
    expect(sendAlertMock).toHaveBeenCalledTimes(1);
    const payload = sendAlertMock.mock.calls[0][0] as { severity: string };
    expect(payload.severity).toBe("critical");
  });
});
