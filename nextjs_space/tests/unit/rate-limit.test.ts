import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Controllable behaviour for the mocked ioredis client. checkRateLimit caches a
 * single client in module scope, so we steer it per-test by mutating this state
 * rather than swapping the client. Methods read it live.
 */
const redisState = {
  count: 1, // value INCR returns (first multi() result)
  ttlMs: 60_000, // value PTTL returns
  fail: false, // when true, exec()/pttl() throw → simulates Redis down
};

vi.mock("ioredis", () => {
  class MockRedis {
    multi() {
      const pipeline: {
        incr: () => typeof pipeline;
        pexpire: () => typeof pipeline;
        exec: () => Promise<Array<[null, number]>>;
      } = {
        incr: () => pipeline,
        pexpire: () => pipeline,
        exec: async () => {
          if (redisState.fail) throw new Error("Redis connection refused");
          return [
            [null, redisState.count],
            [null, 1],
          ];
        },
      };
      return pipeline;
    }
    async pttl() {
      if (redisState.fail) throw new Error("Redis connection refused");
      return redisState.ttlMs;
    }
  }
  return { default: MockRedis };
});

import { checkRateLimit } from "@/lib/security/rate-limit";

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  redisState.count = 1;
  redisState.ttlMs = 60_000;
  redisState.fail = false;
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("checkRateLimit", () => {
  it("allows a request under the limit", async () => {
    redisState.count = 5;
    const result = await checkRateLimit("user-1", { maxRequests: 20 });
    expect(result.success).toBe(true);
  });

  it("blocks a request over the limit with a 429 + Retry-After", async () => {
    redisState.count = 21;
    const result = await checkRateLimit("user-2", { maxRequests: 20 });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected rate-limited result");
    expect(result.response.status).toBe(429);
    expect(result.response.headers.get("Retry-After")).toBeTruthy();
  });

  it("fail-open (default): on Redis error allows through AND emits ops.rate_limit_failopen", async () => {
    redisState.fail = true;
    const result = await checkRateLimit("user-3");
    expect(result.success).toBe(true);
    expect(errorSpy).toHaveBeenCalledWith(
      "ops.rate_limit_failopen",
      expect.objectContaining({ identifier: "user-3", failMode: "open" }),
    );
  });

  it("fail-closed: on Redis error rejects with 503 + Retry-After AND emits ops.rate_limit_failopen", async () => {
    redisState.fail = true;
    const result = await checkRateLimit("user-4", { failMode: "closed" });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected fail-closed result");
    expect(result.response.status).toBe(503);
    expect(result.response.headers.get("Retry-After")).toBeTruthy();
    expect(errorSpy).toHaveBeenCalledWith(
      "ops.rate_limit_failopen",
      expect.objectContaining({ identifier: "user-4", failMode: "closed" }),
    );
  });

  it("fail-closed 503 body carries no raw Redis error text", async () => {
    redisState.fail = true;
    const result = await checkRateLimit("user-5", { failMode: "closed" });
    if (result.success) throw new Error("expected fail-closed result");
    const body = await result.response.json();
    expect(JSON.stringify(body)).not.toContain("Redis connection refused");
  });
});
