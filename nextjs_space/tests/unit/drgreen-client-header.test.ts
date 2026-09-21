import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVerify, generateKeyPairSync } from "crypto";

// Isolate from the pino-based logger drgreen-api-client imports.
vi.mock("@/lib/logger", () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}));

import { callDrGreenAPI } from "@/lib/drgreen/drgreen-api-client";
import {
  buildIdentityUploadSignaturePayload,
  uploadIdentityDocument,
} from "@/lib/drgreen-identity";
import {
  DRG_CLIENT_HEADER,
  DRG_CLIENT_NAME,
  drgClientHeaderValue,
  resolveAppVersion,
  withDrgClientHeader,
} from "@/lib/drgreen/client-version";

/**
 * BS-204 — every Dr Green call declares itself with `X-DRG-Client` so Dr
 * Green applies strict validation to BudStacks (legacy WordPress plugins send
 * nothing and stay in soft mode). The header must sit OUTSIDE the signed
 * payload: these tests verify each request's signature against the payload
 * Dr Green reconstructs, exactly as its DualAuthGuard does.
 */
function makeKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "secp256k1",
  });
  const publicPem = publicKey.export({ type: "spki", format: "pem" }) as string;
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  return { publicPem, secretKey: Buffer.from(privatePem, "utf-8").toString("base64") };
}

function verifiesAsDrGreen(publicPem: string, payload: string, signatureB64: string): boolean {
  const verifier = createVerify("SHA256");
  verifier.update(payload);
  verifier.end();
  return verifier.verify(publicPem, Buffer.from(signatureB64, "base64"));
}

describe("drgClientHeaderValue", () => {
  it("is budstacks/<package.json version> when APP_VERSION is unset", () => {
    const value = drgClientHeaderValue({});
    expect(value).toBe(`${DRG_CLIENT_NAME}/${resolveAppVersion({})}`);
    expect(value).toMatch(/^budstacks\/\d+\.\d+\.\d+$/);
  });

  it("prefers APP_VERSION and sanitises it to Dr Green's stored charset", () => {
    expect(drgClientHeaderValue({ APP_VERSION: "2.1.0+build 7" })).toBe("budstacks/2.1.0-build-7");
  });

  it("caps the value at the 64 characters Dr Green keeps", () => {
    expect(drgClientHeaderValue({ APP_VERSION: "9".repeat(100) })).toHaveLength(64);
  });

  it("withDrgClientHeader returns a new object and lets explicit headers win", () => {
    const input = { "x-auth-apikey": "k" };
    const out = withDrgClientHeader(input);
    expect(out).not.toBe(input);
    expect(input).toEqual({ "x-auth-apikey": "k" });
    expect(out[DRG_CLIENT_HEADER]).toBe(drgClientHeaderValue());
    expect(withDrgClientHeader({ [DRG_CLIENT_HEADER]: "custom/1" })[DRG_CLIENT_HEADER]).toBe("custom/1");
  });
});

describe("X-DRG-Client on every Dr Green call, outside the signature", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("callDrGreenAPI (JSON): header present, body signature verifies unchanged", async () => {
    const { publicPem, secretKey } = makeKeyPair();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );

    await callDrGreenAPI("/dapp/clients", {
      method: "POST",
      apiKey: "k",
      secretKey,
      body: { clientId: "c1" },
      baseUrl: "https://stage/api/v1",
    });

    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers[DRG_CLIENT_HEADER]).toBe(drgClientHeaderValue());
    expect(headers["x-auth-apikey"]).toBe("k");
    // The signed payload is the JSON body alone — the header is not in it.
    expect(verifiesAsDrGreen(publicPem, JSON.stringify({ clientId: "c1" }), headers["x-auth-signature"])).toBe(true);
    expect(init.body).toBe(JSON.stringify({ clientId: "c1" }));
  });

  it("callDrGreenAPI (GET with query): header present, query-string signature unchanged", async () => {
    const { publicPem, secretKey } = makeKeyPair();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { strains: [] } }), { status: 200 }),
    );

    await callDrGreenAPI("/dapp/strains", {
      apiKey: "k",
      secretKey,
      queryParams: { countryCode: "ZAF", take: 100 },
      baseUrl: "https://stage/api/v1",
    });

    const [url, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(url).toBe("https://stage/api/v1/dapp/strains?countryCode=ZAF&take=100");
    expect(headers[DRG_CLIENT_HEADER]).toBe(drgClientHeaderValue());
    expect(verifiesAsDrGreen(publicPem, "countryCode=ZAF&take=100", headers["x-auth-signature"])).toBe(true);
  });

  it("uploadIdentityDocument (multipart): header present, multipart signature byte-for-byte unchanged", async () => {
    const { publicPem, secretKey } = makeKeyPair();
    const file = Buffer.from([1, 2, 255, 0, 128]);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { data: { id: "doc-1", documentType: "ID", reviewStatus: "PENDING", createdAt: "x" } },
        }),
        { status: 200 },
      ),
    );

    const doc = await uploadIdentityDocument({
      clientId: "c1",
      documentType: "ID",
      documentNumber: "9001015009086",
      file,
      mimeType: "image/png",
      config: { apiKey: "k", secretKey },
      baseUrl: "https://stage/api/v1",
    });
    expect(doc.id).toBe("doc-1");

    const [url, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(url).toBe("https://stage/api/v1/identity/documents");
    expect(headers[DRG_CLIENT_HEADER]).toBe(drgClientHeaderValue());
    // No Content-Type: fetch derives the multipart boundary (unchanged).
    expect(headers["Content-Type"]).toBeUndefined();
    // Dr Green rebuilds {fields..., file: Buffer} and verifies that string.
    const canonical = buildIdentityUploadSignaturePayload({
      clientId: "c1",
      documentType: "ID",
      documentNumber: "9001015009086",
      fileBuffer: file,
    });
    expect(verifiesAsDrGreen(publicPem, canonical, headers["x-auth-signature"])).toBe(true);
    expect(init.body).toBeInstanceOf(FormData);
  });
});
