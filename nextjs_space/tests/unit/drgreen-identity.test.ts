import { describe, expect, it } from "vitest";
import { createVerify, generateKeyPairSync } from "crypto";

import { buildIdentityUploadSignaturePayload } from "@/lib/drgreen-identity";
import { generateDrGreenSignature } from "@/lib/drgreen-api-client";

// Mirror DualAuthGuard.verifyPayload (dr-green-backend
// src/strategy/daap.jwt.strategy.ts:182-221): parse text fields in body order,
// then read each file into a Node Buffer, then JSON.stringify the combined
// object. This is the exact string Dr Green signs/verifies for multipart.
function drGreenCanonical(
  fields: Record<string, string>,
  fileBuffer: Buffer,
): string {
  const formData: Record<string, unknown> = {};
  for (const fieldName of Object.keys(fields)) {
    formData[fieldName] = fields[fieldName];
  }
  formData["file"] = fileBuffer;
  return JSON.stringify(formData);
}

describe("buildIdentityUploadSignaturePayload", () => {
  it("serialises exactly: fields in order, file as a Node Buffer, file last", () => {
    const fileBuffer = Buffer.from([1, 2, 255, 0, 128]);
    const payload = buildIdentityUploadSignaturePayload({
      clientId: "client-123",
      documentType: "ID",
      documentNumber: "A1234567B",
      fileBuffer,
    });
    expect(payload).toBe(
      '{"clientId":"client-123","documentType":"ID","documentNumber":"A1234567B","file":{"type":"Buffer","data":[1,2,255,0,128]}}',
    );
  });

  it("matches the Dr Green verifier reconstruction (image + pdf bytes)", () => {
    const cases: Array<{ fields: Record<string, string>; bytes: Buffer }> = [
      {
        fields: { clientId: "c1", documentType: "PASSPORT", documentNumber: "X99" },
        bytes: Buffer.from("fake-jpeg-bytes\x00\xff", "binary"),
      },
      {
        fields: { clientId: "c2", documentType: "DRIVING_LICENCE", documentNumber: "DL-7" },
        bytes: Buffer.from("%PDF-1.4\n%binary", "utf-8"),
      },
    ];

    for (const { fields, bytes } of cases) {
      const actual = buildIdentityUploadSignaturePayload({
        clientId: fields.clientId,
        documentType: fields.documentType,
        documentNumber: fields.documentNumber,
        fileBuffer: bytes,
      });
      expect(actual).toBe(drGreenCanonical(fields, bytes));
    }
  });

  it("throws if the file is not a Node Buffer (would serialise differently)", () => {
    expect(() =>
      buildIdentityUploadSignaturePayload({
        clientId: "c1",
        documentType: "ID",
        documentNumber: "n",
        // @ts-expect-error intentionally passing a non-Buffer
        fileBuffer: new Uint8Array([1, 2, 3]),
      }),
    ).toThrow();
  });
});

describe("signature compatibility with Dr Green verifySignature", () => {
  // Dr Green (daap.jwt.strategy.ts:261-273): apiKey = base64(PEM public key);
  // verifies with crypto.createVerify("SHA256").update(data).verify(PEM, sig).
  // Budstacks secretKey is base64(PEM private key) — generateDrGreenSignature
  // base64-decodes, detects the PEM, extracts the 32-byte secp256k1 key, signs.
  function makeKeyPair() {
    const { publicKey, privateKey } = generateKeyPairSync("ec", {
      namedCurve: "secp256k1",
    });
    const publicPem = publicKey.export({ type: "spki", format: "pem" }) as string;
    const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
    const secretKey = Buffer.from(privatePem, "utf-8").toString("base64");
    return { publicPem, secretKey };
  }

  it("produces a SHA256/secp256k1 DER signature Dr Green's verifier accepts", () => {
    const { publicPem, secretKey } = makeKeyPair();

    const payload = buildIdentityUploadSignaturePayload({
      clientId: "client-xyz",
      documentType: "DRIVING_LICENCE",
      documentNumber: "DL-001",
      fileBuffer: Buffer.from([10, 20, 30, 200, 255]),
    });

    const signatureB64 = generateDrGreenSignature(payload, secretKey);

    // Verify EXACTLY as Dr Green's verifySignature does.
    const verifier = createVerify("SHA256");
    verifier.update(payload);
    verifier.end();
    expect(verifier.verify(publicPem, Buffer.from(signatureB64, "base64"))).toBe(true);
  });

  it("fails verification when the signed payload is tampered (sanity check)", () => {
    const { publicPem, secretKey } = makeKeyPair();

    const payload = buildIdentityUploadSignaturePayload({
      clientId: "c",
      documentType: "ID",
      documentNumber: "n",
      fileBuffer: Buffer.from([1]),
    });
    const signatureB64 = generateDrGreenSignature(payload, secretKey);

    const verifier = createVerify("SHA256");
    verifier.update(payload + "tampered");
    verifier.end();
    expect(verifier.verify(publicPem, Buffer.from(signatureB64, "base64"))).toBe(false);
  });
});
