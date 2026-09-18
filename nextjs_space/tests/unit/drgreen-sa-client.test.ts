import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/drgreen/drgreen-api-client", () => ({
  callDrGreenAPI: vi.fn(),
  generateDrGreenSignature: vi.fn(() => "sig"),
}));

import { callDrGreenAPI } from "@/lib/drgreen/drgreen-api-client";
import { createSaIdClient } from "@/lib/drgreen-identity";

const baseParams = {
  firstName: "Thabo",
  lastName: "Mokoena",
  email: "thabo@example.com",
  phoneCode: "+27",
  phoneCountryCode: "ZA",
  contactNumber: "821234567",
  shipping: {
    address1: "1 Long St",
    city: "Cape Town",
    state: "Western Cape",
    country: "South Africa",
    postalCode: "8001",
  },
  config: { apiKey: "k", secretKey: "s" },
};

describe("createSaIdClient", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts to /dapp/clients with verificationType ID, ZAF shipping, and NO medicalRecord", async () => {
    (callDrGreenAPI as any).mockResolvedValue({ client: { id: "client-1" } });

    const res = await createSaIdClient(baseParams);

    expect(res.clientId).toBe("client-1");
    expect(callDrGreenAPI).toHaveBeenCalledTimes(1);
    const [endpoint, opts] = (callDrGreenAPI as any).mock.calls[0];
    expect(endpoint).toBe("/dapp/clients");
    expect(opts.method).toBe("POST");
    expect(opts.body.verificationType).toBe("ID");
    expect(opts.body.shipping.countryCode).toBe("ZAF");
    expect("medicalRecord" in opts.body).toBe(false);
  });

  it("extracts clientId from a nested { data: { clientId } } envelope", async () => {
    (callDrGreenAPI as any).mockResolvedValue({ data: { clientId: "client-2" } });
    const res = await createSaIdClient(baseParams);
    expect(res.clientId).toBe("client-2");
  });

  it("forwards title, marketingConsent and consentSource (BS-301)", async () => {
    (callDrGreenAPI as any).mockResolvedValue({ client: { id: "client-3" } });
    await createSaIdClient({
      ...baseParams,
      title: "Ms",
      marketingConsent: true,
      consentSource: "budstacks-id-upload",
    });
    const body = (callDrGreenAPI as any).mock.calls[0][1].body;
    expect(body.title).toBe("Ms");
    expect(body.marketingConsent).toBe(true);
    expect(body.consentSource).toBe("budstacks-id-upload");
  });

  it("sends marketingConsent:false and omits title/source when not given", async () => {
    (callDrGreenAPI as any).mockResolvedValue({ client: { id: "client-4" } });
    await createSaIdClient({ ...baseParams, title: null });
    const body = (callDrGreenAPI as any).mock.calls[0][1].body;
    expect(body.marketingConsent).toBe(false);
    expect("title" in body).toBe(false);
    expect("consentSource" in body).toBe(false);
  });

  it("throws MISSING_CREDENTIALS when keys are absent", async () => {
    await expect(
      createSaIdClient({ ...baseParams, config: { apiKey: "", secretKey: "" } }),
    ).rejects.toThrow("MISSING_CREDENTIALS");
    expect(callDrGreenAPI).not.toHaveBeenCalled();
  });

  it("throws when Dr Green returns no clientId", async () => {
    (callDrGreenAPI as any).mockResolvedValue({ message: "ok" });
    await expect(createSaIdClient(baseParams)).rejects.toThrow(/no clientId/i);
  });
});
