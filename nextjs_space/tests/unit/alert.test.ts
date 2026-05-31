import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PRD-215 AC-7 — the alert channel posts to the configured webhook and ALWAYS
 * swallows transport failures so alerting can never break the calling request.
 * When no transport is configured it returns false (the log breadcrumb is the
 * record). The module reads ALERT_WEBHOOK_URL per call, so we toggle env then
 * re-import in isolation.
 */

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function loadAlert() {
  vi.resetModules();
  return import("@/lib/alert");
}

describe("sendAlert", () => {
  it("returns false (no throw) when no webhook is configured", async () => {
    vi.stubEnv("ALERT_WEBHOOK_URL", "");
    const { sendAlert } = await loadAlert();

    const result = await sendAlert({
      event: "ops.rate_limit_fail_open",
      message: "redis down",
    });
    expect(result).toBe(false);
  });

  it("posts to the configured webhook and returns true on 2xx", async () => {
    vi.stubEnv("ALERT_WEBHOOK_URL", "https://hooks.example.com/abc");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));
    const { sendAlert } = await loadAlert();

    const result = await sendAlert({
      event: "ops.rate_limit_fail_open",
      severity: "critical",
      message: "redis down",
      context: { identifier: "hashed", failMode: "closed" },
    });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://hooks.example.com/abc");
    expect(init?.method).toBe("POST");
    expect(String(init?.body)).toContain("ops.rate_limit_fail_open");
  });

  it("returns false (swallows) when the transport rejects", async () => {
    vi.stubEnv("ALERT_WEBHOOK_URL", "https://hooks.example.com/abc");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const { sendAlert } = await loadAlert();

    const result = await sendAlert({
      event: "ops.webhook_rate_limit_fail_open",
      message: "webhook limiter failed open",
    });
    // No throw escaped; failure downgraded to false.
    expect(result).toBe(false);
  });

  it("returns false when the webhook responds non-2xx", async () => {
    vi.stubEnv("ALERT_WEBHOOK_URL", "https://hooks.example.com/abc");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));
    const { sendAlert } = await loadAlert();

    const result = await sendAlert({
      event: "security.tenant_context_missing",
      message: "missing tenant ctx",
    });
    expect(result).toBe(false);
  });
});
