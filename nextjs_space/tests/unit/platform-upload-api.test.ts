import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * US-005 — the platform's cover-image upload.
 *
 * The claims worth pinning, in the order they can hurt:
 *
 *  1. it is SUPER-ADMIN ONLY and same-origin. Its sibling `platform/leads` is
 *     deliberately unauthenticated, and copying that shape would have handed
 *     anonymous callers a writer into our S3 bucket;
 *  2. the bytes land under `platform/uploads/`, never inside a tenant folder —
 *     a tenant delete must not be able to take the platform's blog covers
 *     with it;
 *  3. `publicUrl` is DURABLE. The form stores `publicUrl || url`, and `url` is
 *     a presigned link that expires in an hour, so a null `publicUrl` on an
 *     image would silently store a cover that breaks the same afternoon;
 *  4. the file-type and size rules are the tenant route's, unweakened.
 *
 * Module-boundary mocks only (getCurrentUser, the S3 calls). The real auth
 * wrapper, the real same-origin guard and the real validator all execute.
 */
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const s3 = vi.hoisted(() => ({
  uploadFile: vi.fn(),
  getFileUrl: vi.fn(),
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/storage/s3", () => s3);

import { POST as upload } from "@/app/api/platform/upload/route";
import { PUBLIC_IMAGE_ROUTE_PREFIX } from "@/lib/storage/public-image-url";
import { UPLOAD_MAX_FILE_SIZE } from "@/lib/constants";

const HOST = "budstacks.io";
const PRESIGNED = "https://bucket.s3.eu-west-1.amazonaws.com/x?X-Amz-Signature=a";

/** A real 1x1 PNG — the validator reads magic bytes, not the declared type. */
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function superAdmin(over: Record<string, unknown> = {}) {
  return {
    id: "su_1",
    email: "ops@budstacks.io",
    name: "Operator",
    image: "",
    role: "SUPER_ADMIN",
    tenantId: null,
    clerkOrgId: null,
    impersonation: null,
    ...over,
  };
}

/** Same-origin by default — the guard is tested explicitly, not by accident. */
function request(
  file?: File,
  headers: Record<string, string> = {},
): NextRequest {
  const body = new FormData();
  if (file) body.set("file", file);

  return new NextRequest(`https://${HOST}/api/platform/upload`, {
    method: "POST",
    body,
    headers: { "sec-fetch-site": "same-origin", host: HOST, ...headers },
  });
}

function pngFile(name = "cover.png", bytes: Buffer = PNG_BYTES): File {
  return new File([bytes], name, { type: "image/png" });
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue(superAdmin());
  s3.uploadFile.mockImplementation(
    async (
      _buffer: Buffer,
      fileName: string,
      _contentType: string,
      prefix: string,
    ) => `development/${prefix}uploads/1754000000000-${fileName}`,
  );
  s3.getFileUrl.mockResolvedValue(PRESIGNED);
});

describe("the platform upload is super-admin only (US-005)", () => {
  it("refuses an anonymous caller — unlike the leads route next door", async () => {
    getCurrentUser.mockResolvedValue(null);

    const res = await upload(request(pngFile()));

    expect(res.status).toBe(401);
    expect(s3.uploadFile).not.toHaveBeenCalled();
  });

  it("refuses a signed-in tenant admin", async () => {
    getCurrentUser.mockResolvedValue(
      superAdmin({ role: "TENANT_ADMIN", tenantId: "tenant-a" }),
    );

    const res = await upload(request(pngFile()));

    expect(res.status).toBe(401);
    expect(s3.uploadFile).not.toHaveBeenCalled();
  });

  it("refuses a cross-origin post from a logged-in super-admin's browser", async () => {
    const res = await upload(
      request(pngFile(), { "sec-fetch-site": "cross-site" }),
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "CROSS_ORIGIN_BLOCKED" });
    expect(s3.uploadFile).not.toHaveBeenCalled();
  });
});

describe("where the bytes land", () => {
  it("writes under the platform prefix, never inside a tenant folder", async () => {
    await upload(request(pngFile()));

    expect(s3.uploadFile).toHaveBeenCalledTimes(1);
    const [, fileName, contentType, prefix] = s3.uploadFile.mock.calls[0];
    expect(prefix).toBe("platform/");
    expect(fileName).toBe("cover.png");
    expect(contentType).toBe("image/png");
  });

  it("strips traversal and separators out of the filename", async () => {
    await upload(request(pngFile("../../etc/passwd.png")));

    const fileName: string = s3.uploadFile.mock.calls[0][1];

    // Asserted as PROPERTIES, not as one exact string. The property is what
    // makes the key safe — no separator of either flavour, and therefore no
    // traversal sequence — and it holds however the sanitiser spells the
    // result. Pinning the exact output instead made this test fail when
    // `sanitizeUploadFileName` was reordered to satisfy CodeQL
    // (js/incomplete-multi-character-sanitization), even though the reordered
    // version is strictly safer: it was asserting an implementation detail.
    expect(fileName).not.toMatch(/[/\\]/);
    expect(fileName).not.toContain("../");
    expect(fileName).not.toContain("..\\");
    // The real name still survives at the end, so the upload is identifiable.
    expect(fileName.endsWith("etc_passwd.png")).toBe(true);
  });

  it("leaves a legitimate filename alone", async () => {
    await upload(request(pngFile("my..file.png")));

    // Dots that are not a traversal sequence are ordinary filename characters
    // once the separators are gone — sanitising must not mangle them.
    expect(s3.uploadFile.mock.calls[0][1]).toBe("my..file.png");
  });

  it("signs the preview URL without a tenant scope — there is no tenant", async () => {
    await upload(request(pngFile()));

    // A `{ tenantId }` argument would assert the key sits in that tenant's
    // folder and throw 403 on every platform upload.
    expect(s3.getFileUrl).toHaveBeenCalledWith(
      "development/platform/uploads/1754000000000-cover.png",
    );
  });
});

describe("the response the form consumes", () => {
  it("returns the tenant route's shape with a DURABLE publicUrl", async () => {
    const res = await upload(request(pngFile()));

    expect(res.status).toBe(200);
    const body = await res.json();
    const key = "development/platform/uploads/1754000000000-cover.png";

    expect(body).toEqual({
      success: true,
      key,
      url: PRESIGNED,
      publicUrl: `${PUBLIC_IMAGE_ROUTE_PREFIX}${key}`,
    });

    // What the form actually stores must not be the expiring one.
    expect(body.publicUrl || body.url).not.toMatch(/X-Amz-/);
  });

  it("has no durable URL for a non-image, so the form stores nothing broken", async () => {
    const pdf = new File([Buffer.from("%PDF-1.4\n%stub")], "notes.pdf", {
      type: "application/pdf",
    });

    const body = await (await upload(request(pdf))).json();

    expect(body.publicUrl).toBeNull();
  });
});

describe("file validation is the tenant route's, unweakened", () => {
  it("rejects an SVG — it is XML and can carry script", async () => {
    const svg = new File([Buffer.from("<svg xmlns='x'/>")], "logo.svg", {
      type: "image/svg+xml",
    });

    const res = await upload(request(svg));

    expect(res.status).toBe(400);
    expect(s3.uploadFile).not.toHaveBeenCalled();
  });

  it("rejects content that contradicts the declared image type", async () => {
    // Magic bytes decide, not the Content-Type the client sent.
    const disguised = new File([Buffer.from("%PDF-1.4\n%stub")], "cover.png", {
      type: "image/png",
    });

    const res = await upload(request(disguised));

    expect(res.status).toBe(400);
    expect(s3.uploadFile).not.toHaveBeenCalled();
  });

  it("rejects a blocked extension smuggled in front of the image one", async () => {
    const res = await upload(request(pngFile("payload.php.png")));

    expect(res.status).toBe(400);
    expect(s3.uploadFile).not.toHaveBeenCalled();
  });

  it("rejects a file over the shared 10 MB limit", async () => {
    const oversized = Buffer.concat([
      PNG_BYTES,
      Buffer.alloc(UPLOAD_MAX_FILE_SIZE),
    ]);

    const res = await upload(request(pngFile("huge.png", oversized)));

    expect(res.status).toBe(400);
    expect(s3.uploadFile).not.toHaveBeenCalled();
  });

  it("rejects a request carrying no file at all", async () => {
    const res = await upload(request());

    expect(res.status).toBe(400);
    expect(s3.uploadFile).not.toHaveBeenCalled();
  });
});
