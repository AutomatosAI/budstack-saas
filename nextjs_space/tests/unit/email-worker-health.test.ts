import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_JOB_AGE_MS,
  DEFAULT_QUEUED_ALERT_AGE_MS,
  QUEUED_ALERT_PREFIX,
  isJobExpired,
  msFromEnv,
  queuedAlertLine,
} from "@/lib/email/worker-health";

const NOW = 1_800_000_000_000; // fixed reference instant

describe("msFromEnv (PRD-220)", () => {
  it("falls back when unset", () => {
    expect(msFromEnv(undefined, 5000)).toBe(5000);
  });

  it("parses a valid millisecond value", () => {
    expect(msFromEnv("60000", 5000)).toBe(60000);
  });

  it.each(["garbage", "", "-1", "0", "NaN"])("falls back on %j", (value) => {
    expect(msFromEnv(value, 5000)).toBe(5000);
  });
});

describe("isJobExpired (PRD-220 stale-send guard)", () => {
  it("keeps a fresh job", () => {
    expect(isJobExpired(NOW - 1000, NOW, DEFAULT_MAX_JOB_AGE_MS)).toBe(false);
  });

  it("keeps a job exactly at the boundary (age == max is still sendable)", () => {
    expect(isJobExpired(NOW - DEFAULT_MAX_JOB_AGE_MS, NOW, DEFAULT_MAX_JOB_AGE_MS)).toBe(false);
  });

  it("expires a job past the max age", () => {
    expect(isJobExpired(NOW - DEFAULT_MAX_JOB_AGE_MS - 1, NOW, DEFAULT_MAX_JOB_AGE_MS)).toBe(true);
  });
});

describe("queuedAlertLine (PRD-220 stuck-queue alert)", () => {
  it("stays quiet with an empty queue", () => {
    expect(queuedAlertLine(null, NOW, DEFAULT_QUEUED_ALERT_AGE_MS)).toBeNull();
  });

  it("stays quiet under the threshold", () => {
    expect(queuedAlertLine(NOW - 60_000, NOW, DEFAULT_QUEUED_ALERT_AGE_MS)).toBeNull();
  });

  it("alerts past the threshold with the stable prefix and age", () => {
    const line = queuedAlertLine(NOW - 20 * 60_000, NOW, DEFAULT_QUEUED_ALERT_AGE_MS);
    expect(line).not.toBeNull();
    expect(line).toContain(QUEUED_ALERT_PREFIX);
    expect(line).toContain("20min");
    expect(line).toContain("threshold 15min");
  });
});
