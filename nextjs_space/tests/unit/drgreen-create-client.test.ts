import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/drgreen/drgreen-api-client", () => ({
  callDrGreenAPI: vi.fn(),
}));
vi.mock("@/lib/exchange-rates", () => ({ convertFromEUR: vi.fn(async (v: number) => v) }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { callDrGreenAPI } from "@/lib/drgreen/drgreen-api-client";
import { createClient, extractCreatedClient } from "@/lib/drgreen/doctor-green-api";

/**
 * The shop-register create path (BS-301). It used to POST to "/client", which
 * no Dr Green controller serves; it now uses the same /dapp/clients route as
 * the other two create paths and forwards consent + title.
 */
const clientData = {
  firstName: "Ana",
  lastName: "Silva",
  email: "ana@example.com",
  phoneCode: "+27",
  phoneCountryCode: "ZA",
  contactNumber: "821234567",
  shipping: {
    address1: "1 Long St",
    city: "Cape Town",
    state: "Western Cape",
    country: "South Africa",
    countryCode: "ZA",
    postalCode: "8001",
  },
  medicalRecord: {} as any,
};
const config = { apiKey: "k", secretKey: "s", apiUrl: "https://stage/api/v1" };

beforeEach(() => vi.clearAllMocks());

describe("createClient", () => {
  it("posts to /dapp/clients with consent + title and reads data.client.id", async () => {
    (callDrGreenAPI as any).mockResolvedValue({
      success: true,
      data: { client: { id: "client-9", kycLink: "https://kyc/x" } },
    });

    const result = await createClient(
      { ...clientData, title: "Dr", marketingConsent: true, consentSource: "budstacks-shop-register" },
      config,
    );

    expect(result).toEqual({ clientId: "client-9", kycLink: "https://kyc/x" });
    const [endpoint, opts] = (callDrGreenAPI as any).mock.calls[0];
    expect(endpoint).toBe("/dapp/clients");
    expect(opts.method).toBe("POST");
    expect(opts.baseUrl).toBe("https://stage/api/v1");
    expect(opts.body).toEqual(
      expect.objectContaining({
        title: "Dr",
        marketingConsent: true,
        consentSource: "budstacks-shop-register",
      }),
    );
  });

  it("sends marketingConsent:false and no title/source when nothing was given", async () => {
    (callDrGreenAPI as any).mockResolvedValue({ data: { data: { clientId: "c-2" } } });
    await createClient(clientData, config);
    const body = (callDrGreenAPI as any).mock.calls[0][1].body;
    expect(body.marketingConsent).toBe(false);
    expect("title" in body).toBe(false);
    expect("consentSource" in body).toBe(false);
  });

  it("throws when no client id comes back", async () => {
    (callDrGreenAPI as any).mockResolvedValue({ success: true, message: "ok" });
    await expect(createClient(clientData, config)).rejects.toThrow(/No ID returned/);
  });
});

describe("extractCreatedClient", () => {
  it.each([
    [{ data: { client: { id: "a", kycLink: "l" } } }, { clientId: "a", kycLink: "l" }],
    [{ data: { data: { clientId: "b", kycLink: "l2" } } }, { clientId: "b", kycLink: "l2" }],
    [{ data: { clientId: "c" } }, { clientId: "c", kycLink: undefined }],
    [{ client: { id: "d" } }, { clientId: "d", kycLink: undefined }],
    [{ data: { id: "e" } }, { clientId: "e", kycLink: undefined }],
    [{ nothing: true }, { clientId: undefined, kycLink: undefined }],
  ])("tolerates envelope %j", (response, expected) => {
    expect(extractCreatedClient(response)).toEqual(expected);
  });
});
