import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  impersonationMaxHours,
  impersonationExpiry,
  secondsUntil,
  IMPERSONATION_COOKIE,
} from "@/lib/impersonation/constants";

const ORIGINAL = process.env.IMPERSONATION_MAX_HOURS;

beforeEach(() => {
  delete process.env.IMPERSONATION_MAX_HOURS;
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.IMPERSONATION_MAX_HOURS;
  else process.env.IMPERSONATION_MAX_HOURS = ORIGINAL;
});

describe("impersonationMaxHours (AC-7: 4h default, configurable)", () => {
  it("defaults to 4 hours when unset", () => {
    expect(impersonationMaxHours()).toBe(4);
  });

  it("honours a valid override", () => {
    process.env.IMPERSONATION_MAX_HOURS = "2";
    expect(impersonationMaxHours()).toBe(2);
  });

  it.each(["0", "-3", "25", "abc", ""])(
    "falls back to the default for invalid value %j",
    (value) => {
      process.env.IMPERSONATION_MAX_HOURS = value;
      expect(impersonationMaxHours()).toBe(4);
    },
  );
});

describe("impersonationExpiry", () => {
  it("adds exactly maxHours to the start time", () => {
    const start = new Date("2026-07-10T10:00:00.000Z");
    expect(impersonationExpiry(start).toISOString()).toBe(
      "2026-07-10T14:00:00.000Z",
    );
  });
});

describe("secondsUntil", () => {
  it("returns whole seconds between now and expiry", () => {
    const now = new Date("2026-07-10T10:00:00.000Z");
    const expires = new Date("2026-07-10T10:00:30.500Z");
    expect(secondsUntil(expires, now)).toBe(30);
  });

  it("floors at 0 for past expiries (never a negative cookie Max-Age)", () => {
    const now = new Date("2026-07-10T10:00:00.000Z");
    const past = new Date("2026-07-10T09:00:00.000Z");
    expect(secondsUntil(past, now)).toBe(0);
  });
});

describe("IMPERSONATION_COOKIE", () => {
  it("is a stable name (cookie contract with the routes/banner)", () => {
    expect(IMPERSONATION_COOKIE).toBe("bs_impersonation");
  });
});
