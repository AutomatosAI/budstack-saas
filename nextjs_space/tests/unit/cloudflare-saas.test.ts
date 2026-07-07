import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildTenantDnsInstructions,
  createCustomHostname,
  deleteCustomHostname,
  getCustomHostnameStatus,
  summarizeCustomHostnameStatus,
} from "@/lib/cloudflare-saas";

// PRD Cloudflare-for-SaaS US-005 — typed Custom Hostnames client mirroring
// lib/railway-api.ts. Pure HTTP against the Cloudflare v4 API; fetch is stubbed
// so no network and no real secrets are used.
const TOKEN = "cf-test-token-not-a-secret";
const ZONE = "zone123";
const API = "https://api.cloudflare.com/client/v4";

function okEnvelope(result: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, errors: [], messages: [], result }),
  };
}

function errEnvelope(message: string, status = 400) {
  return {
    ok: status < 400,
    status,
    json: async () => ({
      success: false,
      errors: [{ code: 1406, message }],
      messages: [],
      result: null,
    }),
  };
}

beforeEach(() => {
  vi.stubEnv("CLOUDFLARE_API_TOKEN", TOKEN);
  vi.stubEnv("CLOUDFLARE_ZONE_ID", ZONE);
  vi.stubEnv("CLOUDFLARE_SAAS_ANYCAST_IPS", "198.51.100.1,198.51.100.2");
  vi.stubEnv("CLOUDFLARE_DCV_ID", "abc123dcv");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("cloudflare-saas — createCustomHostname", () => {
  it("POSTs to the zone custom_hostnames endpoint with bearer auth and DV/txt SSL", async () => {
    const result = {
      id: "ch_1",
      hostname: "shop.example.com",
      status: "pending",
      ssl: {
        status: "pending_validation",
        validation_records: [
          { txt_name: "_acme-challenge.shop.example.com", txt_value: "v=abc" },
        ],
      },
    };
    const fetchSpy = vi.fn().mockResolvedValue(okEnvelope(result));
    vi.stubGlobal("fetch", fetchSpy);

    const out = await createCustomHostname("shop.example.com");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${API}/zones/${ZONE}/custom_hostnames`);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    const body = JSON.parse(init.body);
    expect(body.hostname).toBe("shop.example.com");
    expect(body.ssl.type).toBe("dv");
    expect(body.ssl.method).toBe("txt");

    expect(out).toMatchObject({
      id: "ch_1",
      hostname: "shop.example.com",
      status: "pending",
      sslStatus: "pending_validation",
    });
    expect(out.validationRecords).toEqual([
      { type: "txt", name: "_acme-challenge.shop.example.com", value: "v=abc" },
    ]);
  });

  it("throws with the Cloudflare error message when success=false", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(errEnvelope("custom hostname already exists"));
    vi.stubGlobal("fetch", fetchSpy);

    await expect(createCustomHostname("dupe.example.com")).rejects.toThrow(
      /custom hostname already exists/,
    );
  });

  it("throws a clear error when CLOUDFLARE_API_TOKEN is missing (before any fetch)", async () => {
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(createCustomHostname("x.example.com")).rejects.toThrow(
      /CLOUDFLARE_API_TOKEN is not set/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never includes the API token in a thrown error message", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(errEnvelope("bad request"));
    vi.stubGlobal("fetch", fetchSpy);

    let msg = "";
    try {
      await createCustomHostname("x.example.com");
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).not.toContain(TOKEN);
  });
});

describe("cloudflare-saas — getCustomHostnameStatus", () => {
  it("GETs the hostname by id and maps status + ssl.status", async () => {
    const result = {
      id: "ch_9",
      hostname: "apex.example.com",
      status: "active",
      ssl: { status: "active", validation_records: [] },
    };
    const fetchSpy = vi.fn().mockResolvedValue(okEnvelope(result));
    vi.stubGlobal("fetch", fetchSpy);

    const out = await getCustomHostnameStatus("ch_9");

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${API}/zones/${ZONE}/custom_hostnames/ch_9`);
    expect(init.method).toBe("GET");
    expect(out.status).toBe("active");
    expect(out.sslStatus).toBe("active");
  });
});

describe("cloudflare-saas — deleteCustomHostname", () => {
  it("DELETEs the hostname by id", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(okEnvelope({ id: "ch_3" }));
    vi.stubGlobal("fetch", fetchSpy);

    await deleteCustomHostname("ch_3");

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${API}/zones/${ZONE}/custom_hostnames/ch_3`);
    expect(init.method).toBe("DELETE");
  });

  it("throws when Cloudflare reports failure", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(errEnvelope("not found", 404));
    vi.stubGlobal("fetch", fetchSpy);

    await expect(deleteCustomHostname("nope")).rejects.toThrow(/not found/);
  });
});

describe("cloudflare-saas — summarizeCustomHostnameStatus", () => {
  it("verified when the SSL cert is active", () => {
    expect(summarizeCustomHostnameStatus("active", "active")).toBe("verified");
    // SSL active wins even if the hostname status lags.
    expect(summarizeCustomHostnameStatus("pending", "active")).toBe("verified");
  });

  it("pending while still validating / issuing", () => {
    expect(summarizeCustomHostnameStatus("pending", "pending_validation")).toBe("pending");
    expect(summarizeCustomHostnameStatus("pending", "initializing")).toBe("pending");
    expect(summarizeCustomHostnameStatus("active", "pending_deployment")).toBe("pending");
  });

  it("misconfigured on terminal/error states the operator must fix", () => {
    expect(summarizeCustomHostnameStatus("blocked", "pending_validation")).toBe("misconfigured");
    expect(summarizeCustomHostnameStatus("active", "validation_timed_out")).toBe("misconfigured");
    expect(summarizeCustomHostnameStatus("active", "validation_failed")).toBe("misconfigured");
  });
});

describe("cloudflare-saas — buildTenantDnsInstructions", () => {
  it("apex: A records to each anycast IP at @ plus one DCV-delegation CNAME", () => {
    const records = buildTenantDnsInstructions("healingbuds.co.za");

    expect(records).toEqual([
      {
        type: "A",
        host: "@",
        value: "198.51.100.1",
        purpose: "Routes traffic to Cloudflare (proxied to the Railway origin)",
      },
      {
        type: "A",
        host: "@",
        value: "198.51.100.2",
        purpose: "Routes traffic to Cloudflare (proxied to the Railway origin)",
      },
      {
        type: "CNAME",
        host: "_acme-challenge",
        value: "healingbuds.co.za.abc123dcv.dcv.cloudflare.com",
        purpose: "Delegates SSL certificate validation to Cloudflare (one-time)",
      },
    ]);
  });

  it("subdomain: A records + DCV CNAME are scoped to the sub-domain label", () => {
    const records = buildTenantDnsInstructions("shop.example.com");

    expect(records.filter((r) => r.type === "A").map((r) => r.host)).toEqual([
      "shop",
      "shop",
    ]);
    const dcv = records.find((r) => r.type === "CNAME");
    expect(dcv).toEqual({
      type: "CNAME",
      host: "_acme-challenge.shop",
      value: "shop.example.com.abc123dcv.dcv.cloudflare.com",
      purpose: "Delegates SSL certificate validation to Cloudflare (one-time)",
    });
  });

  it("labels an IPv6 anycast address as AAAA", () => {
    vi.stubEnv("CLOUDFLARE_SAAS_ANYCAST_IPS", "198.51.100.1,2606:4700::1");
    const records = buildTenantDnsInstructions("example.com");
    expect(records.map((r) => r.type)).toEqual(["A", "AAAA", "CNAME"]);
  });

  it("throws (caught by the server caller) when CF config is missing", () => {
    vi.stubEnv("CLOUDFLARE_SAAS_ANYCAST_IPS", "");
    expect(() => buildTenantDnsInstructions("example.com")).toThrow(
      /CLOUDFLARE_SAAS_ANYCAST_IPS is not set/,
    );
  });
});
