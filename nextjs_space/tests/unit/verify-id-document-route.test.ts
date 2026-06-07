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
      makeReq({ file: jpeg(), documentType: "ID", documentNumber: "A123" }),
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
      makeReq({ file: jpeg(), documentType: "ID", documentNumber: "A123" }),
    );
    expect(res.status).toBe(403);
    expect(uploadIdentityDocument).not.toHaveBeenCalled();
  });

  it("403s when the global flag is off", async () => {
    process.env.SA_ID_UPLOAD_ENABLED = "false";
    const res = await call(
      makeReq({ file: jpeg(), documentType: "ID", documentNumber: "A123" }),
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
      makeReq({ file: jpeg(), documentType: "ID", documentNumber: "A123" }),
    );
    expect(res.status).toBe(400);
    expect(uploadIdentityDocument).not.toHaveBeenCalled();
  });

  it("400s on an unsupported file type", async () => {
    const txt = new Blob([Buffer.from("hi")], { type: "text/plain" });
    const res = await call(
      makeReq({ file: txt, documentType: "ID", documentNumber: "A123" }),
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
