import { describe, it, expect, vi, beforeEach } from "vitest";

// withAuth → identity wrapper so POST is the raw handler (req, {user}, {slug}).
vi.mock("@/lib/api-auth", () => ({ withAuth: (h: any) => h }));
vi.mock("@/lib/validation/parse-uuid", () => ({ parseSlug: vi.fn() }));
vi.mock("@/lib/tenant/tenant", () => ({ getCurrentTenant: vi.fn() }));
vi.mock("@/lib/tenant/tenant-config", () => ({
  getTenantDrGreenConfig: vi.fn(async () => ({
    apiKey: "k",
    secretKey: "s",
    apiUrl: "https://stage/api/v1",
  })),
}));
vi.mock("@/lib/db", () => ({ prisma: { users: { findFirst: vi.fn() } } }));
vi.mock("@/lib/drgreen-identity", () => ({
  uploadIdentityDocument: vi.fn(async () => ({
    id: "doc-1",
    documentType: "ID",
    reviewStatus: "PENDING",
    createdAt: "2026-06-07T00:00:00Z",
  })),
  ALLOWED_DOCUMENT_MIME_TYPES: ["image/jpeg", "image/png", "application/pdf"],
  MAX_DOCUMENT_BYTES: 10 * 1024 * 1024,
}));
vi.mock("@/lib/verification/id-document-status", () => ({
  recordIdDocumentOutcome: vi.fn(async () => true),
}));
vi.mock("@/lib/api-error", () => ({
  apiError: (_e: any, o: any) =>
    new Response(JSON.stringify({ error: o?.safeMessage ?? "error" }), {
      status: o?.status ?? 500,
      headers: { "content-type": "application/json" },
    }),
}));

import { POST } from "@/app/api/store/[slug]/verify/id-document/route";
import { getCurrentTenant } from "@/lib/tenant/tenant";
import { prisma } from "@/lib/db";
import { uploadIdentityDocument } from "@/lib/drgreen-identity";
import { recordIdDocumentOutcome } from "@/lib/verification/id-document-status";
import { SA_ID_INVALID_CODE, SA_ID_INVALID_MESSAGE } from "@/lib/verification/sa-id";

// Synthetic numbers from lib/verification/__tests__/sa-id-vectors.json.
const VALID_SA_ID = "9001015009086";
const VALID_SA_ID_SPACED = "900101 5009 086";
const INVALID_SA_ID = "9001015009087"; // check digit off by one

const ZA_ID_TENANT = {
  id: "tenant-1",
  countryCode: "ZA",
  settings: { verificationMode: "ID_UPLOAD" },
};

function makeReq(parts: {
  file?: Blob;
  documentType?: string;
  documentNumber?: string;
}) {
  const fd = new FormData();
  if (parts.file) fd.append("file", parts.file, "id.jpg");
  if (parts.documentType) fd.append("documentType", parts.documentType);
  if (parts.documentNumber) fd.append("documentNumber", parts.documentNumber);
  return new Request("https://store.test/api/store/s/verify/id-document", {
    method: "POST",
    body: fd,
  }) as any;
}

const jpeg = () => new Blob([Buffer.from([1, 2, 3, 4])], { type: "image/jpeg" });

const call = (req: any) =>
  (POST as any)(req, { user: { email: "a@b.com" } }, { slug: "s" });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SA_ID_UPLOAD_ENABLED = "true";
  (getCurrentTenant as any).mockResolvedValue(ZA_ID_TENANT);
  (prisma.users.findFirst as any).mockResolvedValue({
    id: "u1",
    drGreenClientId: "client-1",
  });
});

describe("POST /api/store/[slug]/verify/id-document", () => {
  it("forwards a valid upload and returns PENDING", async () => {
    const res = await call(
      makeReq({ file: jpeg(), documentType: "ID", documentNumber: VALID_SA_ID }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "PENDING" });
    expect(uploadIdentityDocument).toHaveBeenCalledTimes(1);
    const arg = (uploadIdentityDocument as any).mock.calls[0][0];
    expect(arg.clientId).toBe("client-1");
    expect(arg.documentType).toBe("ID");
    expect(Buffer.isBuffer(arg.file)).toBe(true);
  });

  it("403s and does not forward when the tenant is in KYC mode", async () => {
    (getCurrentTenant as any).mockResolvedValue({
      ...ZA_ID_TENANT,
      settings: { verificationMode: "KYC" },
    });
    const res = await call(
      makeReq({ file: jpeg(), documentType: "ID", documentNumber: VALID_SA_ID }),
    );
    expect(res.status).toBe(403);
    expect(uploadIdentityDocument).not.toHaveBeenCalled();
  });

  it("403s when the global flag is off", async () => {
    process.env.SA_ID_UPLOAD_ENABLED = "false";
    const res = await call(
      makeReq({ file: jpeg(), documentType: "ID", documentNumber: VALID_SA_ID }),
    );
    expect(res.status).toBe(403);
    expect(uploadIdentityDocument).not.toHaveBeenCalled();
  });

  it("400s when the customer has no Dr Green client yet", async () => {
    (prisma.users.findFirst as any).mockResolvedValue({
      id: "u1",
      drGreenClientId: null,
    });
    const res = await call(
      makeReq({ file: jpeg(), documentType: "ID", documentNumber: VALID_SA_ID }),
    );
    expect(res.status).toBe(400);
    expect(uploadIdentityDocument).not.toHaveBeenCalled();
  });

  it("400s on an unsupported file type", async () => {
    const txt = new Blob([Buffer.from("hi")], { type: "text/plain" });
    const res = await call(
      makeReq({ file: txt, documentType: "ID", documentNumber: VALID_SA_ID }),
    );
    expect(res.status).toBe(400);
    expect(uploadIdentityDocument).not.toHaveBeenCalled();
  });

  it("400s when the document number is missing", async () => {
    const res = await call(makeReq({ file: jpeg(), documentType: "ID" }));
    expect(res.status).toBe(400);
    expect(uploadIdentityDocument).not.toHaveBeenCalled();
  });
});

describe("POST /api/store/[slug]/verify/id-document — South African ID rules (BS-202/BS-204)", () => {
  it("400s with SA_ID_INVALID for an impossible ID number and attempts nothing", async () => {
    const res = await call(
      makeReq({ file: jpeg(), documentType: "ID", documentNumber: INVALID_SA_ID }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      code: SA_ID_INVALID_CODE,
      error: SA_ID_INVALID_MESSAGE,
    });
    expect(uploadIdentityDocument).not.toHaveBeenCalled();
    // Nothing was attempted, so nothing is recorded — no UPLOAD_FAILED flag.
    expect(recordIdDocumentOutcome).not.toHaveBeenCalled();
  });

  it("forwards a valid ID number space-stripped", async () => {
    const res = await call(
      makeReq({ file: jpeg(), documentType: "ID", documentNumber: VALID_SA_ID_SPACED }),
    );
    expect(res.status).toBe(200);
    const arg = (uploadIdentityDocument as any).mock.calls[0][0];
    expect(arg.documentNumber).toBe(VALID_SA_ID);
  });

  it("leaves passport and driving-licence numbers unchecked", async () => {
    for (const documentType of ["PASSPORT", "DRIVING_LICENCE"]) {
      (uploadIdentityDocument as any).mockClear();
      const res = await call(
        makeReq({ file: jpeg(), documentType, documentNumber: "not-13-digits" }),
      );
      expect(res.status).toBe(200);
      const arg = (uploadIdentityDocument as any).mock.calls[0][0];
      expect(arg.documentNumber).toBe("not-13-digits");
    }
  });

  it("never reaches the SA rules for a non-South-African tenant (the ID-upload path is ZA-only)", async () => {
    (getCurrentTenant as any).mockResolvedValue({ ...ZA_ID_TENANT, countryCode: "PT" });
    const res = await call(
      makeReq({ file: jpeg(), documentType: "ID", documentNumber: INVALID_SA_ID }),
    );
    expect(res.status).toBe(403);
    expect(uploadIdentityDocument).not.toHaveBeenCalled();
  });

  it("maps Dr Green's own SA_ID_INVALID 400 onto the field and records the reason", async () => {
    (uploadIdentityDocument as any).mockRejectedValueOnce(
      new Error(
        'Dr Green identity upload failed: 400 Bad Request - {"success":false,"statusCode":400,"message":"' +
          SA_ID_INVALID_MESSAGE +
          '","error":"SA_ID_INVALID"}',
      ),
    );
    const res = await call(
      makeReq({ file: jpeg(), documentType: "ID", documentNumber: VALID_SA_ID }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      code: SA_ID_INVALID_CODE,
      error: SA_ID_INVALID_MESSAGE,
    });
    expect(recordIdDocumentOutcome).toHaveBeenCalledTimes(1);
    const outcome = (recordIdDocumentOutcome as any).mock.calls[0][0];
    expect(outcome.outcome).toBe("UPLOAD_FAILED");
    expect(outcome.tenantId).toBe("tenant-1");
    expect(outcome.email).toBe("a@b.com");
    // The stored reason is the customer copy, so the dashboard may show it.
    expect(outcome.error).toBeInstanceOf(Error);
    expect((outcome.error as Error).message).toBe(SA_ID_INVALID_MESSAGE);
  });

  it("still records any other upstream failure and answers 500 as before", async () => {
    (uploadIdentityDocument as any).mockRejectedValueOnce(
      new Error("Dr Green identity upload failed: 502 Bad Gateway - <html>"),
    );
    const res = await call(
      makeReq({ file: jpeg(), documentType: "ID", documentNumber: VALID_SA_ID }),
    );
    expect(res.status).toBe(500);
    const outcome = (recordIdDocumentOutcome as any).mock.calls[0][0];
    expect(outcome.outcome).toBe("UPLOAD_FAILED");
    expect((outcome.error as Error).message).toMatch(/502/);
  });
});
