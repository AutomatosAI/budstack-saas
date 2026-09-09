import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/drgreen/drgreen-api-client", () => ({
  callDrGreenAPI: vi.fn(),
  generateDrGreenSignature: vi.fn(() => "sig"),
}));

import { callDrGreenAPI } from "@/lib/drgreen/drgreen-api-client";
import {
  switchClientToIdVerification,
  mapDrGreenApiError,
} from "@/lib/drgreen-identity";

const config = { apiKey: "k", secretKey: "s" };

describe("switchClientToIdVerification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts the clientId in the signed body to /dapp/clients/switch-to-id", async () => {
    (callDrGreenAPI as any).mockResolvedValue({
      data: {
        client: { id: "c1", verificationType: "ID", adminApproval: "PENDING" },
      },
    });

    const res = await switchClientToIdVerification({ clientId: "c1", config });

    expect(res.verificationType).toBe("ID");
    const [endpoint, opts] = (callDrGreenAPI as any).mock.calls[0];
    expect(endpoint).toBe("/dapp/clients/switch-to-id");
    expect(opts.method).toBe("POST");
    // The body IS the signed payload (DualAuthGuard signs
    // JSON.stringify(req.body)) — the clientId must travel there.
    expect(opts.body).toEqual({ clientId: "c1" });
  });

  it("tolerates the interceptor's single- and double-wrapped envelopes", async () => {
    (callDrGreenAPI as any).mockResolvedValue({
      client: { id: "c1", verificationType: "ID", adminApproval: "PENDING" },
    });
    const res = await switchClientToIdVerification({ clientId: "c1", config });
    expect(res.id).toBe("c1");

    (callDrGreenAPI as any).mockResolvedValue({
      data: {
        data: {
          client: { id: "c2", verificationType: "ID", adminApproval: "PENDING" },
        },
      },
    });
    const res2 = await switchClientToIdVerification({ clientId: "c2", config });
    expect(res2.id).toBe("c2");
  });

  it("throws MISSING_CREDENTIALS without calling Dr Green when config is incomplete", async () => {
    await expect(
      switchClientToIdVerification({
        clientId: "c1",
        config: { apiKey: "", secretKey: "s" },
      }),
    ).rejects.toThrow("MISSING_CREDENTIALS");
    expect(callDrGreenAPI).not.toHaveBeenCalled();
  });

  it("throws on a response with no client payload", async () => {
    (callDrGreenAPI as any).mockResolvedValue({ data: { message: "ok" } });
    await expect(
      switchClientToIdVerification({ clientId: "c1", config }),
    ).rejects.toThrow(/unexpected response shape/);
  });
});

describe("mapDrGreenApiError", () => {
  it("recovers status and Dr Green's customer-safe message from a 409", () => {
    const err = new Error(
      'Doctor Green API Error: 409 Conflict - {"success":false,"statusCode":409,"message":"ID verification is only available for South African clients"}',
    );
    expect(mapDrGreenApiError(err)).toEqual({
      status: 409,
      message: "ID verification is only available for South African clients",
    });
  });

  it("recovers the status alone when the body is truncated or non-JSON", () => {
    const err = new Error("Doctor Green API Error: 403 Forbidden - <html>");
    expect(mapDrGreenApiError(err)).toEqual({
      status: 403,
      message: undefined,
    });
  });

  it("returns null for non-Dr-Green errors", () => {
    expect(mapDrGreenApiError(new Error("ECONNREFUSED"))).toBeNull();
    expect(mapDrGreenApiError("not an error")).toBeNull();
  });
});
